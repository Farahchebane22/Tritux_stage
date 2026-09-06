# Technologies & Outils du Projet — Tritux Helpdesk

---

## 1. Synthèse de la Stack Technologique

Le projet s'appuie sur un ensemble de technologies modernes, éprouvées en milieu industriel, alliant performance, robustesse et facilité d'exploitation dans le Cloud.

```
+-------------------------------------------------------------------------------+
|                                 FRONTEND                                      |
|              Vue 3 (Composition API) • TypeScript • Pinia • Vite             |
|              Tailwind CSS & Design Tokens • Lucide Icons • Axios              |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                               API GATEWAY                                     |
|             Node.js • Express • http-proxy-middleware • CORS                  |
+-------------------------------------------------------------------------------+
               |                 |                 |                |
               v                 v                 v                v
+----------------+ +---------------+ +---------------+ +-----------------------+
|  USER-SERVICE  | | TICKET-SERVICE| | CONTRACT-SVC  | |      AI-SERVICE       |
| Node.js / MySQL| | Node.js / MySQL | Node.js/Twilio| |  Python 3.11 / FastAPI |
| Keycloak Sync  | | SLA Hook      | | 24/7 SLA Engine | ML TF-IDF / Gemini    |
+----------------+ +---------------+ +---------------+ +-----------------------+
               |                 |                 |                |
               +-----------------+-----------------+----------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                        INFRASTRUCTURE & SERVICES CLOUD                        |
|   Keycloak 24 (IAM OIDC) • Azure Container Apps • Azure MySQL Flexible Server |
|      Twilio Voice & SMS • Docker Hub • GitHub Actions CI/CD • Azure CLI       |
+-------------------------------------------------------------------------------+
```

---

## 2. Technologies Frontend

### Vue 3 & Composition API (`<script setup lang="ts">`)
- **Rôle** : Moteur de l'application Single Page Application (SPA).
- **Justification** :
  - La **Composition API** permet une modularité maximale en isolant la logique réactive dans des *composables* réutilisables (`useAuthStore`, `useContractStore`).
  - Système de réactivité fine via les proxies natifs ES6, assurant une fluidité d'affichage optimale sans re-rendering inutile de l'arbre DOM.

### TypeScript
- **Rôle** : Typage statique strict sur l'ensemble du code client (`src/types/index.ts`).
- **Justification** :
  - Prévention des erreurs d'exécution dès la compilation (notamment sur les structures complexes de tickets, contrats et utilisateurs).
  - Auto-complétion et contrat d'interface rigoureux entre les modèles API et les vues.

### Pinia
- **Rôle** : Gestion d'état global (State Management).
- **Justification** :
  - Remplacement officiel et moderne de Vuex : syntaxe concise, compatibilité TypeScript native, gestion modulaire des stores (`auth.ts`, `contract.ts`).
  - Gestion sécurisée de l'authentification et reprise transparente de session Keycloak après rechargement.

### Vite
- **Rôle** : Outil de build et serveur de développement ultra-rapide.
- **Justification** :
  - Démarrage instantané grâce aux modules ES natifs.
  - Bundling optimisé en production avec minification, split de chunks et injection de variables d'environnement au runtime.

### Axios & Intercepteurs HTTP
- **Rôle** : Client HTTP pour communiquer avec l'API Gateway.
- **Points Forts Implémentés** :
  - **Intercepteur Request** : Injection proactive du token JWT Bearer avec vérification d'expiration préventive (`ensureFreshToken`).
  - **Intercepteur Response** : Mécanisme de rattrapage automatique lors d'une erreur 401 via le `refresh_token` Keycloak et rejeu transparent de la requête initiale.
  - **Timeout maîtrisé** : Évite le blocage de l'interface en cas de lenteur réseau.

---

## 3. Technologies Backend & Microservices

### Node.js (v20 LTS) & Express
- **Rôle** : Moteur d'exécution des services `api-gateway`, `user-service`, `ticket-service`, `contract-service` et `report-service`.
- **Justification** :
  - Modèle d'E/S non-bloquant asynchrone (Event Loop) idéal pour des services orientés API et gestion d'événements.
  - Écosystème modulaire et rapide à conteneuriser sous Alpine Linux.

### Python 3.11 & FastAPI
- **Rôle** : Serveur du microservice d'Intelligence Artificielle (`ai-service`).
- **Justification** :
  - Écosystème de référence pour la Data Science et le Machine Learning.
  - **FastAPI** offre des performances asynchrones exceptionnelles (comparables à Node.js/Go) grâce à `uvicorn` et `Starlette`.
  - Validation automatique des requêtes et documentation interactive OpenAPI / Swagger générée nativement via `Pydantic`.

