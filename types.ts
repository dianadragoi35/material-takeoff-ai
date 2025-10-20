
export interface Material {
  material: string;
  code: string;
  area: number;
  unit: string;
  confidence: number;
  notes: string;
}

export interface Summary {
  totalArea: number;
  materialCount: number;
  planQuality: 'good' | 'fair' | 'poor';
}

export interface ValidationInfo {
  pythonUsed: boolean;
  pythonArea?: number;
  aiArea?: number;
  difference?: number;
  differencePercent?: number;
  recommendation?: 'use_ai' | 'use_python' | 'manual_review';
  validationMessage?: string;
}

export interface AnalysisResult {
  isRoofRelated: boolean;
  documentType: string;
  language: string;
  scale: string;
  materials: Material[];
  summary: Summary;
  validation?: ValidationInfo;
}

export interface ResultFile extends AnalysisResult {
  fileName: string;
}

export interface ConsolidatedMaterial {
    material: string;
    code: string;
    area: number;
    unit: string;
    confidence: number;
    sources: string[];
}

export interface ConsolidatedSummary {
    materials: ConsolidatedMaterial[];
    totalArea: number;
    roofPlanCount: number;
    totalPlanCount: number;
}
