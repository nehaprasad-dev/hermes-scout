export type RiskLevel = "Low" | "Medium" | "High";

export type AgentStepKind = "plan" | "tool_call" | "final";

export type AgentStep = {
  kind: AgentStepKind;
  tool?: string;
  label: string;
  detail?: string;
};

export type AgentTrace = {
  model: string;
  steps: AgentStep[];
  toolCallCount: number;
  durationMs: number;
};

export type Company = {
  name: string;
  pan: string;
  gstin: string;
  industry: string;
  /** YYYY-MM, the most recent month for which GSTR-3B has been filed. */
  lastGstFilingMonth: string;
  mcaFilingStatus: "Filed" | "Overdue";
  pendingNotices: string[];
  /** True when the profile is synthetic (built from the typed name, not curated). */
  isSample?: boolean;
};

export type ScanResult = {
  companyName: string;
  industry: string;
  score: number;
  riskLevel: RiskLevel;
  pendingTasks: string[];
  penaltyEstimate: string;
  monthsOverdue: number;
  aiSummary: string;
  aiSummaryFallback: boolean;
  /** Present only when the Hermes Agent path succeeded. */
  agentTrace?: AgentTrace;
  /** True when this result was built from a synthetic profile (see Company.isSample). */
  isSample: boolean;
};
