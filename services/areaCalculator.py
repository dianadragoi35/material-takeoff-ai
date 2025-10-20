#!/usr/bin/env python3
"""
Area Calculator Service
Uses computer vision to detect building outlines and calculate accurate areas from PDF floor plans.
This service validates and enhances AI-extracted data with precise geometric calculations.
"""

import sys
import json
import cv2
import numpy as np
from pdf2image import convert_from_path
from pathlib import Path
import tempfile
import argparse


class AreaCalculator:
    """Calculate building areas from PDF floor plans using computer vision."""

    def __init__(self, pdf_path: str, scale: str = "1:100", debug: bool = False):
        """
        Initialize the area calculator.

        Args:
            pdf_path: Path to the PDF file
            scale: Drawing scale (e.g., "1:100", "1:50")
            debug: Enable debug output with annotated images
        """
        self.pdf_path = pdf_path
        self.scale = self._parse_scale(scale)
        self.debug = debug

    def _parse_scale(self, scale_str: str) -> float:
        """Parse scale string like '1:100' to a multiplier."""
        try:
            if ':' in scale_str:
                parts = scale_str.split(':')
                return float(parts[1]) / float(parts[0])
            return 100.0  # Default to 1:100
        except:
            return 100.0

    def convert_pdf_to_image(self) -> np.ndarray:
        """Convert first page of PDF to OpenCV image."""
        try:
            # Convert PDF to images (first page only)
            images = convert_from_path(self.pdf_path, first_page=1, last_page=1, dpi=300)

            if not images:
                raise ValueError("Failed to convert PDF to image")

            # Convert PIL Image to OpenCV format
            img = np.array(images[0])
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

            return img
        except Exception as e:
            raise Exception(f"PDF conversion failed: {str(e)}")

    def detect_building_outline(self, img: np.ndarray) -> list:
        """
        Detect the building outline using edge detection and contour analysis.

        Returns:
            List of contour points representing the building outline
        """
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)

        # Dilate edges to connect broken lines
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=2)

        # Find contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return None

        # Find the largest contour (likely the building outline)
        largest_contour = max(contours, key=cv2.contourArea)

        # Approximate the contour to reduce points
        epsilon = 0.01 * cv2.arcLength(largest_contour, True)
        approx = cv2.approxPolyDP(largest_contour, epsilon, True)

        return approx

    def decompose_complex_shape(self, contour: np.ndarray) -> dict:
        """
        Decompose a complex shape into rectangles.

        Returns:
            Dictionary with shape type and rectangular sections
        """
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        total_area = cv2.contourArea(contour)
        bounding_area = w * h

        # Calculate how much the shape fills its bounding box
        fill_ratio = total_area / bounding_area if bounding_area > 0 else 0

        result = {
            'shape_type': 'unknown',
            'is_simple_rectangle': False,
            'sections': [],
            'total_area_pixels': total_area,
            'bounding_box': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
        }

        # Check if it's a simple rectangle (fill ratio > 0.95)
        if fill_ratio > 0.95:
            result['shape_type'] = 'rectangle'
            result['is_simple_rectangle'] = True
            result['sections'] = [{
                'name': 'main',
                'width_pixels': int(w),
                'height_pixels': int(h),
                'area_pixels': int(w * h)
            }]
            return result

        # For complex shapes, try to detect L, T, or U patterns
        # This is a simplified heuristic - could be expanded
        if 0.5 < fill_ratio <= 0.75:
            result['shape_type'] = 'L-shape (detected)'
            # For now, use the contour area directly
            # In production, you'd implement more sophisticated decomposition
            result['sections'] = [{
                'name': 'complex',
                'area_pixels': int(total_area),
                'note': 'Complex shape detected - manual decomposition recommended'
            }]
        else:
            result['shape_type'] = 'complex'
            result['sections'] = [{
                'name': 'complex',
                'area_pixels': int(total_area)
            }]

        return result

    def pixels_to_meters(self, pixels: float, dpi: float = 300) -> float:
        """
        Convert pixels to real-world meters based on scale and DPI.

        Args:
            pixels: Measurement in pixels
            dpi: Dots per inch (resolution of the image)

        Returns:
            Measurement in meters
        """
        # Convert pixels to inches
        inches = pixels / dpi

        # Convert inches to millimeters
        mm = inches * 25.4

        # Apply scale factor (e.g., for 1:100, multiply by 100)
        real_mm = mm * self.scale

        # Convert to meters
        meters = real_mm / 1000

        return meters

    def calculate_area(self) -> dict:
        """
        Main function to calculate building area.

        Returns:
            Dictionary with calculation results
        """
        try:
            # Convert PDF to image
            img = self.convert_pdf_to_image()

            # Detect building outline
            contour = self.detect_building_outline(img)

            if contour is None:
                return {
                    'success': False,
                    'error': 'Could not detect building outline',
                    'message': 'No clear building boundary found in the PDF'
                }

            # Decompose shape
            shape_info = self.decompose_complex_shape(contour)

            # Convert pixel measurements to meters
            for section in shape_info['sections']:
                if 'width_pixels' in section:
                    section['width_m'] = round(self.pixels_to_meters(section['width_pixels']), 2)
                    section['height_m'] = round(self.pixels_to_meters(section['height_pixels']), 2)
                    section['area_m2'] = round(section['width_m'] * section['height_m'], 2)
                if 'area_pixels' in section:
                    # For irregular shapes, convert total pixel area
                    pixels_per_m2 = (300 / 25.4 / self.scale) ** 2  # pixels per meter squared
                    section['area_m2'] = round(section['area_pixels'] / pixels_per_m2, 2)

            # Calculate total area
            total_area_m2 = sum(s.get('area_m2', 0) for s in shape_info['sections'])

            result = {
                'success': True,
                'shape_type': shape_info['shape_type'],
                'is_simple_rectangle': shape_info['is_simple_rectangle'],
                'sections': shape_info['sections'],
                'total_area_m2': round(total_area_m2, 2),
                'scale_used': f"1:{int(self.scale)}",
                'method': 'computer_vision',
                'confidence': 0.85 if shape_info['is_simple_rectangle'] else 0.65
            }

            # Save debug image if requested
            if self.debug:
                debug_img = img.copy()
                cv2.drawContours(debug_img, [contour], -1, (0, 255, 0), 3)
                cv2.imwrite('debug_outline.png', debug_img)
                result['debug_image'] = 'debug_outline.png'

            return result

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Area calculation failed'
            }


def main():
    """CLI interface for the area calculator."""
    parser = argparse.ArgumentParser(description='Calculate building area from PDF floor plans')
    parser.add_argument('pdf_path', help='Path to the PDF file')
    parser.add_argument('--scale', default='1:100', help='Drawing scale (e.g., 1:100)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()

    calculator = AreaCalculator(args.pdf_path, args.scale, args.debug)
    result = calculator.calculate_area()

    # Output as JSON for easy parsing by Node.js
    print(json.dumps(result, indent=2))

    return 0 if result['success'] else 1


if __name__ == '__main__':
    sys.exit(main())
