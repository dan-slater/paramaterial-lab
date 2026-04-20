#!/usr/bin/env python3
"""Build JSON fixtures for the Svelte web app from paramaterial-examples.

Reads stage-01 (prepared or raw) CSV files + info xlsx for each of the 5
example datasets and emits a compact, uPlot-friendly JSON file per example
at web/static/data/<slug>.json.

Downsamples any curve with >MAX_POINTS rows to <=MAX_POINTS via uniform
stride, preserving first & last point.

stdlib + pandas + openpyxl only (no paramaterial import).
"""
from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path
from typing import Any

import pandas as pd


EXAMPLES_ROOT = Path("/tmp/paramaterial-examples/examples")
OUT_DIR = Path("static/data")

MAX_POINTS = 2000

# Parse the CS1/CS2-style old filenames like "P_020_F_1_017_198_18".
# Fields: test_type _ temperature _ lot _ number _ ... _ ... _ ...
OLD_FN_RE = re.compile(
    r"^(?P<test_type>[A-Za-z]+)_(?P<temperature>\d+)_(?P<lot>[A-Za-z])_(?P<number>\d+)"
)


def _downsample(values: list[float], max_points: int = MAX_POINTS) -> list[float]:
    n = len(values)
    if n <= max_points:
        return values
    stride = math.ceil(n / max_points)
    sampled = values[::stride]
    # Ensure last point is preserved
    if sampled[-1] != values[-1]:
        sampled.append(values[-1])
    return sampled


def _round(values: list[float], digits: int = 6) -> list[float]:
    out = []
    for v in values:
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out.append(None)  # type: ignore[arg-type]
        else:
            out.append(round(float(v), digits))
    return out


def _read_stage1_csv(path: Path) -> tuple[list[float], list[float]]:
    """Read a stage-01 CSV and return (strain, stress) lists.

    Handles both 'Stress_MPa' (basic-usage, CS1, CS2) and 'Stress(MPa)'
    (CS3, CS4) column naming conventions.
    """
    df = pd.read_csv(path)
    # Normalize potential stress column names
    stress_col = None
    for cand in ("Stress_MPa", "Stress(MPa)", "stress_MPa", "stress(MPa)"):
        if cand in df.columns:
            stress_col = cand
            break
    if stress_col is None:
        raise KeyError(f"No stress column in {path.name}; cols={list(df.columns)}")
    strain_col = "Strain" if "Strain" in df.columns else "strain"
    return df[strain_col].tolist(), df[stress_col].tolist()


def _sanitize_meta(rec: dict[str, Any]) -> dict[str, Any]:
    """Drop NaNs and coerce to JSON-safe types."""
    out: dict[str, Any] = {}
    for k, v in rec.items():
        if v is None:
            continue
        if isinstance(v, float) and math.isnan(v):
            continue
        # pandas ints arrive as numpy ints; json can handle them, but be explicit
        if hasattr(v, "item"):
            v = v.item()
        out[k] = v
    return out


def _meta_from_filename(test_id: str) -> dict[str, Any]:
    """For CS1 (no info xlsx): parse the `P_020_F_1_...` filename stem."""
    m = OLD_FN_RE.match(test_id)
    if not m:
        return {}
    return {
        "test_type": m.group("test_type"),
        "temperature": int(m.group("temperature")),
        "lot": m.group("lot"),
        "number": int(m.group("number")),
    }


