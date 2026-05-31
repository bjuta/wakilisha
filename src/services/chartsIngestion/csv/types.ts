/**
 * CSV-specific types for the chart ingestion pipeline.
 */

export type CsvConfidence = "high" | "medium" | "low";
export type CsvMappingStatus = "mapped" | "partial" | "unmapped";
export type CsvValidationStatus = "valid" | "warnings" | "errors";

export interface DiscoveredCsvFile {
  filename: string;
  filepath: string;
  detectedChartType: string;
  confidence: CsvConfidence;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  detectedDate: string | null;
  detectedWeek: string | null;
  mappingStatus: CsvMappingStatus;
  validationStatus: CsvValidationStatus;
  validationIssues: string[];
  mappedFields: Record<string, string>;
  sourceSize: number;
}

export interface CsvIngestSource {
  id: string;
  filename: string;
  chartType: string;
  confidence: CsvConfidence;
  rowCount: number;
  detectedDate: string | null;
  detectedWeek: string | null;
  mappingStatus: CsvMappingStatus;
  validationStatus: CsvValidationStatus;
  validationIssues: string[];
  mappedFields: Record<string, string>;
  headers: string[];
  sampleRows: Record<string, string>[];
  usedAsSource: boolean;
  addedAt: string | null;
}

export interface CsvRowProvenance {
  sourceFilename: string;
  sourceRowNumber: number;
  rawRowHash: string;
  rawPayload: Record<string, string>;
  mappedFields: Record<string, string>;
  sourcePosition: number | null;
}

export interface CsvNormalizationResult {
  candidateCount: number;
  errors: string[];
  warnings: string[];
  skippedRows: number;
  provenance: CsvRowProvenance[];
}