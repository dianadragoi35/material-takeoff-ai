
import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_PROMPT_TEMPLATE, RESPONSE_SCHEMA } from '../constants';
import type { AnalysisResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });
};

export const analyzePdfWithGemini = async (planFile: File, contextFiles: File[], contextSummary: string): Promise<AnalysisResult> => {
    const model = 'gemini-2.5-flash';

    const filePromises = [planFile, ...contextFiles].map(file => fileToBase64(file));
    const [planBase64, ...contextBase64] = await Promise.all(filePromises);

    let prompt = ANALYSIS_PROMPT_TEMPLATE.replace('${contextSummary}', contextSummary);
    let contextPrompt = '';

    if (contextFiles.length > 0) {
        contextPrompt = `
You have been provided with ${contextFiles.length} separate context document(s) in addition to the main plan PDF being analyzed. These documents contain essential information like legends, material specifications, and detail cross-references (e.g., a number like '04' on a facade view pointing to a detailed drawing on another page).

**CRITICAL INSTRUCTION: USE THE CONTEXT FILES**
1.  **First, thoroughly analyze ALL provided context documents.** These are your primary source of truth for materials, codes, and details.
2.  **Then, analyze the main plan PDF.**
3.  **Cross-reference information.** Use the context documents to interpret the main plan. For example, if the main plan shows a code "04" or a detail callout on the roof (often indicated by an L-shaped arrow, circle, or box with a reference code), you MUST find the corresponding drawing labeled "04" or with the same code in the context documents. This will give you the precise material buildup and is the most accurate way to perform the takeoff.

---
`;
    }
    
    const fullPrompt = contextPrompt + prompt;
    
    const parts = [
        ...contextBase64.map(data => ({
            inlineData: { mimeType: 'application/pdf', data },
        })),
        {
            inlineData: { mimeType: 'application/pdf', data: planBase64 },
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

        const analysisResults = JSON.parse(responseText);
        return analysisResults as AnalysisResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini API error: ${error.message}`);
        }
        throw new Error('An unknown error occurred during Gemini API call.');
    }
};