def build_example(
    *,
    slug: str,
    name: str,
    description: str,
    csv_dir: Path,
    info_xlsx: Path | None,
    id_col: str = "test_id",
) -> dict[str, Any]:
    # Load info table (if any)
    if info_xlsx is not None and info_xlsx.exists():
        info_df = pd.read_excel(info_xlsx)
        info_cols = [c for c in info_df.columns if c != id_col]
        info_by_id: dict[str, dict[str, Any]] = {
            str(row[id_col]): _sanitize_meta(
                {c: row[c] for c in info_cols}
            )
            for _, row in info_df.iterrows()
        }
    else:
        info_df = None
        info_cols = ["test_type", "temperature", "lot", "number"]
        info_by_id = {}

    csv_files = sorted(csv_dir.glob("*.csv"))
    tests: list[dict[str, Any]] = []
    total_points_after = 0

    for csv_path in csv_files:
        test_id = csv_path.stem
        try:
            strain, stress = _read_stage1_csv(csv_path)
        except KeyError as e:
            print(f"  WARN: {e}")
            continue

        strain_ds = _downsample(strain)
        stress_ds = _downsample(stress)
        # Align lengths if off-by-one due to last-point append
        m = min(len(strain_ds), len(stress_ds))
        strain_ds = strain_ds[:m]
        stress_ds = stress_ds[:m]
        total_points_after += m

        meta = info_by_id.get(test_id)
        if meta is None:
            # CS1 fallback: parse from filename stem
            meta = _meta_from_filename(test_id)

        tests.append(
            {
                "test_id": test_id,
                "meta": meta,
                "strain": _round(strain_ds, 6),
                "stress": _round(stress_ds, 4),
            }
        )

    payload = {
        "id": slug,
        "name": name,
        "description": description,
        "info_columns": [id_col] + list(info_cols),
        "tests": tests,
    }

    avg_pts = total_points_after / len(tests) if tests else 0
    print(
        f"[{slug}] tests={len(tests)}  avg_points_after_ds={avg_pts:.1f}",
        end="",
    )
    return payload


EXAMPLES = [
    dict(
        slug="basic-usage",
        name="Basic Usage \u2014 Uniaxial Tension",
        description="Room-temp and elevated-temp uniaxial tension on 9 lots",
        csv_dir=EXAMPLES_ROOT / "dan-msc-basic-usage/data/01 prepared data",
        info_xlsx=EXAMPLES_ROOT / "dan-msc-basic-usage/info/01 prepared info.xlsx",
    ),
    dict(
        slug="cs1",
        name="Case Study 1 \u2014 Foot-Correction Screening",
        description="Prepared uniaxial tension curves used for foot-correction screening",
        csv_dir=EXAMPLES_ROOT / "dan-msc-case-studies/CS1/data/01 raw data",
        info_xlsx=None,  # no xlsx shipped; metadata parsed from filename
    ),
    dict(
        slug="cs2",
        name="Case Study 2 \u2014 Representative Curves",
        description="Prepared uniaxial tension curves grouped for representative curve generation",
        csv_dir=EXAMPLES_ROOT / "dan-msc-case-studies/CS2/data/01 raw data",
        info_xlsx=EXAMPLES_ROOT / "dan-msc-case-studies/CS2/info/01 prepared info.xlsx",
    ),
    dict(
        slug="cs3",
        name="Case Study 3 \u2014 Uniaxial Compression (Baron)",
        description="Raw uniaxial compression curves (~5000 rows/test) across temperatures and rates",
        csv_dir=EXAMPLES_ROOT / "dan-msc-case-studies/CS3/data/01 raw data",
        info_xlsx=EXAMPLES_ROOT / "dan-msc-case-studies/CS3/info/01 raw info.xlsx",
    ),
    dict(
        slug="cs4",
        name="Case Study 4 \u2014 Plane-Strain Compression (Hyde)",
        description="Raw plane-strain compression curves (PSC*) across temperatures",
        csv_dir=EXAMPLES_ROOT / "dan-msc-case-studies/CS4/data/01 raw data",
        info_xlsx=EXAMPLES_ROOT / "dan-msc-case-studies/CS4/info/01 raw info.xlsx",
    ),
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in EXAMPLES:
        payload = build_example(**spec)
        out_path = OUT_DIR / f"{spec['slug']}.json"
        with out_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
        size = os.path.getsize(out_path)
        size_str = (
            f"{size / 1024 / 1024:.2f} MB"
            if size > 1024 * 1024
            else f"{size / 1024:.1f} KB"
        )
        print(f"  -> {out_path.name}  {size_str}")


if __name__ == "__main__":
    main()
