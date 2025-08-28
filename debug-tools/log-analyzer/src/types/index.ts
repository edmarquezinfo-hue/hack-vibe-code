export interface LogEntry {
  timestamp: string;
  traceId: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  component: string;
  message: string;
  filePath?: string;
  action?: string;
  diff?: DiffInfo;
  codeReview?: CodeReviewInfo;
  finalContent?: string;
  passNumber?: number;
}

export interface DiffInfo {
  searchBlocks: string[];
  replaceBlocks: string[];
  rawDiff: string;
  applied: boolean;
}

export interface CodeReviewInfo {
  codeStructure: string;
  criticalIssues: string[];
  hooksAnalysis: string;
  fixesRationale: string;
  rawReview: string;
}

export interface FileProcessingSession {
  filePath: string;
  traceId: string;
  passes: FilePass[];
  totalPasses: number;
  initialContent?: string;
  finalContent?: string;
}

export interface FilePass {
  passNumber: number;
  timestamp: string;
  diff: DiffInfo;
  codeReview: CodeReviewInfo;
  beforeContent?: string;
  afterContent?: string;
  applied: boolean;
}

export interface SessionAnalysis {
  traceId: string;
  startTime: string;
  endTime: string;
  filesProcessed: string[];
  totalPasses: number;
  successfulFixes: number;
  failedFixes: number;
  fileProcessingSessions: FileProcessingSession[];
}

export interface AnalysisInsights {
  mostFixedFiles: Array<{ filePath: string; passes: number }>;
  fixSuccessRate: number;
  commonIssuePatterns: string[];
  averagePassesPerFile: number;
  totalFilesProcessed: number;
  processingTimeAnalysis: {
    averageTimePerFile: number;
    slowestFiles: Array<{ filePath: string; processingTime: number }>;
  };
}

export interface OpenAIAnalysis {
  filePath: string;
  passNumber: number;
  quality: 'better' | 'worse' | 'similar';
  reasoning: string;
  score: number; // 0-100
  suggestions: string[];
}
