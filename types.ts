
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

export interface AnalysisResult {
  isRoofRelated: boolean;
  documentType: string;
  language: string;
  scale: string;
  materials: Material[];
  summary: Summary;
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
