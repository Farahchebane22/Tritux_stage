# Déploiement Azure Container Apps — guide complet

## 0. Prérequis

```powershell
# Installer Azure CLI si pas déjà fait : https://aka.ms/installazurecliwindows
az login
az account show   # vérifie que c'est bien ta souscription Étudiant qui est sélectionnée
az extension add --name containerapp --upgrade
```

## 1. Provisionnement initial (à lancer UNE SEULE FOIS)

Ouvre **PowerShell**, colle ce bloc en remplaçant les valeurs marquées `<...>` :

```powershell
# --- Variables ---
$RG = "tritux-rg"
$LOCATION = "francecentral"          # change en "westeurope" si erreur de région
$ENV_NAME = "tritux-env"
$DOCKERHUB_USER = "<ton-pseudo-dockerhub>"
$MYSQL_NAME = "tritux-mysql-<mets-un-suffixe-unique>"   # doit être unique dans tout Azure
$MYSQL_ADMIN = "tritux_admin"
$MYSQL_PASSWORD = "<choisis-un-mot-de-passe-fort>"
$JWT_SECRET = "<un-secret-aleatoire-long>"
$TWILIO_SID = "<ton-account-sid>"
$TWILIO_TOKEN = "<ton-auth-token>"
$TWILIO_PHONE = "<ton-numero-twilio>"

# --- Groupe de ressources ---
az group create --name $RG --location $LOCATION

# --- Base de données MySQL managée ---
az mysql flexible-server create `
  --resource-group $RG `
  --name $MYSQL_NAME `
  --location $LOCATION `
  --admin-user $MYSQL_ADMIN `
  --admin-password $MYSQL_PASSWORD `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --storage-size 20 `
  --version 8.0 `
  --public-access 0.0.0.0-255.255.255.255

az mysql flexible-server db create `
  --resource-group $RG `
  --server-name $MYSQL_NAME `
  --database-name tritux_db

# Importe ton schéma (via le client MySQL local ou via Docker si mysql.exe n'est pas installé) :
Get-Content database\init.sql -Raw | mysql -h "$MYSQL_NAME.mysql.database.azure.com" -u $MYSQL_ADMIN -p tritux_db
Get-Content database\migrate_saas.sql -Raw | mysql -h "$MYSQL_NAME.mysql.database.azure.com" -u $MYSQL_ADMIN -p tritux_db

# Alternative si tu n'as pas MySQL installé sur ton PC (via un conteneur temporaire) :
# Get-Content database\init.sql -Raw | docker run --rm -i mysql:8 mysql -h "$MYSQL_NAME.mysql.database.azure.com" -u $MYSQL_ADMIN "-p$MYSQL_PASSWORD" tritux_db
# Get-Content database\migrate_saas.sql -Raw | docker run --rm -i mysql:8 mysql -h "$MYSQL_NAME.mysql.database.azure.com" -u $MYSQL_ADMIN "-p$MYSQL_PASSWORD" tritux_db

# --- Environnement Container Apps ---
az containerapp env create --name $ENV_NAME --resource-group $RG --location $LOCATION

# --- Keycloak (public, port 8080) ---
az containerapp create `
  --name tritux-keycloak `
  --resource-group $RG `
  --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-keycloak:latest" `
  --target-port 8080 `
  --ingress external `
  --min-replicas 1 --max-replicas 1 `
  --env-vars KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin KC_HTTP_ENABLED=true KC_PROXY_HEADERS=xforwarded KC_HOSTNAME_STRICT=false

# Récupère l'URL publique de Keycloak (tu en auras besoin juste après) :
$KEYCLOAK_URL = az containerapp show --name tritux-keycloak --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
Write-Host "Keycloak: https://$KEYCLOAK_URL"

# --- Services backend internes (pas d'accès public direct) ---
az containerapp create `
  --name tritux-user-svc --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-user-service:latest" `
  --target-port 5001 --ingress internal --min-replicas 1 --max-replicas 2 `
  --env-vars PORT=5001 JWT_SECRET=$JWT_SECRET KEYCLOAK_ENABLED=true `
    KEYCLOAK_URL="https://$KEYCLOAK_URL" KEYCLOAK_REALM=tritux-helpdesk `
    DB_HOST="$MYSQL_NAME.mysql.database.azure.com" DB_USER=$MYSQL_ADMIN DB_PASSWORD=$MYSQL_PASSWORD DB_NAME=tritux_db

az containerapp create `
  --name tritux-ticket-svc --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-ticket-service:latest" `
  --target-port 5002 --ingress internal --min-replicas 1 --max-replicas 2 `
  --env-vars PORT=5002 JWT_SECRET=$JWT_SECRET KEYCLOAK_ENABLED=true `
    KEYCLOAK_URL="https://$KEYCLOAK_URL" KEYCLOAK_REALM=tritux-helpdesk `
    CONTRACT_SERVICE_URL=http://tritux-contract-svc `
    DB_HOST="$MYSQL_NAME.mysql.database.azure.com" DB_USER=$MYSQL_ADMIN DB_PASSWORD=$MYSQL_PASSWORD DB_NAME=tritux_db

