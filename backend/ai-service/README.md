# Tritux AI Service

Pipeline ML pour classification des tickets IT + chatbot d'auto-assistance.

## Pipeline (étapes)

```powershell
cd backend\ai-service
python -m pip install -r requirements.txt

# 1. Collecte / génération dataset (442 tickets FR)
python scripts/generate_dataset.py

# 2. Nettoyage
python scripts/clean_data.py

# 3. Entraînement (TF-IDF + Naive Bayes)
python scripts/train_model.py

# 4. API
python main.py
```

→ http://localhost:8000

## Endpoints

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/health` | Santé + `modelReady` + métriques |
| GET | `/model/info` | Détail entraînement |
| POST | `/analyze` | Catégorie, priorité, confiance, réponse, étapes self-help |
| POST | `/chat` | Chatbot : diagnostic + résolution guidée |

Via gateway : `http://localhost:5000/api/ai/...`

## Stack

- **Dataset** : tickets IT synthétiques FR (network, security, software, hardware, account, email, other)
- **Algo** : TF-IDF + Multinomial Naive Bayes (implémentation maison, sans scikit-learn — plus portable sous Windows)
- **Knowledge base** : 12 scénarios self-help (VPN, phishing, Outlook, MFA…)
- **Chatbot UI** : bouton flottant dans le frontend Vue

## Fichiers clés

```
data/raw/tickets_dataset.csv
data/processed/tickets_clean.csv
data/knowledge_base.json
models/*.pkl + metrics.json
tritux_ml.py          # algo
ml_engine.py          # analyse + chat
scripts/              # generate / clean / train
```
