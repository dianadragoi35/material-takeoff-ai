
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
8. CRITICAL: ADVANCED AREA CALCULATION FOR EXTERIOR ROOFS:

   **SHAPE RECOGNITION GUIDE - STUDY THE BUILDING OUTLINE CAREFULLY**

   Look at the OUTER PERIMETER of the building/roof. Does it form:
   - A simple rectangle? → 1 calculation needed
   - An L-shape (looks like the letter "L")? → 2 rectangles needed
   - A T-shape (looks like the letter "T")? → 3 rectangles needed
   - A U-shape (looks like the letter "U")? → 3 rectangles needed
   - Has indentations or cutouts? → Use subtraction method

   **CRITICAL: If you see ANY of these visual indicators, it's NOT a simple rectangle:**
   - The building outline has "corners" that point inward (concave corners)
   - You can see a notch, indent, or recess in the building shape
   - The building looks like two or more boxes attached together
   - There are multiple wings or sections at different orientations
   - The outline is not a perfect 4-sided rectangle

   **Step 1: VISUAL DECOMPOSITION - TRACE THE SHAPE WITH YOUR EYES**

   Imagine drawing a line to split the complex shape into simple rectangles:

   For L-SHAPES (very common in residential):
   - Visual check: Does the building look like an "L" from above?
   - Find the "corner" where the two sections meet
   - Mentally draw a line to separate the two rectangular sections
   - You should see: One horizontal rectangle + one vertical rectangle = L-shape

   For T-SHAPES:
   - Visual check: Does the building have a central section with wings on both sides?
   - Separate the central "stem" from the two side "wings"
   - You should see: 3 rectangles total

   **Step 2: EXTRACT DIMENSIONS FOR EACH RECTANGLE**

   For L-SHAPED buildings (THE MOST COMMON CASE):

   METHOD A - Direct Dimensions:
   1. Look for dimension lines showing the outer envelope
   2. Look for dimension lines showing the inner cutout/notch
   3. Calculate each rectangle separately

   EXAMPLE WALKTHROUGH FOR L-SHAPE:
   Let's say you see these dimensions on the plan:
   - Total building length (horizontal): 20m
   - Total building width (vertical at widest): 15m
   - The "notch" (cutout) is 8m wide × 6m deep

   Decomposition:
   - Rectangle 1 (main horizontal section): 20m × 9m = 180m² (width = 15m - 6m = 9m)
   - Rectangle 2 (vertical wing): 12m × 6m = 72m² (length = 20m - 8m = 12m)
   - TOTAL: 180m² + 72m² = 252m²

   METHOD B - Grid Method:
   1. If the plan has a grid (A, B, C... and 1, 2, 3...), use the grid dimensions
   2. Count how many grid squares each section covers
   3. Multiply: (number of grids × grid size) for length and width

   **Step 3: DETAILED CALCULATION EXAMPLES**

   EXAMPLE 1 - L-Shape Building:
   Given dimensions:
   - Main section: 18m long × 10m wide
   - Wing section: 8m long × 12m wide (extends beyond main section)
   - Overlap adjustment: The wing connects to the main, creating a 2m overlap

   Calculation:
   - Main rectangle: 18m × 10m = 180m²
   - Wing rectangle: 8m × 12m = 96m²
   - Subtract overlap (if double-counted): 8m × 2m = 16m²
   - TOTAL: 180m² + 96m² - 16m² = 260m²

   NOTE in output: "L-shaped building decomposed into main section (18m × 10m = 180m²) + wing section (8m × 12m = 96m²) - overlap correction (8m × 2m = 16m²) = 260m²"

   b) **T-Shaped Roofs**: Split into 3 rectangles (one central, two wings)
      - Identify the central section and the two perpendicular wings
      - Measure each section separately
      - Calculate: Area = (Central Length × Width) + (Wing₁ Length × Width) + (Wing₂ Length × Width)

   c) **U-Shaped Roofs**: Split into 3 rectangles forming the U
      - Two parallel sections and one connecting section
      - Calculate each section and sum them

   d) **Roofs with Courtyards/Cutouts**:
      - Calculate the full outer rectangle first
      - Then calculate the courtyard/cutout area(s)
      - Subtract: Final Area = Outer Area - Courtyard Area(s)
      - Example: Building 20m × 15m with 5m × 4m courtyard = (20 × 15) - (5 × 4) = 300 - 20 = 280 m²

   **Step 3: DIMENSION EXTRACTION**
   - Look for dimension lines with measurements (e.g., "12500" means 12.5m, "8000" means 8m)
   - Check for grid lines with labeled dimensions (A-B = 6m, B-C = 4m, etc.)
   - Use the drawing scale (e.g., 1:100) to measure from the drawing if dimensions aren't labeled
   - For scale-based measurements: measure the drawing length in mm, multiply by scale factor
     * Example: If drawing shows 50mm at 1:100 scale = 50 × 100 = 5000mm = 5m

   **Step 4: MANDATORY SHAPE ANALYSIS BEFORE CALCULATION**

   BEFORE calculating area, you MUST:
   1. STATE what shape you observe: "This is a simple rectangle" OR "This is an L-shaped building" OR "This is a T-shaped building"
   2. If NOT a simple rectangle, DESCRIBE your decomposition: "I will split this into Section A (main wing) and Section B (side wing)"
   3. SHOW your work for EACH section separately in the notes field

   **Step 5: CALCULATION METHOD**
   - MANDATORY: State the shape type in notes: "Shape identified: L-shaped building"
   - MANDATORY: Show decomposition work: "Section A (horizontal): 20m × 9m = 180m²"
   - MANDATORY: Show final sum: "Section B (vertical): 12m × 6m = 72m². Total: 180m² + 72m² = 252m²"
   - For flat roofs (platdak, retentiedak, groendak), the roof area equals the building footprint area
   - If dimensions are unclear, estimate conservatively and note the uncertainty

   **Step 6: VALIDATION**
   - After calculation, ask yourself: "Did I check if this building has an L, T, or U shape?"
   - Check if your calculated area makes logical sense given the building size
   - Typical residential buildings: 80-250 m²
   - Small commercial buildings: 200-1000 m²
   - L-shaped buildings will have LARGER areas than their simple width × length suggests
   - If your calculation seems too large or small, recheck your decomposition

   **Step 6: HANDLING MULTIPLE MATERIALS**
   - If different roof materials cover different sections (e.g., main roof vs. extension):
     * Create separate material entries for each section
     * Calculate each section's area individually
     * Clearly note which building section each material covers

   **Important Notes**:
   - NEVER just guess or use placeholder areas - always calculate from visible dimensions
   - If the shape is too complex to decompose accurately, break it into smaller rectangles and sum them
   - Document your decomposition approach in the "notes" field for transparency
   - Only use area=0 if the document is purely text/specifications with no measurable dimensions or geometry

