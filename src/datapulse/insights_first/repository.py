"""Production fetchers for first-insight candidates.

Each fetcher reads directly from the medallion layers (bronze/silver/gold)
and returns at most one `InsightCandidate`, or None if it has nothing to
say for this tenant. Fetchers are intentionally defensive — they never
raise; they return None on any soft failure.

Scope note for #402: only `fetch_top_seller_candidate` is shipped here.
Richer sources (mom_change / expiry_risk / stock_risk) are tracked as
follow-up enhancements once the UI lands and dog-fooding reveals the
wording + confidence curves. The pure picker and service are already
written to welcome those fetchers without further refactoring.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.insights_first.models import InsightCandidate
from datapulse.logging import get_logger

log = get_logger(__name__)


def fetch_top_seller_candidate(session: Session, tenant_id: int) -> InsightCandidate | None:
    """Top product by net_sales in the last 30 days.

    Returns None when there is no data for this tenant yet (e.g. a
    brand-new tenant who hasn't loaded sample data).
    """
    stmt = text("""
        SELECT
            material_desc            AS product,
            SUM(net_sales)::FLOAT    AS revenue,
            COUNT(*)                 AS transactions
        FROM bronze.sales
        WHERE tenant_id = :tenant_id
          AND date >= (CURRENT_DATE - INTERVAL '30 days')
          AND net_sales IS NOT NULL
        GROUP BY material_desc
        ORDER BY revenue DESC
        LIMIT 1
    """)
    try:
        row = session.execute(stmt, {"tenant_id": tenant_id}).mappings().fetchone()
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "first_insight_top_seller_query_failed",
            tenant_id=tenant_id,
            error=str(exc),
        )
        return None

    if row is None or row["product"] is None:
        return None

    product = str(row["product"])
    revenue = float(row["revenue"] or 0.0)
    if revenue <= 0:
        return None

    return InsightCandidate(
        kind="top_seller",
        title=f"Your top seller: {product}",
        body=(
            f"{product} drove ${revenue:,.0f} over the last 30 days. "
            "See how it stacks up against the rest of the catalog."
        ),
        action_href="/products",
        # Confidence grows with volume; capped at 0.9 since this is the
        # fallback signal, not the strongest.
        confidence=min(0.9, 0.4 + min(0.5, revenue / 100_000.0)),
    )
