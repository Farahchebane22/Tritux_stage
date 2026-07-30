"""
Client LLM pour un chat fluide (style ChatGPT / Gemini).
Priorité: GEMINI_API_KEY > OPENAI_API_KEY > None (fallback local).
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parent


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()

SYSTEM_PROMPT = """Tu es l'assistant IT conversationnel de Tritux Groupe (helpdesk interne).
Tu parles français, de façon naturelle, claire et professionnelle — comme Gemini/ChatGPT.

Objectifs:
1. Comprendre le problème en posant des questions utiles si le contexte manque.
2. Proposer des étapes de résolution concrètes et numérotées quand c'est possible.
3. Indiquer clairement si l'utilisateur peut s'auto-dépanner ou s'il faut ouvrir un ticket.
4. Ne jamais demander de mot de passe en clair. En cas de phishing/sécurité: alerter immédiatement.
5. Rester concis (8-15 lignes max sauf si l'utilisateur demande plus de détail).

Contexte entreprise: stack typique Windows, Office 365, Teams, VPN, Active Directory / SSO, imprimantes réseau.

Si tu proposes des étapes, utilise ce format:
1. ...
2. ...
3. ...

Terminale ta réponse par une question courte pour faire avancer le diagnostic, sauf si le problème est clairement résolu.
"""


class LLMClient:
    def __init__(self) -> None:
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        self._gemini_fallbacks = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-2.0-flash-001",
            "gemini-flash-latest",
        ]

    @property
    def provider(self) -> str | None:
        if self.gemini_key:
            return "gemini"
        if self.openai_key:
            return "openai"
        return None

    @property
    def available(self) -> bool:
        return self.provider is not None

    async def chat(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        extra_context: str = "",
    ) -> str:
        history = history or []
        if self.gemini_key:
            return await self._gemini_chat(message, history, extra_context)
        if self.openai_key:
            return await self._openai_chat(message, history, extra_context)
        raise RuntimeError("Aucune clé LLM configurée")

    async def _gemini_chat(
        self, message: str, history: list[dict[str, str]], extra_context: str
    ) -> str:
        contents: list[dict[str, Any]] = []
        for m in history[-12:]:
            role = "user" if m.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})
        user_text = message
        if extra_context:
            user_text = f"{extra_context}\n\nMessage utilisateur: {message}"
        contents.append({"role": "user", "parts": [{"text": user_text}]})

        payload = {
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.9,
                # 2.5 Flash utilise des tokens "thinking" : budget plus large
                "maxOutputTokens": 2048,
            },
        }
        models = [self.gemini_model] + [
            m for m in self._gemini_fallbacks if m != self.gemini_model
        ]
        last_error: Exception | None = None
        data: dict[str, Any] = {}

        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in models:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent"
                )
                try:
                    resp = await client.post(
                        url, params={"key": self.gemini_key}, json=payload
                    )
                    if resp.status_code in (404, 429):
                        last_error = RuntimeError(
                            f"{model} → HTTP {resp.status_code}: {resp.text[:180]}"
                        )
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    self.gemini_model = model
                    break
                except httpx.HTTPStatusError as exc:
                    last_error = exc
                    continue
            else:
                raise RuntimeError(
                    f"Aucun modèle Gemini disponible. Dernière erreur: {last_error}"
                )

        try:
            parts = data["candidates"][0]["content"].get("parts") or []
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
            if text:
                return text
        except (KeyError, IndexError, TypeError):
            pass
        raise RuntimeError(f"Réponse Gemini invalide: {json.dumps(data)[:300]}")

    async def _openai_chat(
        self, message: str, history: list[dict[str, str]], extra_context: str
    ) -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if extra_context:
            messages.append({"role": "system", "content": extra_context})
        for m in history[-12:]:
            role = "assistant" if m.get("role") == "assistant" else "user"
            messages.append({"role": role, "content": m.get("content", "")})
        messages.append({"role": "user", "content": message})

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.openai_key}"},
                json={
                    "model": self.openai_model,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1024,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


def extract_numbered_steps(text: str) -> list[str]:
    steps = []
    for line in text.splitlines():
        m = re.match(r"^\s*(?:\d+[\).\:\-]|[-*])\s+(.+)$", line.strip())
        if m:
            step = m.group(1).strip()
            if len(step) > 3:
                steps.append(step)
    return steps[:6]


llm_client = LLMClient()
