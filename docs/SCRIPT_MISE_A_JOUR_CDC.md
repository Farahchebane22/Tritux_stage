# SCRIPT — Mise à jour du Cahier des charges TritGroupe

> **Usage :** Copier ce document entier dans Claude (ou autre IA) avec le PDF original  
> `Cahier_des_charges_TritGroupe.docx.pdf` et demander :  
> *« Mets à jour mon cahier des charges en intégrant les évolutions ci-dessous, en conservant le style, la numérotation et le ton professionnel du document original. »*

---

## CONTEXTE POUR L'IA RÉDACTRICE

**Projet :** Plateforme intelligente de gestion des tickets IT — Tritux Groupe  
**Stagiaire :** Farah Chebane — ESPRIT, 4ème année ArcTic / Cloud Computing  
**Encadrante :** Mme Amal Mahdhi  
**Durée :** 8 semaines (juillet – août 2026)  
**Dépôt :** `stage_ete_tritux` (Vue 3 + Node.js microservices + FastAPI + MySQL + Docker + CI/CD)

Le cahier des charges **initial** (v1) couvrait les fonctionnalités de base ITSM + IA de classification + DevOps.  
Pendant la **Phase 3 (développement)**, des **évolutions fonctionnelles et techniques** ont été ajoutées pour améliorer l'expérience utilisateur, la sécurité et l'intelligence du système.  
Ce script décrit **ce qui est implémenté** pour enrichir le CDC **sans changer l'esprit MVP** du projet.

---

## INSTRUCTIONS DE RÉDACTION POUR CLAUDE

1. **Conserver** la structure du CDC original (sections 1 à 15, tableaux, ton formel).
2. **Enrichir** (ne pas remplacer brutalement) les sections suivantes :
   - §4 Objectifs spécifiques
   - §5.1 Fonctionnalités incluses
   - §7 Besoins fonctionnels (ajouter §7.10 à §7.14)
   - §9 Architecture technique (préciser stack réelle)
   - §11 Livrables attendus
   - §13 Critères de validation
3. **Ajouter** une sous-section **« Évolutions post-cadrage (v2) »** ou **« Extensions fonctionnelles »** expliquant les ajouts par rapport au périmètre initial.
4. **Mettre à jour** le tableau des utilisateurs / rôles avec les règles d'accès fines.
5. **Rester réaliste** : mentionner que certaines évolutions sont des **extensions MVP** réalisées en Phase 3, pas des changements de scope hors délai.

---

## A. RAPPEL — EXIGENCES CDC INITIALES (DÉJÀ COUVERTES)

| Exigence CDC v1 | Statut implémentation | Preuve technique |
|-----------------|----------------------|------------------|
| Authentification + rôles (user / agent / admin) | ✅ Implémenté | JWT, `user-service`, guards frontend |
| Création / consultation tickets | ✅ Implémenté | `CreateTicketView`, `TicketListView`, API REST |
| Cycle de vie (open → inprogress → resolved → closed) | ✅ Implémenté | `ticket-service`, historique |
| Affectation tickets | ✅ Implémenté | PATCH `/tickets/:id/assign` |
| Filtrage (statut, priorité, catégorie) | ✅ Implémenté | `TicketListView` |
| IA classification catégorie + priorité | ✅ Implémenté | `POST /ai/analyze`, modèle TF-IDF + Naive Bayes |
| Commentaires + historique | ✅ Implémenté | Onglets ticket, table `history` |
| Pièces jointes | ✅ Implémenté | Multer upload, table `attachments` |
| Notifications | ✅ Implémenté | CDC §7.8, table `notifications` |
| Évaluation satisfaction | ✅ Implémenté | `SatisfactionModal`, table `satisfaction_ratings` |
| Tableau de bord KPIs | ✅ Implémenté | `DashboardView` (stats réelles) |
| Conteneurisation Docker | ✅ Implémenté | `docker-compose.yml`, Dockerfiles |
| Pipeline CI/CD | ✅ Implémenté | `.github/workflows/ci-cd.yml` |
| Déploiement cloud AWS | ⏳ Phase 4 | Prévu semaines 6–7 |

