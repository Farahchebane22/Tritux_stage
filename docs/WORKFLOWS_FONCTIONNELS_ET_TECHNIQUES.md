# Workflows Fonctionnels & Techniques — Tritux Helpdesk

---

## 1. Workflow 1 : Inscription B2B d'une Société & Provisioning IAM

Ce flux permet l'enregistrement autonome d'une nouvelle entreprise cliente, la création de son entité légale en base et la création sécurisée de son compte administrateur dans Keycloak.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Administrateur Société
    participant UI as Frontend Vue 3 (LoginView)
    participant GW as API Gateway :5000
    participant UserSvc as User Service :5001
    participant ContractSvc as Contract Service :5003
    participant KC as Keycloak :8080
    participant DB as Azure MySQL

    Client->>UI: Remplit le formulaire d'inscription (Nom société, Nom admin, Email, Mot de passe, Téléphone)
    UI->>GW: POST /api/users/register-societe
    GW->>UserSvc: Relaye la requête
    UserSvc->>ContractSvc: Vérifie / crée l'entité société
    ContractSvc->>DB: INSERT INTO societes (id, nom, secteur, contact...)
    UserSvc->>KC: POST /admin/realms/tritux-helpdesk/users (via compte de service)
    Note over UserSvc,KC: Crée l'utilisateur avec attribut societe_id et rôle 'client-admin'
    UserSvc->>DB: INSERT INTO users (id, name, email, role='CLIENT_ADMIN', societe_id, keycloak_id)
    UserSvc-->>UI: 201 Created { ok: true, user }
    UI->>KC: POST /protocol/openid-connect/token (Direct Grant Login auto)
    KC-->>UI: Tokens { access_token, refresh_token }
    UI-->>Client: Redirection vers l'application
```

---

## 2. Workflow 2 : Authentification & Synchronisation IAM

Ce flux décrit la séquence de connexion unifiée avec Direct Access Grant, validation du jeton asymétrique RS256 et réconciliation automatique des identités locales.

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant UI as Frontend (auth.ts)
    participant KC as Keycloak IAM
    participant GW as API Gateway
    participant UserSvc as User Service
    participant DB as Azure MySQL

    User->>UI: Saisit Email et Mot de passe
    UI->>KC: POST /realms/tritux-helpdesk/protocol/openid-connect/token (grant_type=password)
    KC-->>UI: Retourne { access_token (RS256), refresh_token, expires_in }
    UI->>UI: Stocke les tokens dans localStorage & décode les rôles
    UI->>GW: POST /api/users/auth/keycloak-sync (Bearer Token)
    GW->>UserSvc: Relaye la requête
    UserSvc->>UserSvc: Valide le jeton via JWKS Keycloak
    UserSvc->>DB: Recherche ou auto-provisionne l'utilisateur dans MySQL
    UserSvc-->>UI: Profil utilisateur enrichi { id, name, role, societeId }
    UI-->>User: Session active, navigation vers le Router
```

---

## 3. Workflow 3 : Gate d'Accès au Contrat de Maintenance (Contract Gate)

Ce mécanisme de sécurité empêche tout accès au support pour les sociétés n'ayant pas souscrit de contrat de maintenance actif, et impose l'acceptation formelle des conditions de service à chaque session.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client Connecté
    participant Router as Vue Router (index.ts)
    participant ContractStore as Pinia (contract.ts)
    participant GW as API Gateway
    participant ContractSvc as Contract Service
    participant DB as Azure MySQL

    Client->>Router: Tente d'accéder au Dashboard ('/')
    Router->>ContractStore: Vérifie l'état du contrat (fetchStatus)
    ContractStore->>GW: GET /api/contracts/access/status?sessionId=...
    GW->>ContractSvc: Relaye la requête avec le Bearer token
    ContractSvc->>DB: Recherche le contrat actif de la société (CURDATE() <= date_fin)
    
    alt Aucun contrat actif ou expiré
        ContractSvc-->>ContractStore: { allowed: false, reason: 'no_active_contract' }
        ContractStore-->>Router: Redirige vers /contract/none
        Router-->>Client: Affiche l'écran de blocage + coordonnées commerciales Tritux
    else Contrat actif mais conditions non validées cette session
        ContractSvc-->>ContractStore: { allowed: true, requiresContractAck: true, contrat: {...} }
        ContractStore-->>Router: Redirige vers /contract/recap
        Router-->>Client: Affiche le récapitulatif du contrat (Heures, SLA, Canaux)
        Client->>UI: Clique sur "Accepter les conditions et continuer"
        UI->>GW: POST /api/contracts/access/acknowledge { contratId, sessionId }
        GW->>ContractSvc: Relaye la requête
        ContractSvc->>DB: INSERT INTO contrat_acceptances (id, user_id, contrat_id, accepted_at, session_id)
        ContractSvc-->>UI: { ok: true }
        UI-->>Client: Accès déverrouillé -> Redirection vers le Dashboard
    else Contrat actif et déjà accepté
        ContractSvc-->>ContractStore: { allowed: true, requiresContractAck: false }
        Router-->>Client: Accès direct au Dashboard
    end
