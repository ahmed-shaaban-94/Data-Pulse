"""V2 prompt templates for the AI Light LangGraph nodes.

PROMPT_VERSION is embedded in cache keys so that updating a prompt
automatically invalidates cached responses.
"""

from __future__ import annotations

PROMPT_VERSION = "2.0"

SYSTEM_PROMPT = (
    "You are a business analytics assistant for DataPulse, a pharma/sales analytics platform. "
    "You analyze sales data and provide concise, actionable insights in English. "
    "Keep responses short and data-driven. Use bullet points for highlights. "
    "Currency is EGP (Egyptian Pounds). All numbers should be formatted clearly. "
    "Always return valid JSON — no markdown code fences, no extra text."
)

SUMMARY_PROMPT_V2 = """\
Analyze the following sales data and write a brief executive summary.
Return valid JSON with schema: {{"narrative": "...", "highlights": ["...", ...]}}

**KPI Snapshot:**
- Today's Gross Sales: {today_gross} EGP
- Month-to-Date: {mtd_gross} EGP
- Year-to-Date: {ytd_gross} EGP
- MoM Growth: {mom_growth}%
- YoY Growth: {yoy_growth}%
- Daily Transactions: {daily_transactions}
- Daily Customers: {daily_customers}

**Top 5 Products by Revenue:**
{top_products}

**Top 5 Customers by Revenue:**
{top_customers}

Return only valid JSON."""

ANOMALY_PROMPT_V2 = """\
Analyze the following daily sales time series and identify anomalies \
(unusual spikes, drops, or pattern breaks).
Return valid JSON with schema:
{{"anomalies": [{{"date": "YYYY-MM-DD", "description": "...", "severity": "low|medium|high"}}],\
 "narrative": "overall summary"}}

**Daily Sales Data:**
{daily_data}

**Statistics:**
- Average: {avg} EGP
- Std Dev: {std_dev} EGP
- Min: {min_val} EGP
- Max: {max_val} EGP

**Active Monitoring Alerts:**
{active_alerts}

Return only valid JSON. Use empty list [] if no anomalies found."""

CHANGES_PROMPT_V2 = """\
Compare these two periods and explain the key business performance changes.
Return valid JSON with schema: {{"narrative": "...", "key_changes": ["...", ...]}}

**Current Period ({current_period}):**
- Net Sales: {current_net} EGP
- Transactions: {current_txns}
- Customers: {current_customers}

**Previous Period ({previous_period}):**
- Net Sales: {previous_net} EGP
- Transactions: {previous_txns}
- Customers: {previous_customers}

**Top Gainers (products):** {top_gainers}
**Top Losers (products):** {top_losers}
**Top Staff by Sales:** {top_staff}

Return only valid JSON."""
