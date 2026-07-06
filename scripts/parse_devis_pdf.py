#!/usr/bin/env python3
"""
Offline supplier devis PDF parser (dev / batch use).

Requires: pip install pdfplumber

Usage:
  python scripts/parse_devis_pdf.py path/to/devis.pdf

Output: JSON with header (supplier, MF, date) and article lines.
This mirrors the browser spatial parser in src/utils/pdfDevisSpatialParser.ts.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("Install pdfplumber: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

MF_RE = re.compile(r"\b(\d{6,7}/[A-Za-z]/[A-Za-z]/[A-Za-z]/\d{3})\b")
DATE_RE = re.compile(r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})")
HEADER_WORDS = re.compile(
    r"design|article|libell|qt|quant|p\.?\s*u|prix|unitaire|montant|tva",
    re.I,
)
FOOTER_WORDS = re.compile(r"^total|sous[- ]?total|net\s+[àa]\s+payer", re.I)
NUM_RE = re.compile(r"^-?\d+(?:[.,]\d+)?%?$")


def parse_decimal(raw: str) -> float:
    s = raw.replace(" ", "").replace("%", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def extract_lines_from_table(page) -> list[dict]:
    tables = page.extract_tables() or []
    lines: list[dict] = []

    for table in tables:
        if not table or len(table) < 2:
            continue
        header_idx = None
        for i, row in enumerate(table):
            joined = " ".join(str(c or "") for c in row)
            if HEADER_WORDS.search(joined):
                header_idx = i
                break
        if header_idx is None:
            continue

        header = [str(c or "").lower() for c in table[header_idx]]
        col = {"designation": 0, "quantity": None, "unitPrice": None, "tva": None}
        for idx, cell in enumerate(header):
            if re.search(r"design|article|libell|ref|description", cell):
                col["designation"] = idx
            elif re.search(r"qt|quant|qte", cell):
                col["quantity"] = idx
            elif re.search(r"p\.?\s*u|prix|unitaire", cell):
                col["unitPrice"] = idx
            elif re.search(r"tva", cell):
                col["tva"] = idx

        for row in table[header_idx + 1 :]:
            cells = [str(c or "").strip() for c in row]
            joined = " ".join(cells)
            if not joined or FOOTER_WORDS.search(joined):
                break
            designation = cells[col["designation"]] if col["designation"] < len(cells) else ""
            designation = re.sub(r"^\d+[\s.)-]+", "", designation).strip()
            if len(designation) < 2:
                continue
            qty = (
                parse_decimal(cells[col["quantity"]])
                if col["quantity"] is not None and col["quantity"] < len(cells)
                else 0
            )
            price = (
                parse_decimal(cells[col["unitPrice"]])
                if col["unitPrice"] is not None and col["unitPrice"] < len(cells)
                else 0
            )
            tva = (
                parse_decimal(cells[col["tva"]])
                if col["tva"] is not None and col["tva"] < len(cells)
                else 19
            )
            nums = [parse_decimal(c) for c in cells if NUM_RE.match(c.replace(" ", ""))]
            if qty <= 0 and nums:
                qty = nums[0]
            if price <= 0 and len(nums) >= 2:
                price = nums[1]
            if qty <= 0 and price <= 0:
                continue
            lines.append(
                {
                    "designation": designation,
                    "quantity": qty or 1,
                    "unitPrice": price,
                    "tvaRate": round(tva) if tva in (0, 7, 13, 19) else 19,
                }
            )

    return lines


def extract_header(text: str) -> dict:
    header: dict = {}
    if m := MF_RE.search(text):
        header["taxId"] = m.group(1).upper()
    if m := DATE_RE.search(text):
        header["documentDate"] = m.group(1)
    for line in text.splitlines()[:25]:
        line = line.strip()
        if len(line) < 4 or len(line) > 100:
            continue
        if re.search(r"sarl|sa|suarl|ste|société", line, re.I):
            header["supplierName"] = line
            break
    return header


def parse_pdf(path: Path) -> dict:
    all_text: list[str] = []
    lines: list[dict] = []

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            all_text.append(text)
            lines.extend(extract_lines_from_table(page))

    full_text = "\n".join(all_text)
    header = extract_header(full_text)

    return {"header": header, "lines": lines, "lineCount": len(lines)}


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    result = parse_pdf(Path(sys.argv[1]))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
