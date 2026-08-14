"""
Moteur d'analyse cyber légère (MVP).
Règles FR + enrichissement optionnel via LLM (Gemini).
"""
from __future__ import annotations

import re
from typing import Any

from llm_client import llm_client

THREAT_LABELS = {
    "phishing": "Phishing / usurpation",
    "malware": "Malware / antivirus",
    "ransomware": "Ransomware",
    "credential_theft": "Vol d'identifiants",
    "suspicious_link": "Lien / URL suspecte",
    "account_compromise": "Compte compromis",
    "social_engineering": "Ingénierie sociale",
    "other": "Incident sécurité (à classer)",
}

PRIORITY_BY_RISK = {
    "critical": "urgent",
    "high": "urgent",
    "medium": "high",
    "low": "medium",
}

RULES: list[dict[str, Any]] = [
    {
        "threat": "ransomware",
        "risk": "critical",
        "score": 95,
        "patterns": [
            r"ransomware",
            r"\.locked\b",
            r"fichiers?\s+chiffr",
            r"ran[cç]on",
            r"bitcoin.*(paiement|payer)",
            r"vos fichiers ont [eé]t[eé] chiffr",
        ],
        "indicators": ["Signes de chiffrement / rançon"],
        "steps": [
            "Débranchez immédiatement le réseau (Wi‑Fi / câble).",
            "N'éteignez pas le PC brutalement si possible — notez les extensions de fichiers.",
            "Alertez immédiatement le SOC / IT Tritux.",
            "Ne payez aucune rançon et n'ouvrez aucun fichier suspect.",
        ],
    },
    {
        "threat": "phishing",
        "risk": "high",
        "score": 88,
        "patterns": [
            r"phishing",
            r"mail\s+suspect",
            r"email\s+suspect",
            r"usurpation",
            r"faux\s+(mail|email|message)",
            r"mot\s+de\s+passe.*(lien|cliquer|saisir)",
            r"cliquer?\s+(ici|sur\s+le\s+lien)",
            r"votre\s+compte\s+(sera|va\s+[eê]tre)\s+(bloqu|suspend)",
            r"v[eé]rifiez?\s+vos?\s+(coordonn[eé]es|identifiants)",
            r"securite@(?!tritux)",
            r"service\s+rh.*(identifiant|mot\s+de\s+passe)",
        ],
        "indicators": ["Langage d'urgence", "Demande d'identifiants", "Message suspect"],
        "steps": [
            "Ne cliquez sur aucun lien et n'ouvrez aucune pièce jointe.",
            "Signalez le message via « Signaler un phishing » dans Outlook.",
            "Si vous avez saisi un mot de passe : changez-le immédiatement et activez/réinitialisez le MFA.",
            "Transférez le mail à l'équipe sécurité Tritux sans supprimer les en-têtes.",
        ],
    },
    {
        "threat": "credential_theft",
        "risk": "high",
        "score": 85,
        "patterns": [
            r"saisir\s+(mon|votre|ton)\s+mot\s+de\s+passe",
            r"entrer\s+(vos|tes)\s+identifiants",
            r"formulaire\s+(de\s+)?connexion\s+externe",
            r"page\s+de\s+login\s+(fausse|suspecte)",
            r"SSO.*(lien|externe)",
        ],
        "indicators": ["Demande de credentials hors portail officiel"],
        "steps": [
            "Ne saisissez jamais vos identifiants Tritux hors des portails officiels.",
            "Changez votre mot de passe SSO si vous avez déjà saisi quelque chose.",
            "Révoquez les sessions actives (Office 365 / compte Microsoft).",
            "Ouvrez un ticket sécurité avec la capture / l'URL exacte.",
        ],
    },
    {
        "threat": "malware",
        "risk": "high",
        "score": 82,
        "patterns": [
            r"malware",
            r"virus",
            r"trojan",
            r"windows\s+defender",
            r"antivirus.*(d[eé]tect|quarantaine|bloqu)",
            r"fichier\.exe",
            r"t[eé]l[eé]charg[eé].*\.exe",
        ],
        "indicators": ["Détection antivirus / exécutable suspect"],
        "steps": [
            "Ne restaurez pas le fichier mis en quarantaine.",
            "Lancez un scan complet Windows Defender / antivirus entreprise.",
            "Déconnectez le poste du réseau si l'alerte est critique.",
            "Notez le nom du fichier et le chemin pour le ticket IT.",
        ],
    },
    {
        "threat": "suspicious_link",
        "risk": "medium",
        "score": 70,
        "patterns": [
            r"https?://[^\s]+",
            r"bit\.ly",
            r"tinyurl",
            r"lien\s+(raccourci|suspect|douteux)",
            r"teams.*lien",
            r"url\s+suspecte",
        ],
        "indicators": ["URL / lien présent dans le contenu"],
        "steps": [
            "Ne cliquez pas sur le lien ; survolez-le pour voir la vraie destination.",
            "Comparez le domaine avec les domaines officiels Tritux / Microsoft.",
            "Si doute : copiez l'URL dans le ticket sans l'ouvrir.",
            "Signalez le message à l'expéditeur / au canal Teams concerné.",
        ],
    },
    {
        "threat": "account_compromise",
        "risk": "high",
        "score": 86,
        "patterns": [
            r"compte\s+(pirat|compromis)",
            r"connexion(s)?\s+(inhabituelle|suspecte)",
            r"depuis\s+l['']?[eé]tranger",
            r"session(s)?\s+(inconnue|suspecte)",
            r"RDP\s+(inhabitu|hors\s+heures)",
            r"tentative(s)?\s+de\s+connexion",
        ],
        "indicators": ["Activité de compte anormale"],
        "steps": [
            "Changez immédiatement le mot de passe et régénérez le MFA.",
            "Déconnectez toutes les sessions (Outlook Web / compte Microsoft).",
            "Vérifiez les règles de redirection Outlook et les applications OAuth.",
            "Ouvrez un ticket urgent pour audit du compte.",
        ],
    },
    {
        "threat": "social_engineering",
        "risk": "medium",
        "score": 65,
        "patterns": [
            r"urgent.*(directeur|pdg|ceo|rh)",
            r"virement\s+urgent",
            r"carte\s+cadeau",
            r"garde[rz]\s+confidentiel",
            r"ne\s+dis\s+[aà]\s+personne",
            r"appel\s+suspect",
        ],
        "indicators": ["Pression / urgence inhabituelle"],
        "steps": [
            "Ne transférez aucun fonds et ne communiquez aucun secret.",
            "Vérifiez la demande via un canal connu (Teams / téléphone interne).",
            "Documentez l'échange (heure, interlocuteur, contenu).",
            "Signalez l'incident au support IT / sécurité.",
        ],
    },
]