---

## B. ÉVOLUTIONS À INTÉGRER DANS LE CDC (VERSION ENRICHIE v2)

### B.1 — Profil utilisateur persistant et sécurisé

**Problème résolu :** Perte des modifications profil après déconnexion (données uniquement en localStorage).

**Fonctionnalités ajoutées :**
- Page **Mon profil** avec édition nom et email persistés en **MySQL**
- Changement de **mot de passe** (bcrypt, colonne `password_hash`)
- Champs **non modifiables par l'utilisateur** : rôle, département (gérés par l'IT / admin)
- Rechargement profil depuis la base à chaque connexion (`GET /users/me`, `PUT /profile`)

**Texte proposé pour §7.1 :**
> Le système permettra à chaque utilisateur de consulter et modifier ses informations personnelles (nom, email, mot de passe). Le département et le rôle resteront attribués par l'administration IT et ne seront pas modifiables depuis l'interface profil. Les données seront persistées en base de données afin de garantir la cohérence entre les sessions.

---

### B.2 — Contrôle d'accès fin aux tickets (RBAC)

**Évolution par rapport au CDC initial** (qui mentionnait seulement « admin/agent voit tout »).

| Rôle | Visibilité tickets |
|------|-------------------|
| **Utilisateur** | Uniquement ses propres tickets (`created_by_id`) |
| **Agent IT** | Uniquement les tickets **qui lui sont assignés** |
| **Administrateur** | **Tous** les tickets |

**Texte proposé pour §7.2 / §6 :**
> Le système appliquera un contrôle d'accès basé sur les rôles (RBAC) : l'utilisateur standard ne consulte que ses demandes ; l'agent IT ne voit que les tickets qui lui sont affectés ; l'administrateur dispose d'une vue globale pour supervision et réaffectation.

---

### B.3 — Affectation intelligente par domaine / catégorie

**Fonctionnalité ajoutée :** Lors de l'affectation d'un ticket, l'administrateur voit les agents **groupés par spécialité IT** correspondant à la **catégorie du ticket**.

**Exemples de spécialités agents :**
- Agent A : Réseau, Sécurité, Compte & accès
- Agent B : Logiciel, Email, Matériel

**Comportement :**
- Groupe « Spécialistes — [catégorie] » en tête de liste
- Groupe « Autres agents IT » en complément
- Affichage des domaines de chaque agent

**Texte proposé pour §7.3 :**
> L'affectation des tickets pourra s'appuyer sur les **domaines de compétence** des agents IT (spécialités par catégorie : réseau, sécurité, logiciel, etc.), afin de faciliter le routage vers le bon interlocuteur et réduire les délais de traitement.

**Modèle de données :** colonne `specialties` (CSV) dans la table `users`.

---

### B.4 — Assistant conversationnel IA (chatbot IT)

**Extension majeure du §7.4 « Assistance intelligente ».**

Au-delà de la simple suggestion à la création de ticket, le système intègre un **assistant conversationnel flottant** accessible depuis toute l'application.

**Capacités :**
- Dialogue naturel en français (style ChatGPT / Gemini)
- Diagnostic guidé étape par étape (VPN, Outlook, phishing, MFA…)
- Historique de conversation contextuel
- Propositions de **réponses rapides** et bouton **« Créer un ticket »** prérempli
- Intégration avec l'analyse ML (catégorie / priorité affichées dans le chat)
- **Knowledge base** locale (12 scénarios self-help)
- **LLM externe** (Google Gemini, clé API) pour fluidité ; fallback local sans clé

**Endpoints :** `POST /ai/chat`, `GET /ai/health`

