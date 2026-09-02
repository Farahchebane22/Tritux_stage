# Tritux Helpdesk — SaaS B2B multi-clients + SLA

Plateforme de gestion de tickets IT (Vue 3 + microservices Node.js + FastAPI + MySQL + Keycloak),
étendue en **offre publique** : sociétés clientes sous **contrat de maintenance**, accès conditionné par **SLA**.

## Architecture

```
landing/                 Site vitrine public (:3000 Docker)
frontend/                App Vue 3 protégée (:5173 / :8080)
backend/
  api-gateway/           :5000
  user-service/          :5001 — users, sync Keycloak
  ticket-service/        :5002 — tickets + appel SLA
  contract-service/      :5003 — contrats, gate, moteur SLA  ← NOUVEAU
  report-service/        :5004 — rapports archivés           ← NOUVEAU
  shared/auth.js         JWT Keycloak + fallback legacy
ai-service/              :8000 — ML + chatbot + cyber
keycloak/                Realm tritux-helpdesk (:8081)
database/init.sql        Schéma multi-tenant + seeds
```

## Fonctionnalités conservées

Tickets, commentaires, pièces jointes, notifications, satisfaction, chatbot IA, analyse cyber,
affectation par spécialité — **toujours actives**.

## Nouveautés SaaS

| Module | Description |
|--------|-------------|
| Multi-tenant | `societes`, `applications`, `contrats_maintenance`, `sla_regles` |
| Keycloak | OIDC + PKCE (`tritux-frontend`), rôles `super-admin`, `agent-it`, `client-admin`, `client-user` |
| Gate contrat | Clients sans contrat → écran blocage ; avec contrat → récap obligatoire |
| Moteur SLA | Deadline, différé hors fenêtre, escalade mock (SMS/tél) |
| Rapports | Génération + archive par société (`/reports`) |
| Landing | `landing/index.html` + route `/welcome` |

## Variables d'environnement

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
VITE_KEYCLOAK_ENABLED=false          # true pour SSO Keycloak
VITE_KEYCLOAK_URL=http://localhost:8081
VITE_KEYCLOAK_REALM=tritux-helpdesk
VITE_KEYCLOAK_CLIENT_ID=tritux-frontend
```

### Backend (tous services Node)

```env
JWT_SECRET=tritux_secret_key_12345
KEYCLOAK_ENABLED=true                # false = JWT legacy uniquement
KEYCLOAK_URL=http://localhost:8081   # en Docker: http://keycloak:8080
KEYCLOAK_REALM=tritux-helpdesk
DB_HOST=localhost
DB_USER=tritux_user
DB_PASSWORD=tritux_password
DB_NAME=tritux_db
CONTRACT_SERVICE_URL=http://localhost:5003   # ticket-service
```

## Démarrage local (sans Keycloak — défaut)

1. XAMPP MySQL → importer `database/init.sql` (ou `migrate_saas.sql` si BDD déjà créée)
2. Backends :

```powershell
cd backend\user-service; npm install; npm start
cd backend\ticket-service; npm install; npm start
cd backend\contract-service; npm install; npm start
cd backend\report-service; npm install; npm start
cd backend\api-gateway; npm start
cd backend\ai-service; python main.py
```

3. Frontend :

```powershell
cd frontend
npm install
# garder VITE_KEYCLOAK_ENABLED=false
npm run dev
```

→ App : http://localhost:5173/welcome  
→ Landing statique : ouvrir `landing/index.html`

### Comptes démo (login legacy)

| Email | Rôle |
|-------|------|
| admin@tritux.com | SUPER_ADMIN |
| leila.mansour@tritux.com | AGENT_IT |
| nour.benali@acme.tn | CLIENT_ADMIN (soc Acme + contrat 5/7) |
| sami.belhadj@tritux.com | CLIENT_USER (soc Acme) |

## Keycloak (optionnel)

```powershell
docker compose up keycloak -d
```

Console admin : http://localhost:8081 (`admin` / `admin`)  
Realm importé : `tritux-helpdesk`

Puis dans `frontend/.env` :

```env
VITE_KEYCLOAK_ENABLED=true
```

Comptes seed Keycloak (voir `keycloak/realm-tritux-helpdesk.json`) :

| User | Password | Rôle |
|------|----------|------|
| admin@tritux.com | admin123 | super-admin |
| leila.mansour@tritux.com | agent123 | agent-it |
| nour.benali@acme.tn | client123 | client-admin |
| sami.belhadj@tritux.com | user123 | client-user |

## Docker complet

```powershell
docker compose up --build
```

- App : http://localhost:8080  
- Landing : http://localhost:3000  
- Keycloak : http://localhost:8081  
- API : http://localhost:5000/health  

Variables : copier `.env.example` vers `.env`.

## CI/CD et Azure

Un seul fichier : `.github/workflows/ci-cd.yml`

- **CI** (chaque PR / push) : frontend, 5 services Node, IA, `docker compose config`, build des 7 images.
- **CD** (push `main` / `master`) : Azure Container Apps (ACR + MySQL + Keycloak + tous les services). Secrets : voir `docs/AZURE_DEPLOY.md`.

## Flux client (contrat)

1. Auth Keycloak / legacy  
2. `GET /api/contracts/access/status`  
3. Pas de contrat → `/contract/none`  
4. Contrat actif → `/contract/recap` → ack journalisé → dashboard  
5. Création ticket → `POST /api/contracts/sla/evaluate` → `sla_deadline` / badge différé  

## Notification urgente (mock)

Interface : `NotificationService.sendUrgentAlert` dans `contract-service`  
Remplacer le mock par Twilio / SMS plus tard sans changer le contrat d’appel.

## Phase cloud

CI + CD Azure Container Apps : `.github/workflows/ci-cd.yml`  
Secrets GitHub : `docs/AZURE_DEPLOY.md`.
