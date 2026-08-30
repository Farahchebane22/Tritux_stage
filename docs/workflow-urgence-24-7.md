# Workflow — Escalade automatique des tickets urgents non assignés

## 1. Objectif

Aujourd'hui, un ticket `urgent` créé sur un contrat `24/7` déclenche une alerte (mock console) une seule fois, sans suivi si personne ne réagit. Ce document définit un vrai **workflow d'escalade en cascade** : si un ticket urgent reste sans agent assigné, le système relance automatiquement, de plus en plus fort, jusqu'à ce qu'un humain (agent ou admin) prenne la main.

Champ ajouté en prérequis : **numéro de téléphone** sur `users`, nécessaire pour les canaux `sms` / `telephone` déjà définis dans `contrats_maintenance.canal_notification_urgence`.

---

## 2. Modèle de données

### 2.1 Nouvelle colonne `phone`

```sql
ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL;
```
À ajouter dans `database/init.sql` (pour les futures installations) **et** exécuter directement en `ALTER TABLE` sur la base existante — pattern déjà utilisé dans le projet (ex: `chatbot_logs`, `share_token`), donc à faire aussi via un `try { ALTER TABLE ... } catch {}` au démarrage de `user-service`, pour ne rien casser si la colonne existe déjà.

### 2.2 Table déjà existante — `escalade_notifications`

Déjà dans le schéma, elle sert de journal d'audit pour chaque relance :

```sql
id, ticket_id, agent_id, canal, date_envoi, statut_envoi
```

Pas de modification nécessaire — on va enfin l'utiliser réellement (actuellement, l'alerte urgente est juste un `console.log`, rien n'est journalisé).

### 2.3 Pas de nouvelle colonne sur `tickets`

**Important** : on ne stocke pas un statut d'escalade en dur sur le ticket. On **calcule dynamiquement** "est-ce que ce ticket est urgent + non assigné + en attente depuis trop longtemps" à la lecture — plus fiable, pas de désynchronisation possible entre un champ stocké et la réalité.

---

## 3. Règle de déclenchement

Un ticket entre dans le circuit d'escalade si **toutes** ces conditions sont vraies :
1. `priority = 'urgent'`
2. `assigned_to_id IS NULL`
3. Le contrat de la société a une règle SLA pour `urgent` avec `notification_immediate = true` (déjà dans `sla_regles` — le `24/7` d'Orange l'a déjà par défaut)
4. Le ticket est dans la fenêtre de couverture du contrat (pas "différé" — un `24/7` est toujours couvert)

---

## 4. Cascade d'escalade (paliers dans le temps)

| Palier | Délai depuis création | Action | Destinataires | Canal |
|---|---|---|---|---|
| **1 — Alerte immédiate** | T+0 | Notification urgente | Agents IT **spécialisés** dans la catégorie du ticket | Celui défini par le contrat (`canal_notification_urgence`) |
| **2 — Relance élargie** | T+5 min (configurable) | Toujours non assigné → relance | **Tous** les agents IT disponibles (pas que les spécialistes) | Même canal + notification in-app |
| **3 — Escalade admin** | T+15 min | Toujours non assigné → alerte critique | Tous les `SUPER_ADMIN` | SMS/téléphone si le contrat l'exige, + popup bloquante au prochain chargement du dashboard admin |

Chaque palier franchi crée une ligne dans `escalade_notifications` (traçabilité complète, exigée par le cahier des charges point 4).

---

## 5. Architecture technique

### 5.1 Pourquoi pas un vrai scheduler serveur (cron) ?

Pour un projet de stage sans infra de tâches planifiées (pas de Redis/BullMQ), la solution pragmatique et **suffisamment fiable** : le calcul du palier d'escalade se fait **à la volée**, à chaque fois qu'un agent/admin a l'app ouverte, via un **polling léger côté frontend** (toutes les 30s) sur un endpoint dédié. Simple, sans dépendance supplémentaire, et ça correspond à l'usage réel (un agent doit être connecté pour intervenir de toute façon).

*Piste d'amélioration future (à mentionner à ton encadrante, pas à coder maintenant) : un vrai job serveur avec `node-cron` pour envoyer de vraies alertes même app fermée — pertinent seulement si un vrai canal SMS (Twilio) est branché plus tard.*

### 5.2 Nouveau endpoint — `GET /tickets/urgent-escalation` (ticket-service)

Réservé aux rôles internes (`AGENT_IT`, `SUPER_ADMIN`). Retourne, pour chaque ticket concerné :

```json
[
  {
    "id": "TRX-1234",
    "title": "...",
    "societeId": "soc_orange",
    "societeName": "Orange Tunisie",
    "createdAt": "...",
    "waitingMinutes": 7,
    "palier": 2,
    "category": "network"
  }
]
```