**Texte proposé pour §7.4 (enrichi) :**
> Le module d'assistance intelligente comprendra :
> 1. Une **analyse automatique** à la création du ticket (catégorie, priorité, confiance, étapes d'auto-dépannage).
> 2. Un **assistant conversationnel** intégré à l'interface, capable de dialoguer avec l'utilisateur, de poser des questions de diagnostic et de proposer des actions correctives avant l'ouverture formelle d'un ticket.
> 3. Une **base de connaissances** métier (scénarios IT récurrents en français).
> 4. Une intégration **LLM** (Google Gemini) configurable, avec repli sur un moteur local en l'absence de clé API.

---

### B.5 — Module « Analyse cyber » (sécurité)

**Nouvelle fonctionnalité** — non présente dans le CDC v1.

**Objectif :** Permettre à tout utilisateur de soumettre un contenu suspect (email, message Teams, URL, description d'incident) pour une **évaluation de risque cyber** avant création d'un ticket Sécurité.

**Capacités :**
- Analyse par **règles métier** (phishing, ransomware, malware, vol d'identifiants, lien suspect, compte compromis, ingénierie sociale)
- Score de risque : faible / moyen / élevé / critique
- Indicateurs détectés + actions immédiates numérotées
- Enrichissement par **Gemini** (résumé analyste SOC)
- Bouton **« Créer un ticket Sécurité »** avec catégorie `security` et priorité automatique

**Endpoint :** `POST /ai/cyber/analyze`  
**Page frontend :** `/security` — menu « Analyse cyber »

**Texte proposé pour nouveau §7.10 :**
> **7.10 Module d'analyse cyber**
> Le système intégrera un module dédié à l'analyse préliminaire des contenus suspects (emails de phishing, liens douteux, alertes antivirus, signes de compromission de compte). Ce module produira un niveau de risque, des indicateurs et des recommandations immédiates, puis permettra la création automatique d'un ticket de catégorie Sécurité. Ce module complète l'assistance IA générale et répond aux enjeux de sensibilisation et de réactivité face aux incidents cyber en entreprise.

---

### B.6 — Pipeline IA / dataset métier

**Renforcement technique du module IA (§9 et livrables) :**

- Dataset synthétique **~440 tickets IT en français** (`generate_dataset.py`)
- Nettoyage et entraînement (`clean_data.py`, `train_model.py`)
- Modèle custom **TF-IDF + Naive Bayes** (`tritux_ml.py`) — indépendant de scikit-learn (compatibilité environnement)
- Métriques stockées (`models/metrics.json`)
- Knowledge base JSON (`data/knowledge_base.json`)

**Texte proposé pour §9.1 (ligne Module IA) :**
> Module IA : Python (FastAPI), micro-service dédié — classification ML (TF-IDF + Naive Bayes), chatbot conversationnel (Gemini / fallback local), analyse cyber par règles + LLM.

---

### B.7 — Architecture microservices réalisée

**Texte proposé pour §9.2 (précision implémentation) :**

```
Frontend Vue 3 (port 5173 dev / 8080 Docker)
        ↓
API Gateway Node.js (port 5000) — routage /api/*
        ↓
├── user-service (5001) — auth, profil, agents
├── ticket-service (5002) — tickets, comments, attachments, notifications
└── ai-service (8000) — FastAPI : /analyze, /chat, /cyber/analyze
        ↓
MySQL 8 (tritux_db) — 8 tables
```

**Tables MySQL :** `users`, `tickets`, `comments`, `attachments`, `history`, `satisfaction_ratings`, `ai_suggestions`, `notifications`

---

### B.8 — Authentification renforcée (évolution login)

- Suppression de la **connexion rapide démo** (boutons User/Agent/Admin) en production
- Login par **email + mot de passe** ; rôle déterminé par la base (pas choisi à la connexion)
- Inscription utilisateur avec rôle forcé `user`
- Comptes démo seed : `admin@tritux.com`, `leila.mansour@tritux.com` (agent), `sami.belhadj@tritux.com` (user)

---

## C. NOUVEAUX OBJECTIFS SPÉCIFIQUES À AJOUTER (§4)

Proposer d'ajouter ces bullet points :

- Offrir un **assistant conversationnel IA** pour guider l'utilisateur avant et pendant la création de ticket.
- Permettre une **analyse cyber préliminaire** des contenus suspects avec création de ticket Sécurité.
- Appliquer un **contrôle d'accès fin** : agents limités à leurs tickets assignés, admin vue globale.
- Faciliter l'**affectation par spécialité** selon la catégorie du ticket.
- Garantir la **persistance du profil utilisateur** et la gestion sécurisée du mot de passe.

---

## D. NOUVEAUX CRITÈRES DE VALIDATION (§13)

Ajouter :

- Un agent IT ne voit que les tickets qui lui sont assignés ; l'admin voit l'ensemble.
- L'assistant IA répond de manière conversationnelle (Gemini ou mode local).
- Le module Analyse cyber produit un score de risque et permet de créer un ticket Sécurité prérempli.
- Le profil utilisateur (nom, email, mot de passe) persiste après déconnexion ; le département n'est pas modifiable par l'utilisateur.
- L'affectation propose des agents spécialisés selon la catégorie du ticket.

---

## E. PLANNING — AJUSTEMENT OPTIONNEL (§12)

| Phase | Semaine | Contenu enrichi |
|-------|---------|-----------------|
| Phase 3 | 3–5 | + Chatbot IA, module cyber, RBAC fin, profil persistant, affectation par spécialité |
| Phase 4 | 6–7 | Docker Compose, CI/CD GitHub Actions, déploiement AWS |

---

## F. DIAGRAMME CAS D'UTILISATION (À DEMANDER À CLAUDE)

Demander à Claude de produire ou mettre à jour un diagramme UML incluant :

**Acteurs :** Utilisateur, Agent IT, Administrateur, Module IA

**Cas d'utilisation nouveaux :**
- `Discuter avec l'assistant IA`
- `Analyser un contenu cyber`
- `Modifier son profil / mot de passe`
- `Affecter un ticket à un agent spécialisé`

---

## G. PROMPT FINAL À COLLER DANS CLAUDE

```
Tu es rédacteur technique pour un rapport de stage ESPRIT / Tritux Groupe.

DOCUMENT DE RÉFÉRENCE : [joindre le PDF Cahier_des_charges_TritGroupe]

DOCUMENT D'ÉVOLUTIONS : [joindre ce fichier SCRIPT_MISE_A_JOUR_CDC.md]

TÂCHE :
1. Produire une VERSION ENRICHIE (v2) du cahier des charges en français formel.
2. Conserver la structure et le ton du document original.
3. Intégrer toutes les évolutions des sections A à E.
4. Ajouter les sections §7.10 (Analyse cyber) et enrichir §7.4 (Chatbot).
5. Mettre à jour les tableaux (rôles, stack, critères de validation).
6. Ajouter une courte section « Évolutions post-cadrage » expliquant que ces ajouts renforcent le MVP sans dépasser le délai de 8 semaines.
7. Ne pas supprimer les exigences DevOps (Docker, CI/CD, AWS) — Phase 4 reste planifiée.

FORMAT DE SORTIE :
- Document Word-ready (titres, sous-titres, tableaux markdown)
- Longueur similaire au CDC original (+ 2 à 3 pages max)
- Pas de code source dans le corps du document (références techniques en annexe si besoin)
```

---

## H. FICHIERS CLÉS DU PROJET (RÉFÉRENCE RAPIDE)

| Composant | Chemin |
|-----------|--------|
| Frontend Vue 3 | `frontend/src/` |
| Chatbot | `frontend/src/components/AiChatbot.vue` |
| Analyse cyber | `frontend/src/views/CyberAnalyzeView.vue` |
| Profil | `frontend/src/views/ProfileView.vue` |
| API Gateway | `backend/api-gateway/server.js` |
| Users + profil | `backend/user-service/server.js` |
| Tickets + RBAC | `backend/ticket-service/server.js` |
| IA FastAPI | `backend/ai-service/main.py` |
| Moteur cyber | `backend/ai-service/cyber_engine.py` |
| LLM Gemini | `backend/ai-service/llm_client.py` |
| ML classification | `backend/ai-service/tritux_ml.py` |
| Schéma BDD | `database/init.sql` |
| Docker | `docker-compose.yml` |
| CI/CD | `.github/workflows/ci-cd.yml` |

---

*Document généré pour Farah Chebane — Stage Tritux Groupe — Août 2026*
