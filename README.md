<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Material Takeoff AI

AI-powered construction material takeoff tool that analyzes PDF blueprints and extracts roofing materials, quantities, and areas using Google's Gemini AI.

## Features

- **Intelligent PDF Analysis**: Analyzes construction plans, roof plans, floor plans, and specifications
- **Cross-Document Referencing**: Automatically links detail callouts, legends, and material codes across multiple PDFs
- **Hybrid Area Calculation**: Combines AI analysis with optional Python computer vision for maximum accuracy
  - AI performs sophisticated shape decomposition (L, T, U shapes)
  - Python OpenCV validates results using edge detection and contour analysis
  - Automatic validation with configurable tolerance
- **Multilingual Support**: Handles both Dutch and English construction documents with extensive terminology dictionary
- **Material Consolidation**: Aggregates materials across multiple documents with confidence scoring
- **Export Options**: Export results as JSON or CSV for further processing

## Tech Stack

### Frontend
- **React 19.2.0** - UI framework
- **TypeScript 5.8.2** - Type-safe development
- **Vite 6.2.0** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS (inline classes)

### AI & API
- **Google Gemini 2.5 Flash** - Multimodal AI model for PDF analysis
- **@google/genai 1.25.0** - Official Gemini AI SDK

### Python (Optional Enhancement)
- **Python 3.8+** - For computer vision area calculation
- **OpenCV (cv2)** - Edge detection and contour analysis
- **pdf2image** - PDF to image conversion
- **NumPy** - Numerical computations

## Run Locally

**Prerequisites:**  Node.js (v18 or higher recommended)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev:all
   ```

## Optional: Python Area Calculator (Automatic When Available)

The app **automatically uses Python validation** when it's installed. No configuration needed!

For enhanced area calculation accuracy using computer vision:

### Install System Dependencies

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils
```

### Set Up Python Virtual Environment (Recommended)

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### Alternative: Global Installation

```bash
# Install directly (not recommended for production)
pip3 install -r requirements.txt
```

See [PYTHON_SETUP.md](PYTHON_SETUP.md) for detailed instructions and troubleshooting.

### How It Works

Once Python is installed, the app **automatically**:
1. ✅ Detects Python availability on startup
2. ✅ Shows a green status badge: "Python CV validation enabled"
3. ✅ Validates every roof area calculation
4. ✅ Shows validation results in each document card
5. ✅ Indicates if Python or AI result was used

You'll see badges like:
- `[PYTHON CV]` - Computer vision used ✅
- `[AI ONLY]` - AI-only mode (Python not available)

**Note**: The app works fine without Python - this is an optional enhancement for validation.

## Build for Production

```bash
npm run build
npm run preview
```
