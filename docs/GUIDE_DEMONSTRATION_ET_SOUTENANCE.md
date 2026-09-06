# Guide de Démonstration & Soutenance — Tritux Helpdesk SaaS

---

## 1. Pitch Exécutif du Projet (À dire en introduction)

> *"Dans le cadre de mon stage chez Tritux, j'ai conçu et déployé en production une plateforme SaaS multi-clients de gestion de support informatique (IT Ticketing). Elle transforme un support traditionnel en une offre B2B managée avec respect contractuel des engagements de service (SLA).*  
> *Le système intègre une gestion d'identité robuste via **Keycloak**, un moteur de calcul SLA adaptatif gérant les plages 24/7 et heures ouvrées, une chaîne d'escalade d'urgence automatisée par **SMS et appels vocaux Twilio**, et un module d'**Intelligence Artificielle** combinant classification automatique par Machine Learning, chatbot d'auto-assistance et détection des cybermenaces.*  
> *L'ensemble de l'architecture microservices est conteneurisée et déployée en production sur le Cloud **Microsoft Azure Container Apps** avec base de données managée."*

---


## 3. Scénarios de Démonstration Pas-à-Pas

### Scénario 1 : Authentification Sécurisée & Contract Gate
1. Connectez-vous avec le compte `nour.benali `.
2. **Ce qu'il faut montrer** :
   - L'écran **Contract Recap** (`/contract/recap`) s'affiche automatiquement avant le Dashboard.
   - Il présente le type de contrat (`5/7`), les plages horaires de couverture et les règles SLA par priorité.
   - Expliquez : *"Le système implémente une 'Contract Gate' fail-closed : aucun client ne peut accéder au support sans validation formelle horodatée des conditions contractuelles pour sa session."*
3. Cliquez sur **Accepter** : l'accès au Dashboard est instantanément déverrouillé.

### Scénario 2 : Création de Ticket & Inférence IA en Temps Réel
1. Allez sur **Créer un ticket** (`/tickets/create`).
2. Saisissez le titre : `"Impossible de joindre le serveur de base de données via le VPN"`
3. **Ce qu'il faut montrer** :
   - Dès la frappe, le microservice IA analyse le texte.
   - La catégorie est automatiquement détectée comme **Réseau (`network`)** avec un indice de confiance élevé (~90%).
   - Une réponse type et des étapes d'auto-assistance sont suggérées.
4. Soumettez le ticket :
   - Comme le contrat Acme est de type `5/7` et que nous sommes hors heures ouvrées ou en soirée, montrez le badge **SLA Différé** indiquant que le chronomètre officiel démarrera à la prochaine ouverture du service (Lundi 08h00).

### Scénario 3 : Contrat Critique 24/7 & Escalade d'Urgence Multi-Paliers
1. Déconnectez-vous et connectez-vous avec `nour.orange ` (Orange Tunisie - Contrat 24/7).
2. Créez un ticket avec la priorité **Urgent** :
   - Titre : `"Coupure totale du portail E-Shop client"`
3. **Ce qu'il faut montrer** :
   - Le SLA calcule une deadline immédiate de **15 minutes**.
   - Le système déclenche le **Palier 1** d'escalade : notification directe à l'agent de garde compétent.
   - Expliquez le mécanisme d'alerte **Twilio** : *"Si aucun agent ne prend en charge le ticket dans les 5 minutes, le Palier 2 envoie un SMS automatique et déclenche un appel téléphonique à l'agent d'astreinte via l'API Twilio. Si après 15 minutes le ticket est toujours vierge, le Palier 3 alerte le Super Administrateur."*

### Scénario 4 : Espace Agent IT & Prise en Charge
1. Connectez-vous avec `leila.mansour `.
2. **Ce qu'il faut montrer** :
   - Le ticket critique apparaît en haut de la liste.
   - L'agent clique sur **"Prendre en charge"** : le statut passe à `En cours`, l'escalade d'urgence s'arrête.
   - Montrez la distinction entre **Commentaire public** (visible du client) et **Note interne** (masquée aux clients avec badge de confidentialité).

### Scénario 5 : Détection des Cybermenaces & SOC Léger
1. Allez sur le menu **Analyse Cyber** (`/cyber-analyze`).
2. Collez un texte de tentative de phishing :
   > *"URGENT: Votre compte Tritux va être suspendu sous 24h. Cliquez immédiatement sur ce lien http://securite-login-verif.com pour saisir votre mot de passe et réactiver vos accès."*
3. Cliquez sur **Analyser** :
   - Le moteur détecte un niveau de risque **Critique (Score: 88/100)**.
   - Type : `Phishing / Usurpation`.
   - Actions immédiates de confinement recommandées : *"Ne cliquez sur aucun lien, alertez le SOC"*.
   - Possibilité de créer en un clic un ticket de sécurité pré-rempli.

### Scénario 6 : Rapports de Gouvernance & Audit SLA
1. Allez sur **Rapports SLA** (`/reports`).
2. Sélectionnez une société (ex: Acme ou Orange).
3. **Ce qu'il faut montrer** :
   - Calcul automatique du **taux de respect du SLA** (ex: 95%).
   - Graphique de répartition des incidents par catégorie et priorité.
   - Temps moyen de résolution (**MTTR**).
   - Bouton de génération et d'archivage prêt pour les comités de direction clients.