```

---

## 4. Workflow 4 : Cycle de Vie d'un Ticket & Moteur de Calcul SLA

Ce flux montre la création d'un ticket, sa catégorisation par l'IA, le calcul de la deadline SLA en fonction du calendrier contractuel (24/7 vs heures ouvrées 5/7) et la prise en compte du report de délai.

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant UI as Frontend (CreateTicketView)
    participant AISvc as AI Service :8000
    participant GW as API Gateway :5000
    participant TicketSvc as Ticket Service :5002
    participant ContractSvc as Contract Service :5003
    participant DB as Azure MySQL

    User->>UI: Saisit le titre et la description du problème
    UI->>GW: POST /api/ai/analyze (titre, description)
    GW->>AISvc: Déclenche l'inférence ML
    AISvc-->>UI: Suggestion { catégorie, priorité, confiance, réponse type }
    UI-->>User: Pré-remplit les champs et affiche les conseils self-help
    User->>UI: Valide la soumission du ticket
    UI->>GW: POST /api/tickets
    GW->>TicketSvc: Relaye la création
    TicketSvc->>ContractSvc: POST /sla/evaluate (societeId, priority, category)
    ContractSvc->>DB: Récupère la règle SLA du contrat (ex: urgent = 30 min)
    ContractSvc->>ContractSvc: Analyse la fenêtre de couverture (isWeekend, inHours)
    
    alt Contrat 24/7 ou ticket créé en heures ouvrées
        ContractSvc-->>TicketSvc: { covered: true, slaDeadline: '2026-08-16T22:15:00Z', deferred: false }
    else Ticket créé hors heures ouvrées (ex: Contrat 5/7 un samedi)
        ContractSvc-->>TicketSvc: { covered: false, slaDeadline: 'Lundi 08:30', deferred: true, resumeAt: 'Lundi 08:00' }
    end

    TicketSvc->>DB: INSERT INTO tickets (id, title, status='open', sla_deadline, sla_deferred, ...)
    TicketSvc-->>UI: Ticket créé avec badge SLA calculé
    UI-->>User: Affichage du ticket avec compte à rebours SLA
```

---

## 5. Workflow 5 : Escalade d'Urgence à 3 Paliers & Alerting 24/7 (Twilio)

Pour les tickets critiques non pris en charge à temps, un mécanisme d'escalade en cascade prévient les équipes d'astreinte selon trois paliers temporels stricts :

```mermaid
sequenceDiagram
    autonumber
    participant TicketSvc as Ticket Service (Cron Escalade)
    participant ContractSvc as Contract Service
    participant Twilio as Twilio API
    participant Agent as Agent IT d'astreinte
    participant Admin as Super Admin Tritux
    participant DB as Azure MySQL

    Note over TicketSvc: Détection d'un ticket Urgent non assigné

    rect rgb(230, 245, 255)
        Note over TicketSvc,Agent: PALIER 1 : À la création immédiate (T = 0 min)
        TicketSvc->>DB: Recherche agent compétent selon les spécialités
        TicketSvc->>DB: Crée notification in-app pour l'agent
        TicketSvc->>ContractSvc: POST /notify-urgent (Palier 1)
        ContractSvc->>DB: INSERT INTO escalade_notifications (palier=1)
    end

    rect rgb(255, 245, 230)
        Note over TicketSvc,Agent: PALIER 2 : Si non pris en charge à T = 5 minutes
        TicketSvc->>ContractSvc: POST /notify-urgent (Palier 2)
        ContractSvc->>Twilio: Envoi SMS urgent à l'agent d'astreinte (+ Appel vocal si configuré)
        Twilio-->>Agent: "ALERTE TRITUX : Ticket urgent TRX-9001 en attente !"
        ContractSvc->>DB: INSERT INTO escalade_notifications (palier=2, canal='sms', statut='envoye')
    end

    rect rgb(255, 230, 230)
        Note over TicketSvc,Admin: PALIER 3 : Si non pris en charge à T = 15 minutes (Critique)
        TicketSvc->>ContractSvc: POST /notify-urgent (Palier 3)
        ContractSvc->>Twilio: Alerte d'escalade maximale au Super Admin
        Twilio-->>Admin: SMS d'alerte rouge & Appel d'escalade
        ContractSvc->>DB: INSERT INTO escalade_notifications (palier=3, targetRole='SUPER_ADMIN')
    end
```

---

## 6. Workflow 6 : Traitement du Ticket par l'Agent & Satisfaction Client

1. **Prise en charge** : L'agent IT clique sur *"Prendre en charge"*, le statut passe à `inprogress`, l'agent est assigné et l'escalade d'urgence s'interrompt automatiquement.
2. **Échanges** :
   - **Commentaires publics** : Visibles par le client avec notification instantanée.
   - **Notes internes** : Réservées au staff IT (badge jaune "Interne"), masquées aux clients.
3. **Résolution** : L'agent documente la solution et bascule le statut à `resolved`. Le chronomètre SLA s'arrête.
4. **Évaluation Client** : Le client reçoit une invite pour noter la prestation (1 à 5 étoiles) avec commentaire libre. La note est enregistrée dans `satisfaction_ratings`.

---

## 7. Workflow 7 : Audit & Rapports de Conformité SLA

1. **Agrégation des Métriques** (`report-service`) :
   - Nombre total de tickets sur la période (mois, trimestre).
   - Taux de respect des engagements SLA ($\% = \frac{\text{Tickets respectés}}{\text{Tickets résolus}} \times 100$).
   - **MTTR (Mean Time To Resolve)** : Durée moyenne de résolution en heures.
   - Distribution par catégorie (`network`, `security`, etc.) et par priorité.
2. **Archivage & Génération** :
   - Génération d'une synthèse JSON stockée dans `rapports_archives`.
   - Export prêt à l'impression / PDF pour les comités de pilotage avec les directions clientes.
