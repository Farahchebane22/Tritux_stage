-- Crée l'utilisateur MySQL attendu par tous les services backend (user-service,
-- ticket-service, contract-service, report-service) en environnement local XAMPP.
-- À exécuter une seule fois dans phpMyAdmin (onglet SQL, base tritux_db).

CREATE USER IF NOT EXISTS 'tritux_user'@'localhost' IDENTIFIED BY 'tritux_password';
CREATE USER IF NOT EXISTS 'tritux_user'@'127.0.0.1' IDENTIFIED BY 'tritux_password';

GRANT ALL PRIVILEGES ON tritux_db.* TO 'tritux_user'@'localhost';
GRANT ALL PRIVILEGES ON tritux_db.* TO 'tritux_user'@'127.0.0.1';

FLUSH PRIVILEGES;

-- Vérification rapide (doit renvoyer une ligne 'tritux_user' pour chaque host) :
SELECT User, Host FROM mysql.user WHERE User = 'tritux_user';
