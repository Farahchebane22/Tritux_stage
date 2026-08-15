-- Migration SaaS (à exécuter si tritux_db existe déjà)
USE tritux_db;

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

CREATE TABLE IF NOT EXISTS contrats_maintenance (
    id VARCHAR(50) PRIMARY KEY,
    societe_id VARCHAR(50) NOT NULL,
    type_contrat VARCHAR(20) NOT NULL,
    canal_notification_urgence VARCHAR(20) NOT NULL DEFAULT 'email',
    jours_ouvres VARCHAR(80) NOT NULL DEFAULT 'lundi-vendredi',
    heures_ouvrees VARCHAR(40) NOT NULL DEFAULT '08:00-18:00',
    date_debut VARCHAR(50) NOT NULL,
    date_fin VARCHAR(50) NOT NULL,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif',
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

CREATE TABLE IF NOT EXISTS escalade_notifications (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    agent_id VARCHAR(50),
    canal VARCHAR(20) NOT NULL,
    date_envoi VARCHAR(50) NOT NULL,
    statut_envoi VARCHAR(20) NOT NULL DEFAULT 'envoye',
    detail TEXT
);

CREATE TABLE IF NOT EXISTS contrat_acceptances (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    contrat_id VARCHAR(50) NOT NULL,
    accepted_at VARCHAR(50) NOT NULL,
    session_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS rapports_archives (
    id VARCHAR(50) PRIMARY KEY,
    societe_id VARCHAR(50) NOT NULL,
    periode_debut VARCHAR(50) NOT NULL,
    periode_fin VARCHAR(50) NOT NULL,
    date_generation VARCHAR(50) NOT NULL,
    contenu_resume JSON,
    export_pdf_path VARCHAR(255)
);

-- Colonnes users / tickets (ignorer erreur si déjà présentes)
ALTER TABLE users ADD COLUMN societe_id VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN keycloak_id VARCHAR(100) NULL;
ALTER TABLE tickets ADD COLUMN societe_id VARCHAR(50) NULL;
ALTER TABLE tickets ADD COLUMN application_id VARCHAR(50) NULL;
ALTER TABLE tickets ADD COLUMN contrat_id VARCHAR(50) NULL;
ALTER TABLE tickets ADD COLUMN sla_deadline VARCHAR(50) NULL;
ALTER TABLE tickets ADD COLUMN sla_deferred TINYINT(1) DEFAULT 0;
ALTER TABLE tickets ADD COLUMN sla_resume_at VARCHAR(50) NULL;