az containerapp create `
  --name tritux-contract-svc --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-contract-service:latest" `
  --target-port 5003 --ingress internal --min-replicas 1 --max-replicas 2 `
  --env-vars PORT=5003 JWT_SECRET=$JWT_SECRET KEYCLOAK_ENABLED=true `
    KEYCLOAK_URL="https://$KEYCLOAK_URL" KEYCLOAK_REALM=tritux-helpdesk `
    TWILIO_ACCOUNT_SID=$TWILIO_SID TWILIO_AUTH_TOKEN=$TWILIO_TOKEN TWILIO_PHONE_NUMBER=$TWILIO_PHONE `
    DB_HOST="$MYSQL_NAME.mysql.database.azure.com" DB_USER=$MYSQL_ADMIN DB_PASSWORD=$MYSQL_PASSWORD DB_NAME=tritux_db

az containerapp create `
  --name tritux-report-svc --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-report-service:latest" `
  --target-port 5004 --ingress internal --min-replicas 1 --max-replicas 2 `
  --env-vars PORT=5004 JWT_SECRET=$JWT_SECRET KEYCLOAK_ENABLED=true `
    KEYCLOAK_URL="https://$KEYCLOAK_URL" KEYCLOAK_REALM=tritux-helpdesk `
    DB_HOST="$MYSQL_NAME.mysql.database.azure.com" DB_USER=$MYSQL_ADMIN DB_PASSWORD=$MYSQL_PASSWORD DB_NAME=tritux_db

az containerapp create `
  --name tritux-ai-svc --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-ai-service:latest" `
  --target-port 8000 --ingress internal --min-replicas 1 --max-replicas 2

# --- API Gateway (public — c'est lui que le frontend appelle depuis le navigateur) ---
az containerapp create `
  --name tritux-gateway --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-api-gateway:latest" `
  --target-port 5000 --ingress external --min-replicas 1 --max-replicas 2 `
  --env-vars PORT=5000 `
    USER_SERVICE_URL=http://tritux-user-svc `
    TICKET_SERVICE_URL=http://tritux-ticket-svc `
    CONTRACT_SERVICE_URL=http://tritux-contract-svc `
    REPORT_SERVICE_URL=http://tritux-report-svc `
    AI_SERVICE_URL=http://tritux-ai-svc

$GATEWAY_URL = az containerapp show --name tritux-gateway --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
Write-Host "Gateway: https://$GATEWAY_URL"

# --- Frontend (public) ---
# Grâce à la configuration dynamique au runtime (40-env-config.sh), l'image
# injecte automatiquement les URLs de l'API Gateway et de Keycloak au démarrage du conteneur.
az containerapp create `
  --name tritux-frontend --resource-group $RG --environment $ENV_NAME `
  --image "$DOCKERHUB_USER/tritux-frontend:latest" `
  --target-port 80 --ingress external --min-replicas 1 --max-replicas 2 `
  --env-vars `
    VITE_API_URL="https://$GATEWAY_URL/api" `
    VITE_KEYCLOAK_ENABLED=true `
    VITE_KEYCLOAK_URL="https://$KEYCLOAK_URL" `
    VITE_KEYCLOAK_REALM=tritux-helpdesk `
    VITE_KEYCLOAK_CLIENT_ID=tritux-frontend

$FRONTEND_URL = az containerapp show --name tritux-frontend --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
Write-Host "=========================================="
Write-Host "Application accessible sur : https://$FRONTEND_URL"
Write-Host "=========================================="
```

⚠️ **Après ce script**, va sur `https://$KEYCLOAK_URL` (console admin, `admin`/`admin`) et refais la manip déjà connue :
- Client `tritux-backend` → **Service accounts roles** → `manage-users`, `view-users`, `query-users`, `view-realm` (nécessaire pour l'inscription société en prod).
- Vérifie que le client `tritux-frontend` a bien `https://$FRONTEND_URL/*` dans ses **Valid Redirect URIs** et **Web Origins** (sinon le login échouera en CORS) — à corriger manuellement dans la console Keycloak si besoin, car le realm importé contient encore `localhost:5173`.

---

## 2. Créer le Service Principal pour le déploiement continu (GitHub Actions)

```powershell
az ad sp create-for-rbac `
  --name "tritux-github-actions" `
  --role contributor `
  --scopes /subscriptions/<TON_SUBSCRIPTION_ID>/resourceGroups/tritux-rg `
  --sdk-auth
```
*(trouve `<TON_SUBSCRIPTION_ID>` avec `az account show --query id -o tsv`)*

Ça affiche un bloc JSON — copie-le **en entier**.

Sur GitHub : **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :
- Nom : `AZURE_CREDENTIALS`
- Valeur : colle le JSON complet

---

## 3. Coûts à surveiller (souscription Étudiant, 100 $)

| Ressource | Coût estimé/mois |
|---|---|
| MySQL Flexible Server (B1ms) | ~12-15 $ |
| Container Apps (7 apps, faible trafic) | ~5-15 $ (souvent proche de 0 grâce au plan Consumption + scale-to-zero possible) |

Pour économiser pendant les périodes sans démo : `az containerapp update --name <app> --resource-group tritux-rg --min-replicas 0` sur chaque service (redémarre à la première requête, avec un délai de quelques secondes).

**Pour tout supprimer d'un coup en fin de projet** :
```powershell
az group delete --name tritux-rg --yes --no-wait
```