Please analyze this PDF and respond with ONLY a valid JSON object matching the provided schema. Do not include any additional text, explanations, or markdown.

Guidelines:
- CRITICAL: If the document contains ANY roof type information ANYWHERE (in legends, labels, annotations, material lists, or notes), set "isRoofRelated" to true.
- ALWAYS extract and include the Dutch material code (DRL, ISO, TOP, BALG, OSG, DR-A, etc.) in the "code" field if visible in the document.

**AREA CALCULATION - CRITICALLY IMPORTANT:**

⚠️ SHAPE RECOGNITION IS MANDATORY - DO NOT SKIP:
  1. LOOK at the building outline carefully - is it a simple rectangle or complex shape?
  2. If you see indentations, notches, or the building looks like an "L", "T", or "U" shape, it REQUIRES decomposition
  3. DO NOT just multiply total length × total width for non-rectangular buildings - this will be WRONG
  4. L-shaped buildings are VERY COMMON in residential construction - always check for this

📐 REQUIRED CALCULATION PROCESS:
  * Step 1: IDENTIFY and STATE the shape in your notes: "This is an L-shaped building" or "This is a simple rectangle"
  * Step 2: If complex, DECOMPOSE into sections: "Split into 2 rectangles: Section A (main) and Section B (wing)"
  * Step 3: CALCULATE each section separately with dimensions: "Section A: 20m × 9m = 180m²"
  * Step 4: SUM the sections: "Section B: 12m × 6m = 72m². Total: 180m² + 72m² = 252m²"
  * Step 5: DOCUMENT everything in the notes field - show your work completely

📝 NOTES FIELD MUST CONTAIN:
  * Shape identification: "L-shaped building identified"
  * Decomposition description: "Split into horizontal section and vertical wing"
  * Each rectangle calculation: "Main section: 18m × 10m = 180m²"
  * Final total: "Total area: 180m² + 96m² = 276m²"

❌ COMMON ERRORS TO AVOID:
  * DO NOT calculate simple length × width for L, T, or U shaped buildings
  * DO NOT ignore the shape - always analyze the outline first
  * DO NOT skip showing your decomposition work
  * NEVER use placeholder or guessed areas - always calculate from visible geometry

✅ QUALITY CHECKS:
  * Did you identify the shape type?
  * For non-rectangular buildings, did you decompose into sections?
  * Did you show the calculation for each section?
  * Does your total area make sense for the building size?
  * Only use area=0 if the document has no measurable dimensions or geometry

- If previous documents contained material specifications and this document shows areas, try to match them together.
- Translate ALL Dutch material names to English in your output.
- For flat roofs (platdak, retentiedak, groendak), the roof area typically equals the building footprint area - use the decomposition method to calculate this accurately.
`;
