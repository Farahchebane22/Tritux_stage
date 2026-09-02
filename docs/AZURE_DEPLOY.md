# Azure — secrets pour le pipeline unique `.github/workflows/ci-cd.yml`

Le CD déploie sur **Azure Container Apps** (pas de VM). Une fois le secret `AZURE_CREDENTIALS` ajouté, un push sur `main` déploie tout.

## 1. Portail Azure (une fois)

1. Créer un **Resource group** (ex. `tritux-helpdesk-rg`) dans `West Europe` ou `France Central`.
2. Sur ton PC, Azure CLI :

```powershell
az login
az account show --query id -o tsv
az ad sp create-for-rbac --name tritux-github-cd --role contributor --scopes /subscriptions/<SUBSCRIPTION_ID> --sdk-auth
```

Copier tout le JSON affiché.

## 2. GitHub → Settings → Secrets and variables → Actions

| Secret | Obligatoire |
|--------|-------------|
| `AZURE_CREDENTIALS` | JSON de l’étape 1 |
| `MYSQL_PASSWORD` | Oui (ex. `TrituxDb1A`) |
| `JWT_SECRET` | Oui |
| `KEYCLOAK_ADMIN_PASSWORD` | Oui |
| `GEMINI_API_KEY` | Non |
| `AZURE_RESOURCE_GROUP` | Non (défaut `tritux-helpdesk-rg`) |
| `AZURE_LOCATION` | Non (défaut `westeurope`) |
| `DOCKERHUB_USERNAME` | Oui pour le push Docker Hub |
| `DOCKERHUB_TOKEN` | Oui (Access Token, **pas** le mot de passe du compte) |

## Docker Hub — étapes

1. Crée un compte sur [hub.docker.com](https://hub.docker.com/signup) (gratuit).
2. **Account Settings → Personal access tokens → Generate new token**  
   Description : `github-actions` — droits **Read, Write, Delete**. Copie le token (affiché une seule fois).
3. GitHub → ton repo → **Settings → Secrets and variables → Actions → New repository secret** :
   - `DOCKERHUB_USERNAME` = ton identifiant Hub (ex. `farahben`)
   - `DOCKERHUB_TOKEN` = le token de l’étape 2
4. Push sur `main` : le job **CI — Docker …** pousse les images (dépôts créés automatiquement) :
   - `TON_USER/tritux-frontend:latest`
   - `TON_USER/tritux-api-gateway:latest`
   - `TON_USER/tritux-user-service:latest`
   - `TON_USER/tritux-ticket-service:latest`
   - `TON_USER/tritux-contract-service:latest`
   - `TON_USER/tritux-report-service:latest`
   - `TON_USER/tritux-ai-service:latest`
   - `TON_USER/tritux-mysql:latest`
   - `TON_USER/tritux-keycloak:latest`
   - `TON_USER/tritux-landing:latest`
5. Vérifie sur `https://hub.docker.com/u/TON_USER`.

Plan gratuit : laisse les dépôts **publics** (1 seul dépôt privé). Un push sur une **PR** ne pousse **pas** sur Hub.

## 3. Déclencher

Push sur `main` / `master`, ou **Actions → Tritux Helpdesk CI/CD → Run workflow**.

Les logs du job **CD — Azure Container Apps** affichent les URLs (app, API, Keycloak, landing).

Dans Keycloak, ajouter `https://trx-frontend.<domaine>/*` aux Valid redirect URIs.

## Crédit étudiant (~100 $)

Container Apps (consommation) + ACR Basic. Arrêter / supprimer le resource group après la démo : Portail → Resource group → **Delete**.
