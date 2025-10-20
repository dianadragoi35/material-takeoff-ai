/**
 * Backend Server for Python Area Calculator Integration
 *
 * This Express server provides API endpoints for the frontend to use Python
 * computer vision area calculation.
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3001; // Backend runs on different port than Vite dev server

// Python executable - use venv if it exists, fallback to system python3
const PYTHON_CMD = fs.existsSync(path.join(__dirname, 'venv', 'bin', 'python3'))
    ? path.join(__dirname, 'venv', 'bin', 'python3')
    : 'python3';

// Configure CORS to allow requests from Vite dev server
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));

app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    dest: path.join(os.tmpdir(), 'material-takeoff-uploads'),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max file size
    }
});

/**
 * Health check endpoint - verifies Python and dependencies are available
 */
app.get('/api/python/health', async (req, res) => {
    try {
        // Check if Python is available
        const pythonProcess = spawn(PYTHON_CMD, ['--version']);

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                res.json({
                    status: 'ok',
                    python: 'available',
                    message: 'Python validation service is ready'
                });
            } else {
                res.status(503).json({
                    status: 'error',
                    python: 'unavailable',
                    message: 'Python is not installed or not in PATH'
                });
            }
        });

        pythonProcess.on('error', (error) => {
            res.status(503).json({
                status: 'error',
                python: 'unavailable',
                message: error.message
            });
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: error.message
        });
    }
});

/**
 * Calculate area using Python computer vision
 */
app.post('/api/python/calculate-area', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded',
            message: 'Please provide a PDF file'
        });
    }

    const tempFilePath = req.file.path;
    const scale = req.body.scale || '1:100';

    try {
        // Path to Python script
        const pythonScriptPath = path.join(__dirname, 'services', 'areaCalculator.py');

        // Run Python script with arguments
        const pythonProcess = spawn(PYTHON_CMD, [
            pythonScriptPath,
            tempFilePath,
            '--scale', scale,
            '--format', 'json'
        ]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Clean up temp file
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error('Failed to delete temp file:', err);
            });

            if (code !== 0) {
                console.error('Python script error:', stderr);
                return res.status(500).json({
                    success: false,
                    error: 'Python script execution failed',
                    message: stderr || 'Unknown error occurred',
                    exitCode: code
                });
            }

            try {
                // Parse JSON output from Python script
                const result = JSON.parse(stdout);
                res.json(result);
            } catch (parseError) {
                console.error('Failed to parse Python output:', stdout);
                res.status(500).json({
                    success: false,
                    error: 'Invalid JSON response from Python',
                    message: parseError.message,
                    pythonOutput: stdout
                });
            }
        });

        pythonProcess.on('error', (error) => {
            // Clean up temp file
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error('Failed to delete temp file:', err);
            });

            res.status(500).json({
                success: false,
                error: 'Failed to start Python process',
                message: error.message
            });
        });

    } catch (error) {
        // Clean up temp file
        fs.unlink(tempFilePath, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });

        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Server error occurred'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        error: error.message,
        message: 'Internal server error'
    });
});

app.listen(PORT, () => {
    console.log(`✅ Backend server running on http://localhost:${PORT}`);
    console.log(`🐍 Python validation API available at http://localhost:${PORT}/api/python`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/python/health`);
});
