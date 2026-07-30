-- Tritux IT Ticketing Database Initialization

CREATE DATABASE IF NOT EXISTS tritux_db;
USE tritux_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    department VARCHAR(50),
    joinDate VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NULL,
    specialties VARCHAR(255) NULL COMMENT 'Catégories IT (csv: network,software,...)'
);

-- 2. Tickets Table
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
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Comments Table
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

-- 4. Attachments Table
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

-- 5. History Table
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

-- 6. Satisfaction Ratings Table
CREATE TABLE IF NOT EXISTS satisfaction_ratings (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    comment TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- 7. AI Suggestions Table
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    confidence INT NOT NULL,
    suggested_response TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- 8. Notifications Table (CDC 7.8)
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

-- Seed Data (Default Users)
INSERT INTO users (id, name, email, role, department, joinDate, specialties)
VALUES 
('u1', 'Sami Belhadj', 'sami.belhadj@tritux.com', 'user', 'Marketing', '2023-01-15', NULL),
('u2', 'Leila Mansour', 'leila.mansour@tritux.com', 'agent', 'IT Support', '2022-09-01', 'network,security,account'),
('u3', 'Karim Oueslati', 'karim.oueslati@tritux.com', 'agent', 'IT Support', '2022-11-10', 'software,email,hardware'),
('u4', 'Admin Tritux', 'admin@tritux.com', 'admin', 'Direction', '2020-05-20', NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), role=VALUES(role), department=VALUES(department), joinDate=VALUES(joinDate), specialties=VALUES(specialties);
