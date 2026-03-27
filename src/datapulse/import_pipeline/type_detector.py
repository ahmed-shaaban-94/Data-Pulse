"""Auto-detect column types from a Polars DataFrame."""

from __future__ import annotations

import polars as pl

from datapulse.import_pipeline.models import ColumnInfo, DetectedType


def _map_polars_type(dtype: pl.DataType) -> DetectedType:
    """Map a Polars dtype to our DetectedType enum.

    Uses direct equality checks instead of isinstance so the mapping is
    stable across Polars versions that restructure the type class hierarchy.
    """
    if dtype in (pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64):
        return DetectedType.INTEGER
    if dtype in (pl.Float32, pl.Float64):
        return DetectedType.FLOAT
    if dtype == pl.Boolean:
        return DetectedType.BOOLEAN
    if dtype in (pl.Date, pl.Datetime):
        return DetectedType.DATE
    if dtype in (pl.Utf8, pl.String):
        return DetectedType.STRING
    return DetectedType.UNKNOWN


def detect_column_types(
    df: pl.DataFrame,
    sample_size: int = 100,
    sample_values_count: int = 5,
    include_samples: bool = True,
) -> list[ColumnInfo]:
    """Analyze a DataFrame and return column metadata.

    Args:
        df: The DataFrame to analyze.
        sample_size: Number of rows to sample for analysis.
        sample_values_count: Number of sample values to include per column.
        include_samples: When False, sample_values is always an empty list.
            Set to False to avoid storing PII from sensitive columns.

    Returns:
        List of ColumnInfo with detected types and statistics.
    """
    sampled = df.head(sample_size)
    result: list[ColumnInfo] = []

    for col_name in df.columns:
        col = df[col_name]
        sampled_col = sampled[col_name]

        detected_type = _map_polars_type(col.dtype)

        # Get sample values as strings (omitted when include_samples is False)
        if include_samples:
            non_null = sampled_col.drop_nulls()
            samples = [str(v) for v in non_null.head(sample_values_count).to_list()]
        else:
            samples = []

        result.append(
            ColumnInfo(
                name=col_name,
                detected_type=detected_type,
                null_count=col.null_count(),
                unique_count=col.n_unique(),
                sample_values=samples,
            )
        )

    return result
