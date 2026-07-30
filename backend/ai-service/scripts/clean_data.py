"""
Nettoyage et préparation du dataset tickets IT.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "tickets_dataset.csv"
PROCESSED_DIR = ROOT / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
OUT = PROCESSED_DIR / "tickets_clean.csv"

VALID_CATEGORIES = {"hardware", "software", "network", "account", "email", "security", "other"}
VALID_PRIORITIES = {"low", "medium", "high", "urgent"}


def normalize_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.lower().strip()
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\S+@\S+", " ", text)
    text = re.sub(r"[^a-z0-9àâäéèêëïîôùûüç\s\-_/\.]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["title"] = df["title"].fillna("").astype(str)
    df["description"] = df["description"].fillna("").astype(str)
    df["category"] = df["category"].str.lower().str.strip()
    df["priority"] = df["priority"].str.lower().str.strip()

    before = len(df)
    df = df[df["category"].isin(VALID_CATEGORIES)]
    df = df[df["priority"].isin(VALID_PRIORITIES)]
    df = df[(df["title"].str.len() >= 5) & (df["description"].str.len() >= 10)]

    df["title_clean"] = df["title"].map(normalize_text)
    df["description_clean"] = df["description"].map(normalize_text)
    df["text"] = (df["title_clean"] + " " + df["description_clean"]).str.strip()
    df = df[df["text"].str.len() >= 12]

    df = df.drop_duplicates(subset=["text", "category", "priority"])
    print(f"[CLEAN] {before} -> {len(df)} lignes après nettoyage")
    return df.reset_index(drop=True)


def main() -> None:
    if not RAW.exists():
        raise SystemExit(f"Dataset manquant: {RAW}. Lancez generate_dataset.py d'abord.")
    df = pd.read_csv(RAW)
    clean_df = clean(df)
    clean_df.to_csv(OUT, index=False, encoding="utf-8")
    print(f"[OK] Dataset nettoyé -> {OUT}")
    print(clean_df["category"].value_counts().to_string())
    print("---")
    print(clean_df["priority"].value_counts().to_string())


if __name__ == "__main__":
    main()
