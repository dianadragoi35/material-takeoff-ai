# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Python 3.8+ installed
- Poppler installed (for PDF processing)
  ```bash
  # macOS
  brew install poppler
  ```

## Installation

### 1. Install Dependencies

```bash
# Install Node.js dependencies (frontend + backend)
npm install

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate     # Windows

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env.local` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Running the Application

### Option 1: Run Both Servers Together (Recommended)

```bash
npm run dev:all
```

This starts:
- Frontend (Vite): `http://localhost:5173`
- Backend API: `http://localhost:3001`

### Option 2: Run Servers Separately

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Verify Python Integration

Once both servers are running:

1. Open `http://localhost:5173` in your browser
2. Look for the status badge at the top
3. You should see: **"Python CV validation enabled ✅"**

If you see "Python validation unavailable":
- Make sure the backend server is running on port 3001
- Check the browser console for connection errors
- Verify Python dependencies are installed in the venv

## Testing

Upload a PDF construction plan and the app will:
1. ✅ Analyze it with Gemini AI
2. ✅ Validate the area calculation with Python computer vision
3. ✅ Show both results with comparison badges

## Troubleshooting

### "Backend server not reachable"
- Ensure `npm run dev:backend` is running
- Check that port 3001 is not blocked

### "Python calculation failed"
- Verify virtual environment is activated when running the backend
- Check that `venv/bin/python3` exists
- Verify all Python packages are installed: `pip list`

### "Poppler not found"
```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils
```

## Port Configuration

If you need to change ports:

1. **Backend port** - Edit `server.js:17`: `const PORT = 3001;`
2. **Frontend API URL** - Edit `services/pythonBridge.ts:9`: `const BACKEND_API_URL = 'http://localhost:3001/api/python';`
3. **CORS origins** - Edit `server.js:25-28` to allow your new frontend port

## Next Steps

- See [README.md](README.md) for feature documentation
- See [PYTHON_SETUP.md](PYTHON_SETUP.md) for detailed Python setup
- See [CLAUDE.md](CLAUDE.md) for architecture details
