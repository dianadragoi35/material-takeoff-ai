# Python Area Calculator Setup

The Material Takeoff AI now includes an **optional** Python-based area calculator that uses computer vision to detect building outlines and calculate precise areas. This is a hybrid approach where:

- **AI (Gemini)** extracts materials, identifies roof types, and understands the document
- **Python (OpenCV)** validates and calculates areas using image processing

## Why Use Python Area Calculation?

✅ **More Accurate**: Uses actual pixel measurements and contour detection
✅ **Shape Detection**: Automatically detects L, T, U shapes without manual decomposition
✅ **Validation**: Cross-checks AI calculations for accuracy
✅ **Consistent**: Same calculation method every time

⚠️ **Note**: This is optional. The app works fine with AI-only calculations.

## Installation

### 1. Install System Dependencies

#### macOS
```bash
# Install poppler (required for PDF processing)
brew install poppler
```

#### Ubuntu/Debian Linux
```bash
# Install poppler
sudo apt-get update
sudo apt-get install poppler-utils
```

#### Windows
```bash
# Download and install poppler from:
# https://github.com/oschwartz10612/poppler-windows/releases/

# Add poppler bin folder to PATH (e.g., C:\poppler\bin)
```

### 2. Set Up Python Virtual Environment (Recommended)

Using a virtual environment keeps your Python dependencies isolated and prevents conflicts:

```bash
# Navigate to project directory
cd /path/to/material-takeoff-ai

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate

# Windows (Command Prompt):
venv\Scripts\activate.bat

# Windows (PowerShell):
venv\Scripts\Activate.ps1

# Install Python packages in the virtual environment
pip install -r requirements.txt

# Verify installation
python -c "import cv2, pdf2image, numpy; print('✅ All packages installed successfully!')"
```

**Important**: Remember to activate the virtual environment whenever you work on the project:
```bash
# macOS/Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

### Alternative: Global Installation (Not Recommended)

```bash
# Install directly to system Python (may cause conflicts)
pip3 install -r requirements.txt
```

⚠️ **Why use venv?**
- Isolates project dependencies
- Prevents version conflicts with other Python projects
- Makes it easy to reproduce the environment
- Can be deleted and recreated anytime without affecting system Python

### 2. Verify Installation

Test that the Python script works:

```bash
python3 services/areaCalculator.py <path-to-test-pdf> --scale "1:100" --debug
```

If successful, you'll see JSON output with the calculated area.

### 3. Test Integration

The app will automatically detect if Python is available. Check the console when running the app:

```bash
npm run dev
```

Look for a message like:
- ✅ `"Python area calculator available"`
- ⚠️ `"Python area calculator not available - using AI-only mode"`

## How It Works

### Hybrid Calculation Flow

1. **Upload PDFs** → User uploads construction documents
2. **AI Analysis** → Gemini analyzes PDF, extracts materials, dimensions, and calculates area
3. **Python Validation** → Python script:
   - Converts PDF to high-res image
   - Uses edge detection (Canny) to find building outline
   - Detects contours and finds the largest (building perimeter)
   - Classifies shape (rectangle, L-shape, complex)
   - Calculates pixel area and converts to m² using scale
4. **Comparison** → System compares AI vs Python results:
   - If within 15% tolerance → Use AI result (validated ✅)
   - If Python finds different shape → Use Python result
   - If large discrepancy → Flag for manual review
5. **Output** → User sees the validated area with confidence score

### Python Script Features

**Shape Detection:**
- Simple rectangles (high confidence)
- L-shapes (detected automatically)
- Complex/irregular shapes (flagged for review)

**Area Calculation:**
- Pixel-based measurement
- Scale conversion (1:50, 1:100, 1:200, etc.)
- DPI-aware (300 DPI default)

**Output Format:**
```json
{
  "success": true,
  "shape_type": "L-shape (detected)",
  "is_simple_rectangle": false,
  "total_area_m2": 252.5,
  "confidence": 0.85,
  "sections": [
    {
      "name": "main",
      "width_m": 20.0,
      "height_m": 9.0,
      "area_m2": 180.0
    },
    {
      "name": "wing",
      "width_m": 12.0,
      "height_m": 6.0,
      "area_m2": 72.0
    }
  ]
}
```

## Troubleshooting

### Python script fails with "ModuleNotFoundError"
```bash
# Reinstall dependencies
pip3 install -r requirements.txt
```

### "poppler not found" error
- **macOS**: `brew install poppler`
- **Linux**: `sudo apt-get install poppler-utils`
- **Windows**: Download poppler and add to PATH

### Python not detected by Node.js
```bash
# Check Python is in PATH
python3 --version

# Check packages installed
python3 -c "import cv2, pdf2image, numpy; print('OK')"
```

### Debug mode not working
```bash
# Run with debug flag to save annotated image
python3 services/areaCalculator.py test.pdf --debug

# Check for debug_outline.png in current directory
```

## Configuration

### Adjust Tolerance

Edit `services/pythonBridge.ts` to change validation tolerance:

```typescript
// Default: 15% difference allowed
export function validateAreaCalculation(
    aiArea: number,
    pythonResult: PythonAreaResult,
    tolerancePercent: number = 15  // ← Change this
)
```

### Disable Python Validation

If you want to disable Python validation temporarily, the app will automatically fall back to AI-only mode if Python is not available.

## Performance

- **PDF Conversion**: ~2-3 seconds per page
- **Shape Detection**: ~1-2 seconds
- **Total Overhead**: ~3-5 seconds per document

The Python validation runs **in parallel** with AI analysis where possible to minimize total processing time.

## Future Enhancements

Potential improvements to the Python calculator:

- [ ] More sophisticated L/T/U shape decomposition
- [ ] Dimension OCR to extract measurements from the plan
- [ ] Multi-page support for detail sheets
- [ ] Pitched roof area calculation (not just footprint)
- [ ] Export of detected outlines for visualization

## Support

If you encounter issues with the Python area calculator:

1. Check this setup guide
2. Run the test command with `--debug` flag
3. Review the generated `debug_outline.png` to see what the script detected
4. The app will work fine without Python - it's an enhancement, not a requirement
