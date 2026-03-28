export interface KPISummary {
  today_net: number;
  mtd_net: number;
  ytd_net: number;
  mom_growth_pct: number | null;
  yoy_growth_pct: number | null;
  daily_transactions: number;
  daily_customers: number;
}

export interface TimeSeriesPoint {
  period: string;
  value: number;
}

export interface TrendResult {
  points: TimeSeriesPoint[];
  total: number;
  average: number;
  minimum: number;
  maximum: number;
  growth_pct: number | null;
}

export interface RankingItem {
  rank: number;
  key: number;
  name: string;
  value: number;
  pct_of_total: number;
}

export interface RankingResult {
  items: RankingItem[];
  total: number;
}

export interface ReturnAnalysis {
  drug_name: string;
  customer_name: string;
  return_quantity: number;
  return_amount: number;
  return_count: number;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  db: "connected" | "disconnected";
}

// --- Pipeline types (Phase 2.7) ---

export interface PipelineRun {
  id: string;
  tenant_id: number;
  run_type: string;
  status: string;
  trigger_source: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  rows_loaded: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface PipelineRunList {
  items: PipelineRun[];
  total: number;
  offset: number;
  limit: number;
}

export interface QualityCheck {
  id: number;
  tenant_id: number;
  pipeline_run_id: string;
  check_name: string;
  stage: string;
  severity: string;
  passed: boolean;
  message: string | null;
  details: Record<string, unknown>;
  checked_at: string;
}

export interface QualityCheckList {
  items: QualityCheck[];
  total: number;
}

export interface TriggerResponse {
  run_id: string;
  status: string;
}
