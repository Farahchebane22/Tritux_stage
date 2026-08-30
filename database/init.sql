-- Tritux IT Ticketing Database — SaaS multi-tenant + SLA
-- Compatible avec l'existant + extensions sociétés / contrats / rapports

CREATE DATABASE IF NOT EXISTS tritux_db;
USE tritux_db;

-- ============================================================
-- 0. Sociétés (tenants clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS societes (
    id VARCHAR(50) PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    secteur_activite VARCHAR(100),
    contact_principal_nom VARCHAR(100),
    contact_principal_email VARCHAR(150),
    contact_principal_telephone VARCHAR(40),
    date_creation VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(50) PRIMARY KEY,
    societe_id VARCHAR(50) NOT NULL,
    nom VARCHAR(150) NOT NULL,
    description TEXT,
    FOREIGN KEY (societe_id) REFERENCES societes(id) ON DELETE CASCADE
);

-- ============================================================
-- 1. Users (interne Tritux OU client d'une société)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'CLIENT_USER',
    department VARCHAR(50),
    joinDate VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NULL,
    specialties VARCHAR(255) NULL COMMENT 'Catégories IT (csv)',
    societe_id VARCHAR(50) NULL,
    keycloak_id VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    FOREIGN KEY (societe_id) REFERENCES societes(id) ON DELETE SET NULL
);

-- ============================================================
-- 2. Contrats de maintenance + règles SLA
-- ============================================================
CREATE TABLE IF NOT EXISTS contrats_maintenance (
    id VARCHAR(50) PRIMARY KEY,
    societe_id VARCHAR(50) NOT NULL,
    type_contrat VARCHAR(20) NOT NULL COMMENT '24/7 | 5/7 | 8/5',
    canal_notification_urgence VARCHAR(20) NOT NULL DEFAULT 'email',
    jours_ouvres VARCHAR(80) NOT NULL DEFAULT 'lundi-vendredi',
    heures_ouvrees VARCHAR(40) NOT NULL DEFAULT '08:00-18:00',
    date_debut VARCHAR(50) NOT NULL,
    date_fin VARCHAR(50) NOT NULL,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif' COMMENT 'actif|expire|suspendu',
    conditions_texte TEXT,
    FOREIGN KEY (societe_id) REFERENCES societes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sla_regles (
    id VARCHAR(50) PRIMARY KEY,
    contrat_id VARCHAR(50) NOT NULL,
    priorite VARCHAR(20) NOT NULL,
    delai_reponse_minutes INT NOT NULL,
    notification_immediate TINYINT(1) DEFAULT 0,
    canal VARCHAR(20) DEFAULT 'email',
    FOREIGN KEY (contrat_id) REFERENCES contrats_maintenance(id) ON DELETE CASCADE
);

-- ============================================================
-- 3. Tickets (+ multi-tenant + SLA snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    created_by_id VARCHAR(50) NOT NULL,
    created_by_name VARCHAR(100) NOT NULL,
    created_by_email VARCHAR(100) NOT NULL,
    assigned_to_id VARCHAR(50),
    assigned_to_name VARCHAR(100),
    assigned_to_email VARCHAR(100),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL,
    societe_id VARCHAR(50) NULL,
    application_id VARCHAR(50) NULL,
    contrat_id VARCHAR(50) NULL,
    sla_deadline VARCHAR(50) NULL,
    sla_deferred TINYINT(1) DEFAULT 0,
    sla_resume_at VARCHAR(50) NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (societe_id) REFERENCES societes(id) ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
    FOREIGN KEY (contrat_id) REFERENCES contrats_maintenance(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    author_id VARCHAR(50) NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_email VARCHAR(100) NOT NULL,
    created_at VARCHAR(50) NOT NULL,
    is_internal TINYINT(1) DEFAULT 0,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(100) NOT NULL,
    uploaded_at VARCHAR(50) NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    field VARCHAR(50) NOT NULL,
    old_value VARCHAR(255),
    new_value VARCHAR(255),
    changed_by_id VARCHAR(50) NOT NULL,
    changed_by_name VARCHAR(100) NOT NULL,
    changed_by_email VARCHAR(100) NOT NULL,
    changed_at VARCHAR(50) NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS satisfaction_ratings (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    comment TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    confidence INT NOT NULL,
    suggested_response TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    ticket_id VARCHAR(50),
    ticket_title VARCHAR(255),
    is_read TINYINT(1) DEFAULT 0,
    created_at VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 4. Escalades SLA + acceptation contrat + rapports
-- ============================================================
CREATE TABLE IF NOT EXISTS escalade_notifications (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    agent_id VARCHAR(50),
    canal VARCHAR(20) NOT NULL,
    date_envoi VARCHAR(50) NOT NULL,
    statut_envoi VARCHAR(20) NOT NULL DEFAULT 'envoye',
    detail TEXT,
    palier INT NULL DEFAULT 1,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contrat_acceptances (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    contrat_id VARCHAR(50) NOT NULL,
    accepted_at VARCHAR(50) NOT NULL,
    session_id VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contrat_id) REFERENCES contrats_maintenance(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rapports_archives (
    id VARCHAR(50) PRIMARY KEY,
    societe_id VARCHAR(50) NOT NULL,
    periode_debut VARCHAR(50) NOT NULL,
    periode_fin VARCHAR(50) NOT NULL,
    date_generation VARCHAR(50) NOT NULL,
    contenu_resume JSON,
    export_pdf_path VARCHAR(255),
    FOREIGN KEY (societe_id) REFERENCES societes(id) ON DELETE CASCADE
);

-- ============================================================
-- Seed data
-- ============================================================

INSERT INTO societes (id, nom, secteur_activite, contact_principal_nom, contact_principal_email, contact_principal_telephone, date_creation)
VALUES
('soc_demo', 'Acme Tunisie SAS', 'Industrie', 'Nour Ben Ali', 'nour.benali@acme.tn', '+216 71 000 000', '2026-01-10'),
('soc_orange', 'Orange Tunisie', 'Télécommunications', 'Mohamed Ben Amor', 'mohamed@orange.tn', '+216 72 123 456', '2026-02-01'),
('soc_tritux', 'Tritux Groupe (interne)', 'IT / Consulting', 'Admin Tritux', 'admin@tritux.com', '+216 71 111 111', '2020-05-20')
ON DUPLICATE KEY UPDATE nom=VALUES(nom);

INSERT INTO applications (id, societe_id, nom, description)
VALUES
('app_acme_erp', 'soc_demo', 'Acme ERP', 'ERP métier Acme'),
('app_acme_web', 'soc_demo', 'Portail client Acme', 'Application web B2C'),
('app_orange_portal', 'soc_orange', 'E-Shop Orange', 'Portail client E-Shop')
ON DUPLICATE KEY UPDATE nom=VALUES(nom);

INSERT INTO contrats_maintenance (
  id, societe_id, type_contrat, canal_notification_urgence, jours_ouvres, heures_ouvrees,
  date_debut, date_fin, statut, conditions_texte
) VALUES (
  'ctr_acme_57',
  'soc_demo',
  '5/7',
  'email',
  'lundi-vendredi',
  '08:00-18:00',
  '2026-01-01',
  '2026-12-31',
  'actif',
  'Contrat de maintenance 5/7 (lundi–vendredi 08h–18h). Les tickets hors fenêtre sont horodatés et traités à la prochaine ouverture. Escalade immédiate pour urgences en heures ouvrées via email/SMS.'
), (
  'ctr_orange_247',
  'soc_orange',
  '24/7',
  'sms',
  'lundi-dimanche',
  '00:00-24:00',
  '2026-01-01',
  '2026-12-31',
  'actif',
  'Contrat de maintenance critique 24/7 (lundi-dimanche 24h/24). Traitement et escalade immédiate des urgences sans aucune restriction de plage horaire.'
) ON DUPLICATE KEY UPDATE statut=VALUES(statut), date_fin=VALUES(date_fin);

INSERT INTO sla_regles (id, contrat_id, priorite, delai_reponse_minutes, notification_immediate, canal) VALUES
('sla_acme_low', 'ctr_acme_57', 'low', 480, 0, 'email'),
('sla_acme_med', 'ctr_acme_57', 'medium', 240, 0, 'email'),
('sla_acme_high', 'ctr_acme_57', 'high', 120, 1, 'email'),
('sla_acme_urg', 'ctr_acme_57', 'urgent', 30, 1, 'sms'),
('sla_orange_low', 'ctr_orange_247', 'low', 480, 0, 'email'),
('sla_orange_med', 'ctr_orange_247', 'medium', 240, 0, 'email'),
('sla_orange_high', 'ctr_orange_247', 'high', 60, 1, 'email'),
('sla_orange_urg', 'ctr_orange_247', 'urgent', 15, 1, 'sms')
ON DUPLICATE KEY UPDATE delai_reponse_minutes=VALUES(delai_reponse_minutes);

-- Rôles mappés : SUPER_ADMIN, AGENT_IT, CLIENT_ADMIN, CLIENT_USER
INSERT INTO users (id, name, email, role, department, joinDate, specialties, societe_id, keycloak_id)
VALUES
('u1', 'Sami Belhadj', 'sami.belhadj@tritux.com', 'CLIENT_USER', 'Marketing', '2023-01-15', NULL, 'soc_demo', NULL),
('u2', 'Leila Mansour', 'leila.mansour@tritux.com', 'AGENT_IT', 'IT Support', '2022-09-01', 'network,security,account', NULL, NULL),
('u3', 'Karim Oueslati', 'karim.oueslati@tritux.com', 'AGENT_IT', 'IT Support', '2022-11-10', 'software,email,hardware', NULL, NULL),
('u4', 'Admin Tritux', 'admin@tritux.com', 'SUPER_ADMIN', 'Direction', '2020-05-20', NULL, NULL, NULL),
('u5', 'Nour Ben Ali', 'nour.benali@acme.tn', 'CLIENT_ADMIN', 'Direction', '2026-01-10', NULL, 'soc_demo', NULL),
('u6', 'Nour Orange', 'nour.orange@orange.tn', 'CLIENT_ADMIN', 'Direction', '2026-02-01', NULL, 'soc_orange', NULL),
('u7', 'Sami Orange', 'sami.orange@orange.tn', 'CLIENT_USER', 'Support Client', '2026-02-01', NULL, 'soc_orange', NULL)
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  role=VALUES(role),
  department=VALUES(department),
  specialties=VALUES(specialties),
  societe_id=VALUES(societe_id);

-- Tickets de test pour démontrer les scénarios
INSERT INTO tickets (id, title, description, status, priority, category, created_by_id, created_by_name, created_by_email, created_at, updated_at, societe_id, application_id, contrat_id, sla_deadline, sla_deferred, sla_resume_at)
VALUES
('TRX-9001', 'Panne totale E-Shop Orange', 'Le portail de vente en ligne E-Shop est inaccessible. Impact critique pour les utilisateurs.', 'open', 'urgent', 'software', 'u7', 'Sami Orange', 'sami.orange@orange.tn', '2026-08-16T22:00:00.000Z', '2026-08-16T22:00:00.000Z', 'soc_orange', 'app_orange_portal', 'ctr_orange_247', '2026-08-16T22:15:00.000Z', 0, NULL),
('TRX-9002', 'Problème de synchronisation ERP Acme', 'Problème de synchronisation des ventes avec le serveur principal Acme.', 'open', 'urgent', 'software', 'u1', 'Sami Belhadj', 'sami.belhadj@tritux.com', '2026-08-14T20:00:00.000Z', '2026-08-14T20:00:00.000Z', 'soc_demo', 'app_acme_erp', 'ctr_acme_57', '2026-08-17T08:30:00.000Z', 1, '2026-08-17T08:00:00.000Z')
ON DUPLICATE KEY UPDATE title=VALUES(title), status=VALUES(status);

-- Escalades SLA pour TRX-9001 (Orange 24/7 urgent -> alerte immédiate SMS)
INSERT INTO escalade_notifications (id, ticket_id, agent_id, canal, date_envoi, statut_envoi, detail)
VALUES
('esc_demo_1', 'TRX-9001', 'u2', 'sms', '2026-08-16T22:00:05.000Z', 'envoye', '[MOCK sms] Alerte urgente ticket TRX-9001 (catégorie=software) envoyée à Leila Mansour')
ON DUPLICATE KEY UPDATE detail=VALUES(detail);

