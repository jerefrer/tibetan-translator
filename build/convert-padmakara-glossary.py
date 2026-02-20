#!/usr/bin/env python3
"""
Converts the Padmakara multilingual glossary CSV into the pipe-separated
dictionary format used by the Tibetan Translator build scripts.

Usage:
    python3 build/convert-padmakara-glossary.py

Input:  build/dictionaries/Padmakara-glossary-*.csv  (most recent)
Output: build/dictionaries/69-PadmakaraGlossary
"""

import csv
import glob
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DICT_DIR = os.path.join(SCRIPT_DIR, "dictionaries")
OUTPUT_FILE = os.path.join(DICT_DIR, "69-PadmakaraGlossary")

# Column indices in the CSV
COL_WYLIE = 2
COL_SKT = 4       # Sânscrito - IAST
COL_EN_PRI = 6    # EN-primario
COL_EN_GLO = 7    # EN-glossary
COL_PT_PRI = 8    # PT-primario
COL_PT_GLO = 9    # PT-Glossary
COL_FR_PRI = 21   # FR-primario
COL_FR_GLO = 22   # FR-Glossary
COL_IT_PRI = 32   # ITprimario
COL_IT_GLO = 33   # IT-glossary
COL_ES_PRI = 40   # ES-primario
COL_ES_GLO = 41   # ES-glossary
COL_PL_PRI = 50   # PL-primario
COL_PL_GLO = 54   # PL-glossary
COL_DE_PRI = 63   # DE-primario
COL_DE_GLO = 67   # DE-glossary
COL_ZH_SCRIPT = 86  # chineseScript
COL_ZH_PINYIN = 87  # chinesePinyin

# Languages to include, in display order
LANGUAGES = [
    ("EN", COL_EN_PRI, COL_EN_GLO),
    ("FR", COL_FR_PRI, COL_FR_GLO),
    ("PT", COL_PT_PRI, COL_PT_GLO),
    ("ES", COL_ES_PRI, COL_ES_GLO),
    ("IT", COL_IT_PRI, COL_IT_GLO),
    ("DE", COL_DE_PRI, COL_DE_GLO),
    ("PL", COL_PL_PRI, COL_PL_GLO),
]


def get_col(row, idx):
    """Safely get a column value, returning empty string if out of range."""
    if idx < len(row):
        return row[idx].strip()
    return ""


def is_empty(value):
    """Check if a value is empty or a placeholder."""
    return not value or value in ("'-", "-", "'", "' -")


def flatten(text):
    """Flatten multiline text into a single line, cleaning up whitespace."""
    # Replace newlines with spaces
    text = text.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    # Collapse multiple spaces
    text = re.sub(r"  +", " ", text)
    # Remove leading/trailing whitespace
    text = text.strip()
    return text


def clean_for_pipe_format(text):
    """Ensure text doesn't contain the pipe delimiter."""
    return text.replace("|", "/")


def clean_glossary_text(text):
    """Clean up glossary text: remove internal markers, clean formatting."""
    text = flatten(text)
    # Remove *CC markers (internal editorial notation)
    text = re.sub(r"\*CC\s*", "", text)
    # Clean up double spaces that might result
    text = re.sub(r"  +", " ", text)
    return text.strip()


def build_definition(row):
    """Build a combined multilingual definition from a CSV row.

    Each language section is stored as a plain line: "LABEL text"
    Lines are joined with \\n which the app converts to <br /> at runtime,
    then the decorator detects the language labels and styles them.
    """
    parts = []

    # Sanskrit
    skt = get_col(row, COL_SKT)
    if not is_empty(skt):
        skt = flatten(clean_for_pipe_format(skt))
        parts.append(f"Skt {skt}")

    # Chinese (separate columns: script + pinyin)
    zh_script = get_col(row, COL_ZH_SCRIPT)
    zh_pinyin = get_col(row, COL_ZH_PINYIN)
    if not is_empty(zh_script):
        zh_script = flatten(clean_for_pipe_format(zh_script))
        if not is_empty(zh_pinyin):
            zh_pinyin = flatten(clean_for_pipe_format(zh_pinyin))
            parts.append(f"ZH {zh_script} ({zh_pinyin})")
        else:
            parts.append(f"ZH {zh_script}")

    # Each language
    for lang, pri_idx, glo_idx in LANGUAGES:
        pri = get_col(row, pri_idx)
        glo = get_col(row, glo_idx)

        if is_empty(pri):
            pri = ""
        else:
            pri = flatten(clean_for_pipe_format(pri))

        if is_empty(glo):
            glo = ""
        else:
            glo = clean_for_pipe_format(clean_glossary_text(glo))

        if pri and glo:
            parts.append(f"{lang} {pri} — {glo}")
        elif pri:
            parts.append(f"{lang} {pri}")
        elif glo:
            parts.append(f"{lang} {glo}")

    return "\\n".join(parts)


def find_csv_file():
    """Find the most recent Padmakara glossary CSV."""
    pattern = os.path.join(DICT_DIR, "Padmakara-glossary-*.csv")
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"Error: No CSV file matching {pattern}", file=sys.stderr)
        sys.exit(1)
    return files[-1]  # Most recent by name (date-sorted)


def main():
    csv_path = find_csv_file()
    print(f"Reading: {csv_path}")

    entries = []
    skipped_no_content = 0
    skipped_no_wylie = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # Skip header

        for row in reader:
            wylie_raw = get_col(row, COL_WYLIE)
            if not wylie_raw:
                skipped_no_wylie += 1
                continue

            definition = build_definition(row)
            if not definition:
                skipped_no_content += 1
                continue

            # Split multiple terms separated by ; or ,
            # e.g. "mkha' 'gro ma , mkha' 'gro" → two entries
            terms = re.split(r"\s*[;,]\s*", wylie_raw)
            for term in terms:
                term = term.strip()
                if term:
                    entries.append(f"{term}|{definition}")

    # Sort by Wylie term for consistency
    entries.sort(key=lambda e: e.split("|")[0])

    # Write output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(entries))
        f.write("\n")

    print(f"Written: {OUTPUT_FILE}")
    print(f"  Entries: {len(entries)}")
    print(f"  Skipped (no Wylie): {skipped_no_wylie}")
    print(f"  Skipped (no content): {skipped_no_content}")


if __name__ == "__main__":
    main()