### 5.3 Déclenchement du palier 1 — au moment de la création

Dans `ticket-service`, juste après l'insertion du ticket (déjà là où `evaluateSla` est appelé) :
- Si les conditions du §3 sont réunies → appel à `contract-service` (`POST /notify-urgent`) qui :
  1. Cherche les agents `AGENT_IT` dont les spécialités matchent la catégorie du ticket (déjà fait côté `user-service` via `GET /agents?category=...`).
  2. Envoie l'alerte mock (console + `NotificationService.sendUrgentAlert`), en utilisant leur `phone` si le canal est `sms`/`telephone`.
  3. Insère une ligne dans `escalade_notifications` (`canal`, `statut_envoi: 'envoyé'`).

### 5.4 Déclenchement des paliers 2 et 3 — au polling

Le frontend (agents/admins connectés) interroge `GET /tickets/urgent-escalation` toutes les 30s. Côté backend, à **chaque appel** de cet endpoint :
- Pour chaque ticket concerné dont le palier calculé est **supérieur** au dernier palier déjà journalisé dans `escalade_notifications` → on déclenche la notification correspondante et on journalise.
- Ainsi, même sans cron, la relance se fait dès qu'un membre du staff a l'app ouverte — largement suffisant en pratique (un agent/admin actif consulte le dashboard en continu).

---

## 6. Interface utilisateur

### 6.1 Badge persistant (sidebar)

Pastille rouge sur "Tickets" dans la sidebar, visible pour `AGENT_IT`/`SUPER_ADMIN`, avec le nombre de tickets en escalade.

### 6.2 Popup bloquante (palier 3 uniquement)

Quand un `SUPER_ADMIN` charge le dashboard et qu'au moins un ticket est au palier 3 : popup non-fermable sans action, listant les tickets concernés, avec un bouton **"Assigner maintenant"** menant directement à la vue Ticket.

### 6.3 Badge visuel sur la carte/liste de ticket

Un chip rouge clignotant (`animate-pulse`) "🔴 Urgent — non assigné depuis Xmin" sur la ligne du ticket dans `TicketListView` et `AdminClientsView`, calculé côté frontend à partir de `createdAt` + `priority` + `assignedTo` (pas besoin d'appeler le nouvel endpoint pour ça, juste pour le badge/popup globaux).

### 6.4 Téléphone — formulaires à mettre à jour

- `ProfileView.vue` : champ téléphone éditable (tous rôles).
- `LoginView.vue` (inscription société) : champ téléphone pour l'admin société.
- Création de compte interne (agent/admin) si un formulaire existe côté admin.

---

## 7. Plan d'implémentation — ordre recommandé

1. **DB + backend `user-service`** : colonne `phone`, exposée dans `/me`, `/profile` (GET/PUT), `/register-societe`.
2. **Frontend** : champ téléphone dans `ProfileView.vue` + inscription société.
3. **Backend `contract-service`** : endpoint `POST /notify-urgent` (déclenchement palier 1), écriture réelle dans `escalade_notifications` (au lieu du simple `console.log` actuel).
4. **Backend `ticket-service`** : appel à ce endpoint à la création d'un ticket urgent ; nouvel endpoint `GET /tickets/urgent-escalation` (calcul des paliers 2/3).
5. **Frontend** : composable de polling (store `useEscalationStore` ou similaire) + badge sidebar + popup palier 3 + chip sur les tickets.
6. **Tests de bout en bout** (scénarios ci-dessous).

---

## 8. Scénarios de test

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Ticket urgent créé sur contrat `24/7`, personne assigné | Alerte palier 1 immédiate aux spécialistes de la catégorie |
| 2 | Même ticket, 5 min plus tard, toujours non assigné, un agent/admin a le dashboard ouvert | Palier 2 déclenché, tous les agents notifiés |
| 3 | Même ticket, 15 min, toujours rien | Palier 3 : popup bloquante côté `SUPER_ADMIN` |
| 4 | Un agent assigne le ticket à tout moment | Plus aucune escalade future pour ce ticket, badge disparaît |
| 5 | Ticket urgent mais contrat `5/7` hors fenêtre ouvrée | Pas d'escalade immédiate (déjà couvert par le badge "différé" existant) |

---

## 9. Ce qui n'est **pas** couvert par ce document (scope volontairement exclu)

- Envoi réel de SMS/téléphone (reste un mock console, comme précisé dans le cahier des charges — "prévoir une interface claire... mais brancher un vrai fournisseur plus tard").
- Scheduler serveur indépendant du polling (voir §5.1).
- Escalade multi-société croisée (chaque société reste isolée, cohérent avec le multi-tenant existant).