DEFAULT_STEPS = [
    "Ne partagez aucun mot de passe ni code MFA.",
    "Conservez le message / capture d'écran comme preuve.",
    "Si doute : créez un ticket catégorie Sécurité.",
    "Contactez le support IT Tritux si l'impact métier est immédiat.",
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower().strip())


def _extract_urls(text: str) -> list[str]:
    return re.findall(r"https?://[^\s<>\"']+", text or "", flags=re.IGNORECASE)[:8]


def analyze_local(content: str) -> dict[str, Any]:
    text = _normalize(content)
    urls = _extract_urls(content)

    matches: list[dict[str, Any]] = []
    indicators: list[str] = []

    for rule in RULES:
        hit = False
        for pat in rule["patterns"]:
            if re.search(pat, text, flags=re.IGNORECASE):
                hit = True
                break
        if hit:
            matches.append(rule)
            for ind in rule.get("indicators", []):
                if ind not in indicators:
                    indicators.append(ind)

    if urls:
        if "URL détectée dans le contenu" not in indicators:
            indicators.append("URL détectée dans le contenu")
        # bump suspicious_link if URLs present and no stronger match
        if not matches:
            matches.append(next(r for r in RULES if r["threat"] == "suspicious_link"))

    if not matches:
        return {
            "riskLevel": "low",
            "riskScore": 25,
            "threatType": "other",
            "threatLabel": THREAT_LABELS["other"],
            "priority": "medium",
            "confidence": 40,
            "summary": (
                "Aucun indicateur critique détecté automatiquement. "
                "Le contenu peut quand même être sensible — restez prudent."
            ),
            "indicators": indicators or ["Analyse générique — peu de signaux connus"],
            "immediateActions": DEFAULT_STEPS,
            "suggestTicket": True,
            "urls": urls,
            "provider": "local",
        }

    # Highest score / risk wins
    risk_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    best = max(matches, key=lambda r: (risk_rank.get(r["risk"], 0), r["score"]))

    # Combine unique steps from top matches
    steps: list[str] = []
    for m in sorted(matches, key=lambda r: -r["score"])[:2]:
        for s in m.get("steps", []):
            if s not in steps:
                steps.append(s)

    threat = best["threat"]
    risk = best["risk"]
    score = min(99, best["score"] + (5 if len(matches) > 1 else 0))

    summary = (
        f"Analyse locale : risque {risk.upper()} ({score}/100). "
        f"Type probable : {THREAT_LABELS.get(threat, threat)}. "
        f"{len(matches)} règle(s) déclenchée(s)."
    )

    return {
        "riskLevel": risk,
        "riskScore": score,
        "threatType": threat,
        "threatLabel": THREAT_LABELS.get(threat, threat),
        "priority": PRIORITY_BY_RISK.get(risk, "high"),
        "confidence": min(95, 55 + score // 3),
        "summary": summary,
        "indicators": indicators[:8],
        "immediateActions": steps[:6] or DEFAULT_STEPS,
        "suggestTicket": risk in ("critical", "high", "medium"),
        "urls": urls,
        "provider": "local",
    }


async def enrich_with_llm(content: str, base: dict[str, Any]) -> dict[str, Any]:
    if not llm_client.available:
        return base

    prompt = (
        "Tu es l'analyste cybersécurité du helpdesk Tritux. "
        "À partir du contenu utilisateur et de l'analyse automatique, "
        "rédige en français un résumé clair (4-6 phrases max) : "
        "risque, pourquoi, et 1 conseil prioritaire. "
        "Ne demande jamais de mot de passe. Ne sois pas alarmiste sans raison.\n\n"
        f"Analyse auto: risque={base['riskLevel']}, type={base['threatLabel']}, "
        f"score={base['riskScore']}, indicateurs={', '.join(base['indicators'])}.\n\n"
        f"Contenu utilisateur:\n{content[:2500]}"
    )
    try:
        reply = await llm_client.chat(prompt, history=[], extra_context="")
        if reply and len(reply.strip()) > 40:
            base = {**base, "summary": reply.strip(), "provider": llm_client.provider or "local"}
    except Exception as exc:
        print(f"[cyber] LLM enrich failed: {exc}")
    return base


async def analyze_cyber(content: str) -> dict[str, Any]:
    base = analyze_local(content)
    return await enrich_with_llm(content, base)
