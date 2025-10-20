
import { Type } from "@google/genai";

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isRoofRelated: { type: Type.BOOLEAN, description: "True if the document contains any roof-related information." },
    documentType: { type: Type.STRING, description: "A brief description of the document's content (e.g., 'floor plan with roof legend')." },
    language: { type: Type.STRING, description: "Detected language (e.g., 'Dutch', 'English', 'Mixed')." },
    scale: { type: Type.STRING, description: "Detected drawing scale (e.g., '1:100') or 'not found'." },
    materials: {
      type: Type.ARRAY,
      description: "A list of identified roofing materials.",
      items: {
        type: Type.OBJECT,
        properties: {
          material: { type: Type.STRING, description: "Name of the material in English." },
          code: { type: Type.STRING, description: "Dutch material code if visible (e.g., 'DRL', 'ISO') or an empty string." },
          area: { type: Type.NUMBER, description: "Calculated area in square meters. Must be calculated from dimensions if available." },
          unit: { type: Type.STRING, description: "Unit of measurement, typically 'm²'." },
          confidence: { type: Type.NUMBER, description: "Confidence score from 0 to 1." },
          notes: { type: Type.STRING, description: "Notes about the material, its location, or calculation method." },
        },
        required: ["material", "code", "area", "unit", "confidence", "notes"],
      },
    },
    summary: {
      type: Type.OBJECT,
      description: "A summary of the analysis.",
      properties: {
        totalArea: { type: Type.NUMBER, description: "Total calculated area in square meters." },
        materialCount: { type: Type.INTEGER, description: "Number of unique materials found." },
        planQuality: { type: Type.STRING, enum: ["good", "fair", "poor"], description: "Overall quality of the plan for takeoff." },
      },
      required: ["totalArea", "materialCount", "planQuality"],
    },
  },
  required: ["isRoofRelated", "documentType", "language", "scale", "materials", "summary"],
};

export const ANALYSIS_PROMPT_TEMPLATE = `You are an expert construction estimator analyzing a construction plan PDF. Your task is to:

1. FIRST, carefully examine the ENTIRE document including all legends, material lists, notes, and annotations at the bottom and sides.
2. Determine if this PDF contains ANY roof-related information anywhere in the document.
3. If it IS roof-related, perform a material takeoff by identifying roofing materials and calculating their quantities.
4. If it is NOT roof-related, indicate this clearly.

IMPORTANT: The blueprints may be in DUTCH or English. Please recognize Dutch roof-related terminology and translate material names to English in your output.

CRITICAL INSTRUCTION - LOOK EVERYWHERE FOR ROOF INFO:
- Check ALL legends at the bottom, top, and sides of the document.
- Look at material lists ("LEGENDA MATERIALEN" or similar).
- Examine all text annotations and labels.
- Roof information can appear ANYWHERE in floor plans, sections, elevations, or details.
- Even a single mention of a roof type means this is roof-related.

Common Dutch roof terms to look for (CHECK LEGENDS CAREFULLY):
- "dak" = roof (ANY word containing "dak")
- "retentiedak" = retention roof / green roof ⚠️ IMPORTANT
- "groendak" = green roof
- "sedumdak" = sedum roof
- "platdak" = flat roof
- "hellend dak" = pitched roof
- "dakplan" = roof plan
- "dakbedekking" = roof covering
- "bitumen" or "bitumineus" = bitumen
- "EPDM" = EPDM membrane
- "PVC dakbaan" = PVC roofing membrane
- "pannendak" = tile roof
- "dakpannen" = roof tiles
- "zinken goot" = zinc gutter
- "isolatie" = insulation
- "dampremmende laag" = vapor barrier
- "dakopbouw" = roof construction
- "waterdichte laag" = waterproof layer
- "grindballast" = gravel ballast (often on flat roofs)
- "dakveiligheid" = roof safety

Common Dutch roof construction codes and layers:
- "DRL" = PE folie (PE foil - waterproofing layer)
- "ISO" = Isolatie (Insulation)
- "OND" = Onderlaag (Underlayer)
- "TOP" = Toplaag (Top layer)
- "OSG" = Opstand tpv gevel/dakluik (Upstands at roof level)
- "OSA" = Opstand dakrand tpv afdekkap (Roof edge upstand)
- "DR-A" = Dakrandafwerking (Roof edge finishing)
- "OST" = Opstand dakrand tpv trim (Roof edge trim)
- "DR-T" = Daktrim (Roof trim)
- "BALG" = Ballastlaag grind (Gravel ballast layer)
- "DRH" = Buitenhoekstuk/Binnenhoekstuk (Exterior/Interior corner pieces)
- "ONT" = Ontluchtingen (Vents)
- "HWA" = Hemelwaterafvoer (Rainwater drainage)
- "NO" = Noodoverloop (Emergency overflow)
- "BALT/BALL/BALW" = Drentegels (Drainage tiles)
- "POER" = Poeren inwerken balustrade (Foundation work for balustrade)
- "Kanaalplaat" = Channel slab (structural element)

SEARCH STRATEGY:
1. First, scan the ENTIRE document for any text containing "dak" (roof).
2. Check the legend sections carefully - usually at the bottom of the page.
3. Look for material specification tables with codes like DRL, ISO, TOP, OSG, BALG, etc.
4. Look for material symbols/hatching that might indicate roof materials.
5. Even if this is labeled as a floor plan ("plattegrond"), section, or elevation, if ANY roof material is mentioned, mark as roof-related.
6. Check for specification tables listing roof construction layers (these are VERY important for material identification).
7. CROSS-REFERENCING WITH CONTEXT FILES: If there are context documents provided, actively look for detail callouts on the main plan. These are often marked with L-shaped arrows, circles, or boxes with a code (e.g., 'D-01', 'SN-A', 'Detail A'). You MUST find the corresponding detail in the context files to determine the exact material buildup. This is the most reliable source of information.
8. IMPORTANT FOR AREA CALCULATION:
   - If this is a floor plan showing "retentiedak", "platdak", "groendak" or any flat roof type in the legend, measure the outer dimensions of the building footprint.
   - Calculate the total building area - this is your roof area for flat roofs. Flat roofs typically cover the entire building, so building footprint = roof area.
   - Look for dimension lines, scale bars, or grid dimensions to calculate accurately.
   - Use the scale (e.g., 1:100) to convert drawing measurements to real-world m².
   - For specification tables showing roof materials: extract the materials but note that areas must come from floor plans or roof plans.
\${contextSummary}

Please analyze this PDF and respond with ONLY a valid JSON object matching the provided schema. Do not include any additional text, explanations, or markdown.

Guidelines:
- CRITICAL: If the document contains ANY roof type information ANYWHERE (in legends, labels, annotations, material lists, or notes), set "isRoofRelated" to true.
- ALWAYS extract and include the Dutch material code (DRL, ISO, TOP, BALG, OSG, DR-A, etc.) in the "code" field if visible in the document.
- AREA CALCULATION STRATEGY:
  * For dedicated roof plans: measure the roof areas directly.
  * For floor plans with roof legends: use the building footprint area as the roof area estimate (flat roofs typically cover the entire building).
  * If you can see the building dimensions and a flat roof type is indicated, calculate the roof area from those dimensions.
  * Only use area=0 if the document is purely text/specifications with no measurable dimensions.
- If previous documents contained material specifications and this document shows areas, try to match them together.
- Translate ALL Dutch material names to English in your output.
- For flat roofs (platdak, retentiedak, groendak), the roof area typically equals the building footprint area - calculate this if dimensions are visible.
`;
