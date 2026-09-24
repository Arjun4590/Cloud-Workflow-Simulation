export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  resourceId?: string;
  connectionId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export interface ExecutionStage {
  index: number;
  resourceIds: string[];
}

export interface ExecutionPlan {
  valid: boolean;
  stages: ExecutionStage[];
  errors: ValidationIssue[];
}
