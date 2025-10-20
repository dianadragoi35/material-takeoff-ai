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

The application follows a sequential analysis pipeline:

1. **File Upload** (`App.tsx:16-47`): Users upload PDF files (primary roof plans) and optional context files (legends, specifications)
2. **Context Accumulation** (`App.tsx:59-78`): When context mode is enabled, the app builds a contextual summary from previously analyzed roof-related documents to inform subsequent analyses
3. **AI Analysis** (`services/geminiService.ts:17-77`): Each PDF is sent to Gemini AI along with context files and accumulated context summary
4. **Results Consolidation** (`App.tsx:146-186`): Materials from multiple documents are aggregated by material type, calculating totals across all plans
5. **Export** (`App.tsx:100-144`): Results can be exported as JSON (full data) or CSV (materials only)

### Key Components

**`App.tsx`** - Main application component containing all UI and state management:
- Manages file uploads (primary plans and context documents)
- Orchestrates sequential PDF analysis with context passing
- Consolidates materials across multiple documents
- Renders results with consolidated summary and individual plan details

**`services/geminiService.ts`** - Gemini AI integration:
- Converts PDF files to base64 for API submission
- Constructs multi-document prompts (context files + main plan + text prompt)
- Uses structured output with `RESPONSE_SCHEMA` to ensure consistent JSON responses
- Uses `gemini-2.5-flash` model for analysis

**`constants.ts`** - AI prompt engineering and schema:
- `RESPONSE_SCHEMA`: Defines the structured JSON output format for Gemini
- `ANALYSIS_PROMPT_TEMPLATE`: Comprehensive 125+ line prompt with:
  - Instructions for identifying roof-related content anywhere in documents
  - Dutch-to-English construction terminology dictionary (40+ terms)
  - Material code mappings (DRL, ISO, TOP, OSG, BALG, etc.)
  - Area calculation strategies for different document types
  - Context integration instructions (uses `${contextSummary}` placeholder)

**`types.ts`** - TypeScript interfaces for the analysis pipeline

**`components/icons.tsx`** - SVG icon components (Upload, FileText, Download, etc.)

### Context-Aware Analysis Feature

The app implements a sophisticated context passing mechanism (`App.tsx:63-78`):

- When processing multiple files sequentially, information from previously analyzed **roof-related** documents is summarized
- This summary includes document type, scale, and materials found
- The accumulated context is injected into the prompt for subsequent analyses via the `${contextSummary}` placeholder
- This allows the AI to cross-reference materials, legends, and specifications across multiple documents
- Critical for workflows where legends/specs are on separate pages from floor plans

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
