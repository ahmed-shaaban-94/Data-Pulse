"""LangGraph v2 prompts for AI-Light insight generation.

PROMPT_VERSION is embedded in cache keys so bumping it auto-invalidates
all cached AI outputs without touching Redis directly.
"""

from __future__ import annotations

PROMPT_VERSION = "v2.0"

SYSTEM_PROMPT = """You are DataPulse, an expert business analyst AI for a sales analytics platform.
Respond with concise, actionable insights. Use precise numbers from the data provided.
Return only well-formed JSON when asked for JSON output.
Never fabricate data. If a metric is unavailable, omit it rather than guessing."""

SUMMARY_PROMPT = """Analyze the following sales data and generate an executive summary.

Today ({today_date}):
- Gross Sales: {today_gross} EGP
- MTD Gross: {mtd_gross} EGP
- YTD Gross: {ytd_gross} EGP
- MoM Growth: {mom_growth}%
- YoY Growth: {yoy_growth}%
- Transactions: {daily_transactions}
- Customers: {daily_customers}

Top Products:
{top_products}

Top Customers:
{top_customers}

Return JSON with keys: "narrative" (2-3 sentence summary)
and "highlights" (list of 3-5 bullet strings)."""

ANOMALY_PROMPT = """Detect anomalies in this daily sales time series.

Data (date: value EGP):
{daily_data}

Statistics: avg={avg} EGP, std_dev={std_dev} EGP, min={min_val} EGP, max={max_val} EGP

Return JSON array of objects with keys: "date", "severity" (low/medium/high),
"description" (1 sentence).
Only include genuine anomalies (>2 std devs). Return empty array [] if none found."""

CHANGES_PROMPT = """Compare two sales periods and explain the key changes.

Current ({current_period}): net={current_net} EGP,
  txns={current_txns}, customers={current_customers}
Previous ({previous_period}): net={previous_net} EGP,
  txns={previous_txns}, customers={previous_customers}

Top movers: {top_movers}

Return JSON with keys:
  "narrative" (2-3 sentences explaining the most important changes)
  "deltas" (list of objects: metric, previous_value, current_value, change_pct, direction)"""

DEEP_DIVE_PROMPT = """You are a senior business analyst with access to DataPulse analytics tools.

Conduct a comprehensive deep-dive analysis for the period {start_date} to {end_date}.

Use the available tools to gather data across KPIs, trends, anomalies, forecasts, and targets.
Then synthesize findings into a structured report.

Return JSON with keys:
  "narrative" (4-6 sentences executive summary)
  "highlights" (5-7 key findings as bullet strings)
  "anomalies_list" (list of objects: date, severity, description)
  "deltas" (list of objects: metric, previous_value, current_value, change_pct, direction)

Focus on: revenue drivers, anomalies, forecast vs actuals, top performers."""

REVIEW_INSTRUCTION = """The analyst has requested human review before finalizing this report.

DRAFT NARRATIVE:
{draft_narrative}

DRAFT HIGHLIGHTS:
{draft_highlights}

DATA SNAPSHOT (summary):
{data_snapshot}

The reviewer may approve as-is or provide edits. Incorporate any edits and finalize."""
