"""
Entraînement Tritux ML (TF-IDF + Naive Bayes maison, sans scikit-learn).
"""
from __future__ import annotations

import json
import pickle
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tritux_ml import TfidfNBModel  # noqa: E402

DATA = ROOT / "data" / "processed" / "tickets_clean.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def accuracy(y_true, y_pred) -> float:
    ok = sum(1 for a, b in zip(y_true, y_pred) if a == b)
    return ok / max(1, len(y_true))


def f1_weighted(y_true, y_pred) -> float:
    labels = sorted(set(y_true) | set(y_pred))
    total = len(y_true)
    score = 0.0
    for lab in labels:
        tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == lab and yp == lab)
        fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt != lab and yp == lab)
        fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == lab and yp != lab)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        support = sum(1 for yt in y_true if yt == lab)
        score += f1 * support
    return score / max(1, total)


def main() -> None:
    if not DATA.exists():
        raise SystemExit("Lancez generate_dataset.py puis clean_data.py")

    df = pd.read_csv(DATA)
    pairs = list(
        zip(
            df["text"].astype(str).tolist(),
            df["category"].astype(str).tolist(),
            df["priority"].astype(str).tolist(),
        )
    )

    rng = random.Random(42)
    by_class: dict[str, list] = {}
    for row in pairs:
        by_class.setdefault(row[1], []).append(row)

    train_rows, test_rows = [], []
    for rows in by_class.values():
        rng.shuffle(rows)
        n_test = max(1, int(len(rows) * 0.2))
        test_rows.extend(rows[:n_test])
        train_rows.extend(rows[n_test:])

    Xtr = [r[0] for r in train_rows]
    ycat_tr = [r[1] for r in train_rows]
    yprio_tr = [r[2] for r in train_rows]
    Xte = [r[0] for r in test_rows]
    ycat_te = [r[1] for r in test_rows]
    yprio_te = [r[2] for r in test_rows]

    cat_model = TfidfNBModel(ngram_range=(1, 2)).fit(Xtr, ycat_tr)
    prio_model = TfidfNBModel(ngram_range=(1, 2)).fit(Xtr, yprio_tr)

    cat_pred = [cat_model.predict(t) for t in Xte]
    prio_pred = [prio_model.predict(t) for t in Xte]

    cat_acc = accuracy(ycat_te, cat_pred)
    cat_f1 = f1_weighted(ycat_te, cat_pred)
    prio_acc = accuracy(yprio_te, prio_pred)
    prio_f1 = f1_weighted(yprio_te, prio_pred)

    print(f"Catégorie  accuracy={cat_acc:.3f}  f1_weighted={cat_f1:.3f}")
    print(f"Priorité   accuracy={prio_acc:.3f}  f1_weighted={prio_f1:.3f}")

    hints = (
        df.groupby("category")["resolution_hint"]
        .agg(lambda s: s.value_counts().index[0] if len(s) else "")
        .to_dict()
    )

    with (MODELS_DIR / "category_model.pkl").open("wb") as f:
        pickle.dump(cat_model, f)
    with (MODELS_DIR / "priority_model.pkl").open("wb") as f:
        pickle.dump(prio_model, f)
    with (MODELS_DIR / "resolution_hints.pkl").open("wb") as f:
        pickle.dump(hints, f)

    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "samples": len(df),
        "train_size": len(Xtr),
        "test_size": len(Xte),
        "categories": sorted(set(df["category"].astype(str))),
        "priorities": sorted(set(df["priority"].astype(str))),
        "metrics": {
            "category": {"accuracy": round(cat_acc, 4), "f1_weighted": round(cat_f1, 4)},
            "priority": {"accuracy": round(prio_acc, 4), "f1_weighted": round(prio_f1, 4)},
        },
        "algorithm": {
            "category": "TF-IDF + Multinomial Naive Bayes (custom)",
            "priority": "TF-IDF + Multinomial Naive Bayes (custom)",
        },
    }
    (MODELS_DIR / "metrics.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[OK] Modèles sauvegardés dans {MODELS_DIR}")


if __name__ == "__main__":
    main()
