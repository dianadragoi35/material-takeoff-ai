/**
 * Python Bridge Service - Browser to Backend Bridge
 *
 * This service connects the React frontend to the Node.js backend server
 * which executes Python area calculation scripts.
 *
 * Backend server must be running on http://localhost:3001
 */

// Backend API base URL - change this if your backend runs on a different port
const BACKEND_API_URL = 'http://localhost:3001/api/python';

export interface PythonAreaResult {
    success: boolean;
    shape_type?: string;
    is_simple_rectangle?: boolean;
    sections?: Array<{
        name: string;
        width_m?: number;
        height_m?: number;
        area_m2?: number;
        note?: string;
    }>;
    total_area_m2?: number;
    scale_used?: string;
    method?: string;
    confidence?: number;
    error?: string;
    message?: string;
}

/**
 * Check if Python validation is available via backend API
 * Performs a health check against the backend server
 */
export async function checkPythonAvailability(): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_API_URL}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn('Python health check failed:', response.status);
            return false;
        }

        const data = await response.json();
        return data.status === 'ok' && data.python === 'available';
    } catch (error) {
        console.warn('Backend server not reachable:', error);
        return false;
    }
}

/**
 * Calculate area using Python computer vision via backend API
 *
 * @param file PDF file to analyze
 * @param scale Drawing scale (e.g., "1:100")
 * @returns Area calculation result
 */
export async function calculateAreaWithPython(
    file: File,
    scale: string = "1:100"
): Promise<PythonAreaResult> {
    try {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('scale', scale);

        const response = await fetch(`${BACKEND_API_URL}/calculate-area`, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.error || 'Unknown error',
                message: result.message || `Backend returned status ${response.status}`
            };
        }

        return result;
    } catch (error) {
        console.error('Python calculation request failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Failed to connect to backend server. Make sure the backend is running on port 3001.'
        };
    }
}

/**
 * Format Python calculation results for display
 */
export function formatPythonResult(result: PythonAreaResult): string {
    if (!result.success) {
        return `Python calculation failed: ${result.message || result.error}`;
    }

    let formatted = `Shape detected: ${result.shape_type}\n`;
    formatted += `Total area: ${result.total_area_m2?.toFixed(2)} m²\n`;
    formatted += `Confidence: ${((result.confidence || 0) * 100).toFixed(0)}%\n`;

    if (result.sections && result.sections.length > 0) {
        formatted += '\nSections:\n';
        result.sections.forEach((section, idx) => {
            if (section.width_m && section.height_m) {
                formatted += `  ${idx + 1}. ${section.name}: ${section.width_m}m × ${section.height_m}m = ${section.area_m2}m²\n`;
            } else if (section.area_m2) {
                formatted += `  ${idx + 1}. ${section.name}: ${section.area_m2}m²\n`;
            }
            if (section.note) {
                formatted += `     Note: ${section.note}\n`;
            }
        });
    }

    return formatted;
}

/**
 * Validate AI-calculated area against Python calculation
 * @param aiArea Area calculated by AI
 * @param pythonResult Python calculation result
 * @param tolerancePercent Acceptable difference percentage
 * @returns Validation result with recommendations
 */
export function validateAreaCalculation(
    aiArea: number,
    pythonResult: PythonAreaResult,
    tolerancePercent: number = 15
): {
    isValid: boolean;
    pythonArea: number;
    difference: number;
    differencePercent: number;
    recommendation: 'use_ai' | 'use_python' | 'manual_review';
    message: string;
} {
    if (!pythonResult.success || !pythonResult.total_area_m2) {
        return {
            isValid: true,
            pythonArea: 0,
            difference: 0,
            differencePercent: 0,
            recommendation: 'use_ai',
            message: 'Python calculation unavailable, using AI result'
        };
    }

    const pythonArea = pythonResult.total_area_m2;
    const difference = Math.abs(aiArea - pythonArea);
    const differencePercent = (difference / pythonArea) * 100;

    if (differencePercent <= tolerancePercent) {
        return {
            isValid: true,
            pythonArea,
            difference,
            differencePercent,
            recommendation: 'use_ai',
            message: `AI calculation validated (${differencePercent.toFixed(1)}% difference)`
        };
    }

    // If Python detected a simple rectangle and AI didn't decompose, trust Python
    if (pythonResult.is_simple_rectangle) {
        return {
            isValid: false,
            pythonArea,
            difference,
            differencePercent,
            recommendation: 'use_python',
            message: `Python detected simple rectangle. AI may have over-complicated. Difference: ${differencePercent.toFixed(1)}%`
        };
    }

    // If Python detected complex shape but AI calculated simple area
    if (!pythonResult.is_simple_rectangle && differencePercent > 20) {
        return {
            isValid: false,
            pythonArea,
            difference,
            differencePercent,
            recommendation: 'use_python',
            message: `Significant difference (${differencePercent.toFixed(1)}%). Python detected ${pythonResult.shape_type}. Recommend using Python result.`
        };
    }

    return {
        isValid: false,
        pythonArea,
        difference,
        differencePercent,
        recommendation: 'manual_review',
        message: `Difference ${differencePercent.toFixed(1)}% exceeds tolerance. Manual review recommended.`
    };
}