---

## 4. Emplacements Recommandés pour vos Captures d'Écran (Rapport & Diapos)

1. **Capture 1 — Page de Connexion & Sécurité** :
   - Formulaire de login avec mention *Authentification sécurisée par Keycloak*.
   - *Légende recommandée* : `Figure 1 : Interface d'authentification unifiée avec support Direct Access Grant Keycloak.`
2. **Capture 2 — Écran Contract Gate (Recap)** :
   - L'écran affichant le type de contrat (5/7 ou 24/7) et les règles SLA avant d'accéder au dashboard.
   - *Légende recommandée* : `Figure 2 : Sas contractuel obligatoire validant l'engagement de niveau de service (SLA).`
3. **Capture 3 — Création de Ticket assistée par IA** :
   - Formulaire avec la prédiction automatique de la catégorie et les conseils d'auto-dépannage.
   - *Légende recommandée* : `Figure 3 : Inférence en direct du modèle Machine Learning (TF-IDF + Naive Bayes) lors de la rédaction d'un incident.`
4. **Capture 4 — Badge de SLA Différé (Hors Heures Ouvrées)** :
   - Détail d'un ticket montrant l'étiquette *"SLA différé à la prochaine heure ouvrée"*.
   - *Légende recommandée* : `Figure 4 : Prise en compte intelligente des fenêtres horaires contractuelles (5/7 vs 24/7).`
5. **Capture 5 — Module d'Analyse Cyber** :
   - Résultat de l'analyse avec la jauge de score de risque rouge et les recommandations.
   - *Légende recommandée* : `Figure 5 : Moteur de détection heuristique et confinement des incidents de cybersécurité.`
6. **Capture 6 — Tableau de Bord des Rapports & Métriques SLA** :
   - Vue analytique avec indicateurs de conformité et MTTR.
   - *Légende recommandée* : `Figure 6 : Module d'audit et de reporting SLA multi-sociétés.`
7. **Capture 7 — Console Azure Container Apps** :
   - Capture du portail Azure ou de la liste CLI montrant les 7 services en état `Healthy`.
   - *Légende recommandée* : `Figure 7 : Supervision et déploiement haute disponibilité sur Microsoft Azure Container Apps.`

---

## 5. Questions Fréquentes du Jury / Encadrant & Réponses Types

### Q1 : Pourquoi avoir choisi une architecture microservices plutôt qu'une application monolithique ?
> **Réponse** : *"Le découplage en microservices apporte trois bénéfices majeurs :  
> 1) **L'isolation des pannes** : si le service d'Intelligence Artificielle en Python subit une charge ponctuelle ou un crash, les utilisateurs peuvent toujours se connecter et créer des tickets sans interruption.  
> 2) **La polyglottie technologique** : nous exploitons Node.js pour l'asynchronisme rapide des flux de ticketing et Python pour la puissance de son écosystème Machine Learning.  
> 3) **La scalabilité granulaire sur Azure** : nous pouvons scaler indépendamment le service de tickets à fort trafic sans surdimensionner le service de rapports qui ne tourne qu'en fin de mois."*

### Q2 : Comment garantissez-vous l'isolation des données entre sociétés (Multi-tenancy) ?
> **Réponse** : *"L'étanchéité repose sur deux niveaux :  
> 1) **Au niveau logique IAM** : chaque token Keycloak porte l'attribut `societe_id`.  
> 2) **Au niveau du code backend et de la base** : toutes les requêtes SQL appliquent systématiquement un filtre `WHERE societe_id = ?` extrait directement du jeton JWT cryptographiquement signé. Même en modifiant une URL, un client ne peut jamais accéder aux données d'une entreprise concurrente."*

### Q3 : Pourquoi avoir retenu Azure Container Apps par rapport à AKS ou App Service ?
> **Réponse** : *"Azure Kubernetes Service (AKS) imposait des coûts fixes de Control Plane et une surcharge d'administration disproportionnée pour ce projet. À l'inverse, Azure App Service gérait mal le réseau privé entre 7 conteneurs distincts.  
> **Azure Container Apps** est le compromis idéal : il offre un réseau interne sécurisé avec service discovery, s'appuie sur Kubernetes et KEDA sans la complexité opérationnelle, et optimise les coûts grâce à la facturation serverless à la seconde."*

### Q4 : Que se passe-t-il si un ticket urgent est créé un samedi à 23h pour un contrat 5/7 ?
> **Réponse** : *"Notre moteur SLA vérifie le type de contrat. Pour un contrat 5/7 (heures ouvrées du lundi au vendredi de 8h à 18h), le ticket est bien enregistré immédiatement, mais son chronomètre de deadline est mis en pause ('différé') et reprogrammé pour le lundi suivant à 08h00 + le délai contractuel. Le client est prévenu par un badge transparent, évitant ainsi les pénalités indues de dépassement SLA."*