### `mysql2/promise`
- **Rôle** : Connecteur MySQL haute performance avec gestion de pool de connexions (`createPool`).
- **Justification** :
  - Support natif des requêtes préparées avec protection intégrale contre les injections SQL.
  - Connexions SSL chiffrées obligatoires pour dialoguer en toute sécurité avec Azure MySQL Flexible Server.

---

## 4. Sécurité & Identity and Access Management (IAM)

### Keycloak 24 (Quarkus)
- **Rôle** : Serveur d'authentification et fédération d'identités centrale.
- **Protocoles Exploités** :
  - **OpenID Connect (OIDC)** et **OAuth 2.0**.
  - **Direct Access Grants (Resource Owner Password Credentials)** : Permet d'authentifier les utilisateurs via notre interface customisée tout en émettant de vrais tokens Keycloak sécurisés.
  - **PKCE (Proof Key for Code Exchange) S256** : Protection cryptographique contre l'interception de tokens.
  - **JWT RS256** : Jetons signés avec une paire de clés asymétrique (RSA), vérifiés côté backend via l'endpoint de certificats `JWKS` (`/protocol/openid-connect/certs`).
  - **Service Accounts & Client Credentials** : Utilisé par le backend pour l'administration automatisée des utilisateurs Keycloak lors de l'auto-inscription d'une entreprise.

---

## 5. Téléphonie & Alerting d'Urgence

### Twilio Voice & Programmable SMS API
- **Rôle** : Envoi de SMS critiques et déclenchement d'appels téléphoniques vocaux synthétisés lors des incidents majeurs (Palier 2 et Palier 3 du SLA).
- **Fonctionnement** :
  - **SMS** : Notification instantanée avec identifiant du ticket, société et lien d'accès direct.
  - **Voice (TwiML)** : Synthèse vocale text-to-speech automatique délivrant un message d'alerte à l'agent de garde lors d'un incident de catégorie critique.

---

## 6. Cloud, Déploiement & DevOps

### Azure Container Apps (ACA)
- **Rôle** : Hébergement Serverless des conteneurs de l'ensemble de l'architecture.
- **Pourquoi ce choix plutôt qu'Azure Kubernetes Service (AKS) ou App Service ?**
  - **Coût & Facturation à la seconde** : Idéal pour un projet B2B avec des charges variables, évitant les coûts fixes élevés d'un cluster Kubernetes managé.
  - **Kubernetes sous le capot** : Bénéficie des capacités de scaling KEDA et d'auto-guérison sans la complexité de gestion manuelle du Control Plane.
  - **Ingress privé / public granulaire** : Seuls le Frontend, la Gateway et Keycloak sont exposés sur Internet ; tous les microservices métiers sont strictement confinés au réseau interne privé.

### Azure Database for MySQL Flexible Server
- **Rôle** : Base de données relationnelle managée en haute disponibilité.
- **Caractéristiques** : Sauvegardes automatisées, chiffrement au repos et en transit via TLS 1.2+, dimensionnement burstable (B1ms) adapté au budget étudiant.

### Docker & Multi-stage Builds
- **Rôle** : Packaging standardisé des 7 composants logiciels.
- **Optimisations** :
  - Utilisation d'images minimales `node:20-alpine` et `python:3.11-slim` pour réduire la surface d'attaque et le temps de téléchargement.
  - Séparation des dépendances de dev et de production (`--omit=dev`).

### GitHub Actions (CI/CD)
- **Fichier** : `.github/workflows/ci-cd.yml`
- **Pipeline** :
  1. **Linting & Validation** : Vérification statique du code.
  2. **Build Docker Multi-plateforme** : Construction automatisée et push sur **Docker Hub**.
  3. **Déploiement Continu sur Azure** : Authentification via Service Principal Azure (`az login --service-principal`) et mise à jour sans interruption (*zero-downtime rolling update*) des révisions Container Apps.

---

## 7. Tableau Récapitulatif & Justification des Choix

| Besoin Technique | Solution Retenue | Alternative Non Retenue | Motif du Choix |
|---|---|---|---|
| **Architecture** | Microservices découplés | Monolithe | Scalabilité indépendante de chaque service, isolation des pannes (si l'IA est saturée, les tickets continuent de fonctionner). |
| **IAM** | Keycloak | Authentification maison en base | Conformité aux standards de sécurité bancaires/entreprises (OIDC, tokens révocables, gestion des rôles centralisée). |
| **Moteur IA** | FastAPI (Python) | Node.js ML (`brain.js`) | Accès à l'écosystème scientifique Python, performances de NumPy et flexibilité d'intégration des LLMs. |
| **Hébergement Cloud** | Azure Container Apps | Azure App Service | Meilleure isolation réseau microservices natif, déploiement conteneurisé ultra-simple et coûts optimisés. |
| **Gestion d'état Client** | Pinia | Vuex 4 | API moderne sans boilerplate, intégration TypeScript native et store modulaire plus lisible. |
