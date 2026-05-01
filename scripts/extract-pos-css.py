"""Extract POS-only CSS from frontend/src/app/globals.css → frontend/src/styles/pos-globals.css.

Phase 1 Task 2.6 — leaves the dashboard globals.css POS-noise-free. The CSS
is still consumed by frontend/ for now; Sub-PR 2 (Vite migration) moves
this file to pos-desktop/src/styles/globals.css.

Ranges (verified against recon §4 + manual confirmation):
  572-608   @media print { .pos-print-* ... } + @page A4
  1086-1124 .pos-root { --pos-* tokens }
  1129-1264 .pos-glow-halo, .pos-display, dpScan*, dpFlash*, .pos-provisional-rail,
            dpRowEnter, dpSlideUp, dpKeyFade
  1295-1361 .pos-omni { tokens }
  1364-1517 .pos-omni utility atoms + receipt surface (+@page 80mm)
  1517-1537 .active-tactile (Sub-PR D6 from #797)

Idempotent: if pos-globals.css already exists with content, this exits 1.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GLOBALS_CSS = ROOT / "frontend" / "src" / "app" / "globals.css"
POS_CSS = ROOT / "frontend" / "src" / "styles" / "pos-globals.css"

# 1-indexed inclusive line ranges to extract.
RANGES: list[tuple[int, int, str]] = [
    (572, 608, "Print pipeline (.pos-print-*) + @page A4"),
    (1086, 1124, ".pos-root design tokens"),
    (1129, 1264, "Animations: pos-glow-halo, pos-display, dpScan*, pos-scan-flash*, pos-provisional-rail, dpRowEnter, dpSlideUp, dpKeyFade"),
    (1295, 1361, ".pos-omni design tokens (v9 expanded)"),
    (1364, 1517, ".pos-omni utility atoms + receipt surface + @page 80mm"),
    (1517, 1537, ".active-tactile (D6 — QuickPickGrid press animation)"),
]


def main() -> int:
    if POS_CSS.exists() and POS_CSS.stat().st_size > 0:
        print(f"refusing to overwrite non-empty {POS_CSS.relative_to(ROOT)}")
        return 1

    src = GLOBALS_CSS.read_text(encoding="utf-8").splitlines(keepends=True)
    n = len(src)
    print(f"globals.css: {n} lines")

    # Mark which lines belong to which range (for the kept output).
    extracted_idx: set[int] = set()
    extracted_blocks: list[tuple[str, list[str]]] = []
    for start, end, label in RANGES:
        # Convert 1-indexed inclusive to 0-indexed exclusive
        block = src[start - 1 : end]
        extracted_blocks.append((label, block))
        extracted_idx.update(range(start - 1, end))

    # Build pos-globals.css: header + each block with its label.
    out_parts: list[str] = [
        "/* POS-only CSS — extracted from frontend/src/app/globals.css.\n",
        "   Phase 1 Task 2.6 (Sub-PR 1). Will move to pos-desktop/src/styles/globals.css\n",
        "   in Sub-PR 2 (Vite migration).\n",
        "*/\n\n",
    ]
    for label, block in extracted_blocks:
        out_parts.append(f"/* === {label} === */\n")
        out_parts.extend(block)
        out_parts.append("\n")

    POS_CSS.parent.mkdir(parents=True, exist_ok=True)
    POS_CSS.write_text("".join(out_parts), encoding="utf-8")
    print(f"wrote {POS_CSS.relative_to(ROOT)} ({sum(len(b) for _, b in extracted_blocks)} lines extracted)")

    # Build new globals.css: lines not in extracted_idx.
    kept = [line for i, line in enumerate(src) if i not in extracted_idx]
    GLOBALS_CSS.write_text("".join(kept), encoding="utf-8")
    print(f"globals.css now: {len(kept)} lines (was {n})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
