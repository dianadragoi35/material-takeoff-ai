
import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_PROMPT_TEMPLATE, RESPONSE_SCHEMA } from '../constants';
import type { AnalysisResult } from '../types';
import { checkPythonAvailability, calculateAreaWithPython, validateAreaCalculation } from './pythonBridge';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
};

export const analyzePdfWithGemini = async (allFiles: File[], targetIndex: number): Promise<AnalysisResult> => {
    const model = 'gemini-2.5-flash';

    // Convert all files to base64
    const allBase64 = await Promise.all(allFiles.map(file => fileToBase64(file)));

    const targetFileName = allFiles[targetIndex].name;
    const otherFileNames = allFiles
        .map((f, i) => i !== targetIndex ? `"${f.name}"` : null)
        .filter(Boolean)
        .join(', ');

    // Build the batch analysis prompt
    let batchPrompt = '';

    if (allFiles.length > 1) {
        batchPrompt = `
**BATCH ANALYSIS MODE - CROSS-REFERENCING ENABLED**

You have been provided with ${allFiles.length} PDF documents total. Your task is to analyze the TARGET document while having access to ALL other documents for cross-referencing.

TARGET DOCUMENT TO ANALYZE: "${targetFileName}" (Document #${targetIndex + 1})
REFERENCE DOCUMENTS AVAILABLE: ${otherFileNames || 'None'}

**CRITICAL INSTRUCTIONS FOR CROSS-REFERENCING:**

1. **Identify the target document**: Focus your analysis on "${targetFileName}" - this is the document you must extract data from and return results for.

2. **Use reference documents for context**: The other ${allFiles.length - 1} document(s) may contain:
   - Legends and material specifications
   - Detail drawings (e.g., "Detail 04", "SN-A", "D-01")
   - Material codes and buildups
   - Section cuts and construction layers
   - Dimension information

3. **Active cross-referencing strategy**:
   - If the target document shows a detail callout (e.g., a circle with "04", an L-shaped arrow with "D-01", or a reference like "zie detail A"), search for that exact reference in ALL other documents
   - If the target document shows material codes (DRL, ISO, TOP, etc.) without explanation, look for the legend in the other documents
   - If the target document shows areas but not materials, look for material specifications in the other documents
   - If the target document shows materials but lacks dimensions, look for dimensioned plans in the other documents

4. **Combine information intelligently**: Your final output should combine information from the target document WITH relevant information found in the reference documents to produce the most accurate material takeoff.

5. **Document your cross-references**: In the "notes" field for each material, mention if you used information from other documents (e.g., "Material code from legend in [filename]", "Area calculated from dimensions in [filename]", "Material buildup from Detail 04 in [filename]")

---
`;
    }

    const fullPrompt = batchPrompt + ANALYSIS_PROMPT_TEMPLATE;

    // Place target document LAST (after reference docs) so it's freshest in context
    const referenceIndices = allFiles.map((_, i) => i).filter(i => i !== targetIndex);
    const parts = [
        ...referenceIndices.map(i => ({
            inlineData: { mimeType: 'application/pdf', data: allBase64[i] },
        })),
        {
            inlineData: { mimeType: 'application/pdf', data: allBase64[targetIndex] },
        },
        { text: fullPrompt },
    ];


    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
            }
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error('API returned an empty response.');
        }

        const analysisResults: AnalysisResult = JSON.parse(responseText);

        // Attempt Python validation if available and if this is a roof-related document
        if (analysisResults.isRoofRelated && analysisResults.summary?.totalArea) {
            try {
                // Check if Python is available
                const pythonAvailable = await checkPythonAvailability();

                if (pythonAvailable) {
                    // Save the file temporarily for Python to process
                    // Note: In browser environment, we'd need to pass the file differently
                    // For now, this is a placeholder for the Node.js integration

                    // TODO: Implement file handling for Python bridge
                    // const pythonResult = await calculateAreaWithPython(filePath, analysisResults.scale);

                    // For now, mark that Python was not used
                    analysisResults.validation = {
                        pythonUsed: false,
                        validationMessage: 'Python validation available but requires server-side integration'
                    };
                } else {
                    analysisResults.validation = {
                        pythonUsed: false,
                        validationMessage: 'Python validation unavailable - install Python dependencies to enable'
                    };
                }
            } catch (error) {
                console.warn('Python validation failed:', error);
                analysisResults.validation = {
                    pythonUsed: false,
                    validationMessage: 'Python validation failed - using AI-only result'
                };
            }
        }

        return analysisResults;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API error: ${error.message}`);
        }
        throw new Error('An unknown error occurred during Gemini API call.');
    }
};
