# Tritux IT Helpdesk

Plateforme de gestion des tickets IT (Vue 3 + microservices Node.js + FastAPI + MySQL).

## Structure

```
frontend/          # Application Vue.js 3 (UI)
backend/
  api-gateway/     # Port 5000
  user-service/    # Port 5001
  ticket-service/  # Port 5002
  ai-service/      # Port 8000 (Python)
database/          # init.sql (schéma MySQL)
docker-compose.yml
.github/workflows/ # Pipeline CI/CD
```

## Démarrage local

### 1. Base de données (XAMPP)

1. Démarrer **Apache + MySQL** dans XAMPP  
2. Importer `database/init.sql` dans phpMyAdmin (base `tritux_db`)  
3. User app : `tritux_user` / `tritux_password`

### 2. Backend (4 terminaux)

```powershell
cd backend\user-service; npm start
cd backend\ticket-service; npm start
cd backend\api-gateway; npm start
cd backend\ai-service; python main.py
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

→ http://localhost:5173

## Comptes démo

| Email | Rôle |
|-------|------|
| sami.belhadj@tritux.com | user |
| leila.mansour@tritux.com | agent |
| admin@tritux.com | admin |

## Docker (optionnel)

```powershell
docker compose up --build
```
