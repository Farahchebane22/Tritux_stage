from __future__ import annotations

import json
import pickle
import re
import unicodedata
from pathlib import Path
from typing import Any

from tritux_ml import TfidfNBModel

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
KB_PATH = ROOT / "data" / "knowledge_base.json"

RESPONSE_TEMPLATES = {
    "network": "Bonjour, d'après l'analyse IA ce ticket relève du réseau. Vérifiez connectivité, VPN/DNS puis documentez le message d'erreur exact.",
    "security": "ATTENTION sécurité: ne partagez aucun identifiant. Isolez l'action suspecte et changez votre mot de passe si nécessaire.",
    "software": "Bonjour, problème logiciel détecté. Essayez réparation/clear cache, puis appliquez les étapes d'auto-assistance.",
    "hardware": "Bonjour, incident matériel probable. Testez câble/périphérique de remplacement et précisez marque/modèle.",
    "account": "Bonjour, demande liée au compte/identité. Utilisez le self-service SSO si disponible.",
    "email": "Bonjour, incident messagerie détecté. Vérifiez règles Outlook, quota et quarantaine.",
    "other": "Bonjour, votre demande a été classée. Un agent Tritux l'analysera sous peu.",
}


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.lower().strip()
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\S+@\S+", " ", text)
    text = re.sub(r"[^a-z0-9àâäéèêëïîôùûüç\s\-_/\.]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class AIEngine:
    def __init__(self) -> None:
        self.category_model: TfidfNBModel | None = None
        self.priority_model: TfidfNBModel | None = None
        self.hints: dict[str, str] = {}
        self.metrics: dict[str, Any] = {}
        self.knowledge_base: list[dict] = []
        self.ready = False
        self._load()

    def _load(self) -> None:
        cat_path = MODELS_DIR / "category_model.pkl"
        prio_path = MODELS_DIR / "priority_model.pkl"
        hints_path = MODELS_DIR / "resolution_hints.pkl"
        metrics_path = MODELS_DIR / "metrics.json"

        try:
            if cat_path.exists() and prio_path.exists():
                with cat_path.open("rb") as f:
                    self.category_model = pickle.load(f)
                with prio_path.open("rb") as f:
                    self.priority_model = pickle.load(f)
                if hints_path.exists():
                    with hints_path.open("rb") as f:
                        self.hints = pickle.load(f)
                if metrics_path.exists():
                    self.metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
                self.ready = True
                print(f"[AIEngine] Modèles ML chargés depuis {MODELS_DIR}")
            else:
                print(f"[AIEngine] Modèles absents dans {MODELS_DIR} — fallback règles")
        except Exception as exc:
            print(f"[AIEngine] Échec chargement modèles: {exc}")
            self.ready = False

        if KB_PATH.exists():
            self.knowledge_base = json.loads(KB_PATH.read_text(encoding="utf-8"))
            print(f"[AIEngine] Knowledge base: {len(self.knowledge_base)} articles")

    def analyze(self, title: str, description: str) -> dict[str, Any]:
        text = normalize_text(f"{title} {description}")
        if not text:
            return {
                "category": "other",
                "priority": "medium",
                "confidence": 40,
                "suggestedResponse": RESPONSE_TEMPLATES["other"],
                "model": "fallback",
                "canSelfResolve": False,
                "selfHelpSteps": [],
                "matchedIntent": None,
            }

        if self.ready and self.category_model and self.priority_model:
            category = self.category_model.predict(text)
            priority = self.priority_model.predict(text)
            confidence = int(round(self.category_model.confidence(text) * 100))
            model_name = "tfidf_nb_custom"
        else:
            category, priority, confidence = self._rules_fallback(text)
            model_name = "rules_fallback"

        kb_hit = self._best_kb_match(text)
        suggested = RESPONSE_TEMPLATES.get(category, RESPONSE_TEMPLATES["other"])
        hint = self.hints.get(category)
        if hint:
            suggested = f"{suggested} Piste recommandée: {hint}"
        if kb_hit and kb_hit.get("answer"):
            suggested = f"{kb_hit['answer']}"

        if kb_hit and kb_hit.get("category") == category:
            confidence = min(97, confidence + 6)

        return {
            "category": category,
            "priority": priority,
            "confidence": confidence,
            "suggestedResponse": suggested.strip(),
            "model": model_name,
            "canSelfResolve": bool(kb_hit and kb_hit.get("self_fixable")),
            "selfHelpSteps": (kb_hit or {}).get("steps", [])[:5],
            "matchedIntent": (kb_hit or {}).get("intent"),
        }

    async def chat_async(self, message: str, history: list[dict] | None = None) -> dict[str, Any]:
        from llm_client import extract_numbered_steps, llm_client

        text = normalize_text(message)
        history = history or []

        if not text:
            return {
                "reply": "Bonjour ! Je suis l'assistant IT Tritux. Décrivez votre problème comme à un collègue (VPN, mot de passe, Outlook, Teams…), je vous guide étape par étape.",
                "canSelfResolve": False,
                "steps": [],
                "suggestTicket": False,
                "category": None,
                "priority": None,
                "confidence": 0,
                "intent": None,
                "provider": llm_client.provider or "local",
            }

        analysis = self.analyze(message, message)
        kb = self._best_kb_match(text)

        # LLM conversation (Gemini / OpenAI) when API key is configured
        if llm_client.available:
            extra = (
                f"Classification ML interne (aide au contexte): "
                f"catégorie={analysis['category']}, priorité={analysis['priority']}, "
                f"confiance={analysis['confidence']}%. "
            )
            if kb:
                extra += (
                    f"Fiche knowledge-base proche: {kb.get('title')} — "
                    f"self_fixable={kb.get('self_fixable')}. "
                    f"Étapes connues: {'; '.join(kb.get('steps', [])[:4])}."
                )
            try:
                reply = await llm_client.chat(message, history, extra_context=extra)
                steps = extract_numbered_steps(reply) or (kb.get("steps", [])[:5] if kb else [])
                can_self = bool(kb.get("self_fixable")) if kb else bool(steps)
                low_conf = analysis["confidence"] < 55
                return {
                    "reply": reply,
                    "canSelfResolve": can_self and not low_conf,
                    "steps": steps,
                    "suggestTicket": (not can_self) or low_conf or analysis["category"] == "security",
                    "category": analysis["category"],
                    "priority": analysis["priority"],
                    "confidence": max(analysis["confidence"], 75),
                    "intent": (kb or {}).get("intent") or analysis.get("matchedIntent"),
                    "provider": llm_client.provider,
                }
            except Exception as exc:
                print(f"[AIEngine] LLM error, fallback local: {exc}")

        # Fallback local (sans clé API)
        return self._chat_local(message, analysis, kb)

    def chat(self, message: str, history: list[dict] | None = None) -> dict[str, Any]:
        """Fallback synchrone (sans LLM)."""
        text = normalize_text(message)
        if not text:
            return {
                "reply": "Bonjour, je suis l'assistant IT Tritux. Décrivez votre problème (VPN, mot de passe, Outlook, Teams, imprimante…).",
                "canSelfResolve": False,
                "steps": [],
                "suggestTicket": False,
                "category": None,
                "priority": None,
                "confidence": 0,
                "intent": None,
                "provider": "local",
            }
        analysis = self.analyze(message, message)
        kb = self._best_kb_match(text)
        return self._chat_local(message, analysis, kb)

    def _chat_local(self, message: str, analysis: dict, kb: dict | None) -> dict[str, Any]:
        if kb and kb.get("score", 0) >= 1:
            steps = kb.get("steps", [])
            reply = (
                f"{kb.get('title', 'Assistance')}\n\n"
                f"{kb.get('answer', '')}\n\n"
                "Voici les étapes à suivre. Dites-moi ce que vous obtenez après chaque étape."
            )
            return {
                "reply": reply,
                "canSelfResolve": bool(kb.get("self_fixable")),
                "steps": steps,
                "suggestTicket": (not bool(kb.get("self_fixable"))) or analysis["confidence"] < 55,
                "category": analysis["category"],
                "priority": analysis["priority"],
                "confidence": max(analysis["confidence"], 70),
                "intent": kb.get("intent"),
                "provider": "local",
            }

        reply = (
            f"J'ai identifié une demande probablement liée à « {analysis['category']} » "
            f"(priorité estimée: {analysis['priority']}, confiance {analysis['confidence']}%).\n\n"
            f"{analysis['suggestedResponse']}\n\n"
            "Pour un dialogue plus fluide type ChatGPT/Gemini, configurez une clé "
            "GEMINI_API_KEY dans backend/ai-service/.env puis relancez le service IA.\n\n"
            "En attendant: que se passe-t-il exactement, et depuis quand ?"
        )
        return {
            "reply": reply,
            "canSelfResolve": analysis["canSelfResolve"],
            "steps": analysis.get("selfHelpSteps", []),
            "suggestTicket": True,
            "category": analysis["category"],
            "priority": analysis["priority"],
            "confidence": analysis["confidence"],
            "intent": analysis.get("matchedIntent"),
            "provider": "local",
        }

    def _best_kb_match(self, text: str) -> dict | None:
        best = None
        best_score = 0
        for item in self.knowledge_base:
            score = 0
            for kw in item.get("keywords", []):
                kw_n = normalize_text(kw)
                if kw_n and kw_n in text:
                    score += 2 if len(kw_n) > 4 else 1
            title_n = normalize_text(item.get("title", ""))
            if title_n and any(tok in text for tok in title_n.split() if len(tok) > 3):
                score += 1
            if score > best_score:
                best_score = score
                best = {**item, "score": score}
        return best if best_score > 0 else None

    def _rules_fallback(self, text: str) -> tuple[str, str, int]:
        rules = [
            (["phishing", "ransomware", "malware", "hack", "suspect"], "security", "urgent", 90),
            (["vpn", "reseau", "réseau", "wifi", "dns", "proxy", "internet"], "network", "high", 85),
            (["mailbox", "mail", "email", "ndr", "outlook"], "email", "medium", 80),
            (["mot de passe", "password", "compte", "mfa", "sso", "acces", "accès"], "account", "high", 82),
            (["teams", "excel", "word", "office", "logiciel", "onedrive"], "software", "medium", 78),
            (["ecran", "écran", "imprimante", "clavier", "souris", "batterie", "dock"], "hardware", "low", 75),
        ]
        for keys, cat, prio, conf in rules:
            if any(k in text for k in keys):
                return cat, prio, conf
        return "other", "medium", 55


engine = AIEngine()
