"""
Classifieur léger TF-IDF + Multinomial Naive Bayes (sans scikit-learn/scipy).
Compatible Windows verrouillé / Docker slim.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field


TOKEN_RE = re.compile(r"[a-z0-9àâäéèêëïîôùûüç]+", re.IGNORECASE)


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall((text or "").lower())


def ngrams(tokens: list[str], n: int) -> list[str]:
    if n <= 1:
        return tokens
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


@dataclass
class TfidfNBModel:
    classes: list[str] = field(default_factory=list)
    vocab: dict[str, int] = field(default_factory=dict)
    idf: list[float] = field(default_factory=list)
    class_log_prior: dict[str, float] = field(default_factory=dict)
    feature_log_prob: dict[str, list[float]] = field(default_factory=dict)
    ngram_range: tuple[int, int] = (1, 2)
    min_df: int = 1

    def _extract(self, text: str) -> list[str]:
        tokens = tokenize(text)
        feats: list[str] = []
        for n in range(self.ngram_range[0], self.ngram_range[1] + 1):
            feats.extend(ngrams(tokens, n))
        return feats

    def fit(self, texts: list[str], labels: list[str]) -> "TfidfNBModel":
        docs_feats = [self._extract(t) for t in texts]
        df = Counter()
        for feats in docs_feats:
            df.update(set(feats))

        vocab_terms = [t for t, c in df.items() if c >= self.min_df]
        self.vocab = {t: i for i, t in enumerate(sorted(vocab_terms))}
        n_docs = len(texts)
        vsize = len(self.vocab)
        self.idf = [0.0] * vsize
        for term, idx in self.vocab.items():
            self.idf[idx] = math.log((1 + n_docs) / (1 + df[term])) + 1.0

        self.classes = sorted(set(labels))
        class_docs = defaultdict(list)
        for feats, y in zip(docs_feats, labels):
            class_docs[y].append(feats)

        total = len(labels)
        alpha = 1.0
        for c in self.classes:
            self.class_log_prior[c] = math.log(len(class_docs[c]) / total)
            counts = [alpha] * vsize
            for feats in class_docs[c]:
                tf = Counter(f for f in feats if f in self.vocab)
                for term, cnt in tf.items():
                    idx = self.vocab[term]
                    # tf-idf weighted count
                    counts[idx] += cnt * self.idf[idx]
            total_c = sum(counts)
            self.feature_log_prob[c] = [math.log(v / total_c) for v in counts]
        return self

    def _vectorize(self, text: str) -> Counter:
        feats = self._extract(text)
        tf = Counter(f for f in feats if f in self.vocab)
        weighted: Counter = Counter()
        for term, cnt in tf.items():
            idx = self.vocab[term]
            weighted[idx] = cnt * self.idf[idx]
        return weighted

    def predict_proba(self, text: str) -> dict[str, float]:
        vec = self._vectorize(text)
        scores: dict[str, float] = {}
        for c in self.classes:
            s = self.class_log_prior[c]
            flp = self.feature_log_prob[c]
            for idx, val in vec.items():
                s += val * flp[idx]
            scores[c] = s
        # log-sum-exp normalize
        m = max(scores.values()) if scores else 0.0
        exps = {c: math.exp(v - m) for c, v in scores.items()}
        z = sum(exps.values()) or 1.0
        return {c: exps[c] / z for c in self.classes}

    def predict(self, text: str) -> str:
        proba = self.predict_proba(text)
        return max(proba.items(), key=lambda x: x[1])[0]

    def confidence(self, text: str) -> float:
        proba = self.predict_proba(text)
        vals = sorted(proba.values(), reverse=True)
        if not vals:
            return 0.5
        if len(vals) == 1:
            return vals[0]
        # top1 and margin
        return min(0.97, max(0.45, vals[0] * 0.75 + (vals[0] - vals[1]) * 0.9))
