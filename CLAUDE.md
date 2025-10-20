# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Material Takeoff AI** application that uses Google's Gemini AI to analyze construction PDF documents (primarily roof plans) and extract material quantities for construction estimating. The app is built with React, TypeScript, and Vite, and uses the `@google/genai` SDK for AI-powered document analysis.

The application specializes in analyzing Dutch and English construction documents, with particular expertise in identifying roof-related materials, scales, and quantities from blueprints.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

The application requires a Gemini API key to function:

1. Set `GEMINI_API_KEY` in `.env.local` file
2. The Vite config maps this to `process.env.API_KEY` used by `geminiService.ts:6`

## Architecture

### Core Data Flow

The application follows a batch analysis pipeline with intelligent cross-referencing:

1. **File Upload** (`App.tsx:14-34`): Users upload ALL related PDF files together (floor plans, roof plans, legends, specifications, detail sheets)
2. **Batch Analysis** (`App.tsx:36-65`): Each file is analyzed sequentially, but with access to ALL other files for cross-referencing
3. **AI Analysis with Cross-Referencing** (`services/geminiService.ts:17-105`):
   - For each target file, the AI receives ALL files in the batch
   - Reference files are sent first, target file is sent last (freshest in context)
   - The AI actively searches for detail callouts, legends, and material codes across all files
   - Results include notes documenting which files were cross-referenced
4. **Results Consolidation** (`App.tsx:110-151`): Materials from multiple documents are aggregated by material type, calculating totals across all plans
5. **Export** (`App.tsx:67-109`): Results can be exported as JSON (full data) or CSV (materials only)

### Key Components

**`App.tsx`** - Main application component containing all UI and state management:
- Single file upload interface for all related documents
- Orchestrates batch analysis: each file analyzed with access to all other files
- Consolidates materials across multiple documents
- Renders results with consolidated summary and individual plan details

**`services/geminiService.ts`** - Gemini AI integration with intelligent cross-referencing:
- Converts all PDF files to base64 for API submission
- Implements batch analysis mode (`geminiService.ts:32-63`):
  - Sends reference documents first, target document last
  - Provides explicit instructions on which file to analyze vs. which to use for reference
  - Instructs AI to actively search for detail callouts (e.g., "04", "D-01") across all files
  - Directs AI to cross-reference legends, material codes, and specifications
- Uses structured output with `RESPONSE_SCHEMA` to ensure consistent JSON responses
- Uses `gemini-2.5-flash` model for analysis

**`constants.ts`** - AI prompt engineering and schema:
- `RESPONSE_SCHEMA`: Defines the structured JSON output format for Gemini
- `ANALYSIS_PROMPT_TEMPLATE`: Comprehensive 190+ line prompt with:
  - Instructions for identifying roof-related content anywhere in documents
  - Dutch-to-English construction terminology dictionary (40+ terms)
  - Material code mappings (DRL, ISO, TOP, OSG, BALG, etc.)
  - **Advanced 6-step area calculation methodology for complex roof shapes** (`constants.ts:106-170`)
  - Context integration instructions (uses `${contextSummary}` placeholder)

**`types.ts`** - TypeScript interfaces for the analysis pipeline

**`components/icons.tsx`** - SVG icon components (Upload, FileText, Download, etc.)

### Batch Analysis with Cross-Referencing

The app implements intelligent cross-referencing for multi-document analysis (`services/geminiService.ts:32-78`):

**How it works:**
- User uploads ALL related documents together (plans, legends, details, specs)
- Each document is analyzed as a "target" while ALL other documents are available as "references"
- The AI is explicitly instructed to:
  - Identify the target document to extract data from
  - Search other documents for legends, material codes, and specifications
  - Find detail callouts (e.g., circles with "04", L-shaped arrows with "D-01") and locate the corresponding details in other files
  - Document cross-references in the `notes` field (e.g., "Material buildup from Detail 04 in [filename]")

**Why this approach:**
- Construction plans often split information across multiple sheets (legend on one, plan on another, details on a third)
- Detail callouts on plans must be matched to detail drawings on other sheets
- Material codes need to be cross-referenced with legend sheets
- This batch approach ensures the AI can "see" all information simultaneously when analyzing each file

### Hybrid Area Calculation System

The application uses a **hybrid approach** combining AI analysis with optional Python computer vision:

**Primary Method - AI Analysis** (`constants.ts:106-280`):
- Sophisticated 6-step methodology for area calculation
- Visual shape recognition with explicit instructions for L, T, U shapes
- Mandatory shape identification before calculation
- Detailed decomposition examples and validation

**Optional - Python CV Validation** (`services/areaCalculator.py`, `services/pythonBridge.ts`):
- Computer vision using OpenCV for shape detection
- Automatic building outline extraction from PDFs
- Pixel-based area calculation with scale conversion
- Validates AI results with 15% tolerance threshold
- If discrepancy detected, recommends which result to use

### Advanced Area Calculation for Complex Roof Shapes

The AI uses a sophisticated methodology for accurately calculating roof areas (`constants.ts:106-280`):

1. **Shape Identification**: Recognizes simple rectangles, L-shapes, T-shapes, U-shapes, and complex polygons
2. **Decomposition Strategy**: Breaks complex shapes into simpler rectangular sections
   - L-shaped roofs → 2 rectangles
   - T-shaped roofs → 3 rectangles (central + 2 wings)
   - U-shaped roofs → 3 rectangles forming the U
   - Roofs with courtyards → outer area minus cutout area(s)
3. **Dimension Extraction**: Reads dimension lines, grid labels, or uses drawing scale
4. **Calculation Method**: Shows work in the `notes` field with explicit formulas
5. **Validation**: Checks if calculated area makes sense for the building type
6. **Multiple Materials**: Creates separate entries for different sections with different materials

Example calculation shown in notes: `"L-shape: Section A (15m × 8m = 120m²) + Section B (10m × 6m = 60m²) = 180m²"`

This approach ensures accurate area calculations even for complex building geometries by decomposing them into measurable sections rather than estimating the entire area at once.

### Material Consolidation Logic

The consolidation algorithm (`App.tsx:150-175`) uses case-insensitive material name matching to group materials across multiple documents:
- Materials with the same name (case-insensitive, trimmed) are combined
- Areas are summed
- Confidence scores are averaged across sources
- Source files are tracked for traceability

## Important Notes

- The app uses Tailwind CSS utility classes inline (no separate CSS files)
- All icons are custom SVG components, not an icon library
- The Gemini API expects PDFs as base64-encoded inline data with `application/pdf` mime type
- The `RESPONSE_SCHEMA` uses `@google/genai` Type enum, not standard JSON Schema types
- Error handling in `geminiService.ts:70-76` catches API errors and re-throws with context
- The app distinguishes between "roof-related" and non-roof-related documents, only including roof documents in consolidated summaries
