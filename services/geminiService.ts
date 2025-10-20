
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

export const analyzePdfWithGemini = async (file: File, contextSummary: string): Promise<AnalysisResult> => {
    const base64Data = await fileToBase64(file);
    const model = 'gemini-2.5-flash';

    const prompt = ANALYSIS_PROMPT_TEMPLATE.replace('${contextSummary}', contextSummary);

    const pdfPart = {
        inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
        },
    };

    const textPart = {
        text: prompt,
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [pdfPart, textPart] },
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
