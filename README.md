# Dossier Documentaire Officiel — Plateforme SaaS Tritux Helpdesk

Ce dossier regroupe l'ensemble des documents techniques, architecturaux, fonctionnels et de démonstration relatifs au projet **Tritux Helpdesk — Plateforme SaaS B2B Multi-Clients & Gestion des SLA**.

Ces documents sont prêts à être partagés avec votre encadrant de stage, votre tuteur entreprise et les membres du jury de soutenance.

---

## 📑 Sommaire des Documents

| Document | Titre | Description |
|---|---|---|
| 🏛️ [**ARCHITECTURE.md**](file:///c:/Users/farah/Desktop/stage_ete_tritux/docs/ARCHITECTURE.md) | **Architecture Globale & Topologie Système** | Diagrammes Mermaid de l'architecture microservices, réseau public/privé, modèle de données multi-tenant (ERD), matrice de sécurité RBAC. |
| 🛠️ [**TECHNOLOGIES_ET_OUTILS.md**](file:///c:/Users/farah/Desktop/stage_ete_tritux/docs/TECHNOLOGIES_ET_OUTILS.md) | **Technologies, Outils & Justifications** | Détail de la stack complète (Vue 3, TypeScript, Node.js, FastAPI, Keycloak, Azure Container Apps, MySQL, Twilio) et analyse comparative justifiant chaque choix technique. |
| 🤖 [**INTELLIGENCE_ARTIFICIELLE.md**](file:///c:/Users/farah/Desktop/stage_ete_tritux/docs/INTELLIGENCE_ARTIFICIELLE.md) | **Intelligence Artificielle & Pipeline ML** | Conception de l'IA hybride : modèle de Machine Learning supervisé local (TF-IDF + Naive Bayes), chatbot d'auto-assistance, moteur heuristique cyber et intégration LLM. |
| 🔄 [**WORKFLOWS_FONCTIONNELS_ET_TECHNIQUES.md**](file:///c:/Users/farah/Desktop/stage_ete_tritux/docs/WORKFLOWS_FONCTIONNELS_ET_TECHNIQUES.md) | **Workflows Fonctionnels & Séquences** | 7 diagrammes de séquence détaillant les flux : onboarding société, login Keycloak OIDC, Contract Gate, calcul SLA, escalade 3 paliers, traitement agent et rapports. |
| 🎯 [**GUIDE_DEMONSTRATION_ET_SOUTENANCE.md**](file:///c:/Users/farah/Desktop/stage_ete_tritux/docs/GUIDE_DEMONSTRATION_ET_SOUTENANCE.md) | **Guide de Démonstration, Soutenance & FAQ** | Script de présentation oral minuté, comptes démo en production, guide pas-à-pas des captures d'écran et réponses aux questions pièges du jury. |
| ☁️ [**azure-deployment.md**](file:///c:/Users/farah/Desktop/stage_ete_tritux/docs/azure-deployment.md) | **Guide de Déploiement Cloud Azure** | Commandes Azure CLI, variables d'environnement de production, secrets GitHub Actions et gestion des coûts. |

---

## 🚀 Liens de Production en Ligne

L'application est actuellement déployée et opérationnelle en production sur **Microsoft Azure (Région Spain Central)** :

- **Application Web (Frontend)** :  
  `https://tritux-frontend.greenhill-794a15cc.spaincentral.azurecontainerapps.io`
- **Serveur d'Authentification Keycloak (Admin Console & Realm)** :  
  `https://tritux-keycloak.greenhill-794a15cc.spaincentral.azurecontainerapps.io`
- **API Gateway (Point d'accès API public sécurisé)** :  
  `https://tritux-gateway.greenhill-794a15cc.spaincentral.azurecontainerapps.io`

---

## 👤 Comptes de Test Rapide pour la Démonstration

- **Super Administrateur** : `admin `
- **Agent Support IT** : `leila.mansour `
- **Client Acme (Contrat 5/7 avec SLA différé)** : `nour.benali`
- **Client Orange (Contrat critique 24/7 avec escalade d'urgence)** : `nour.orange `
