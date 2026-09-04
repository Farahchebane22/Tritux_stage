import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import {
  authenticateToken,
  mapLegacyRole,
  JWT_SECRET as SHARED_JWT_SECRET,
} from '../shared/auth.js';
import { createKeycloakUser } from './keycloakAdmin.js';

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || SHARED_JWT_SECRET || 'tritux_secret_key_12345';

app.use(cors());
app.use(express.json());

const mockUsers = [
  {
    id: 'u1',
    name: 'Sami Belhadj',
    email: 'sami.belhadj@tritux.com',
    role: 'user',
    department: 'Marketing',
    joinDate: '2023-01-15',
    ticketsCreated: 14,
    ticketsResolved: 12,
    passwordHash: null
  },
  {
    id: 'u2',
    name: 'Leila Mansour',
    email: 'leila.mansour@tritux.com',
    role: 'agent',
    department: 'IT Support',
    joinDate: '2022-09-01',
    specialties: ['network', 'security', 'account'],
    ticketsCreated: 0,
    ticketsResolved: 28,
    passwordHash: null
  },
  {
    id: 'u3',
    name: 'Karim Oueslati',
    email: 'karim.oueslati@tritux.com',
    role: 'agent',
    department: 'IT Support',
    joinDate: '2022-11-10',
    specialties: ['software', 'email', 'hardware'],
    ticketsCreated: 0,
    ticketsResolved: 19,
    passwordHash: null
  },
  {
    id: 'u4',
    name: 'Admin Tritux',
    email: 'admin@tritux.com',
    role: 'admin',
    department: 'Direction',
    joinDate: '2020-05-20',
    ticketsCreated: 1,
    ticketsResolved: 1,
    passwordHash: null
  }
];

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'tritux_user',
  password: process.env.DB_PASSWORD || 'tritux_password',
  database: process.env.DB_NAME || 'tritux_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('azure')))
    ? { rejectUnauthorized: false }
    : undefined,
};

let pool = null;
let useMock = true;

function parseSpecialties(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* csv fallback */
    }
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function mapUserRow(row, stats = {}) {
  if (!row) return null;
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: mapLegacyRole(row.role),
    department: row.department || '',
    joinDate: row.joinDate,
    societeId: row.societe_id || row.societeId || null,
    keycloakId: row.keycloak_id || row.keycloakId || null,
    phone: row.phone || null,
    ticketsCreated: stats.ticketsCreated ?? row.ticketsCreated ?? 0,
    ticketsResolved: stats.ticketsResolved ?? row.ticketsResolved ?? 0
  };
  const specs = parseSpecialties(row.specialties);
  if (specs.length) user.specialties = specs;
  return user;
}

function agentMatchesCategory(agent, category) {
  const specs = agent.specialties || [];
  if (!category) return true;
  if (category === 'other') return specs.includes('other') || specs.length > 0;
  return specs.includes(category);
}

async function getUserStats(userId) {
  if (useMock || !pool) {
    const u = mockUsers.find(x => x.id === userId);
    return {
      ticketsCreated: u?.ticketsCreated || 0,
      ticketsResolved: u?.ticketsResolved || 0
    };
  }
  try {
    const [created] = await pool.query(
      'SELECT COUNT(*) AS c FROM tickets WHERE created_by_id = ?',
      [userId]
    );
    const [resolved] = await pool.query(
      `SELECT COUNT(*) AS c FROM tickets
       WHERE (assigned_to_id = ? OR created_by_id = ?)
       AND status IN ('resolved', 'closed')`,
      [userId, userId]
    );
    return {
      ticketsCreated: created[0]?.c || 0,
      ticketsResolved: resolved[0]?.c || 0
    };
  } catch {
    return { ticketsCreated: 0, ticketsResolved: 0 };
  }
}

async function findUserById(id) {
  if (useMock) return mockUsers.find(u => u.id === id) || null;
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findUserByKeycloakId(keycloakId) {
  if (!keycloakId) return null;
  if (useMock) return mockUsers.find(u => u.keycloak_id === keycloakId || u.keycloakId === keycloakId) || null;
  const [rows] = await pool.query('SELECT * FROM users WHERE keycloak_id = ?', [keycloakId]);
  return rows[0] || null;
}

/**
 * Résout la ligne locale correspondant à req.user. Pour une session Keycloak,
 * req.user.id est l'UUID Keycloak (sub), qui ne correspond PAS à l'id de la
 * ligne locale (u_...). On essaie donc, dans l'ordre : id local direct,
 * keycloak_id, puis email.
 */
async function resolveLocalUser(reqUser) {
  let row = await findUserById(reqUser.id);
  if (row) return row;
  row = await findUserByKeycloakId(reqUser.keycloakId || reqUser.id);
  if (row) return row;
  if (reqUser.email) return findUserByEmail(reqUser.email);
  return null;
}

async function findUserByEmail(email) {
  if (useMock) {
    return mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function enrichUser(row) {
  const stats = await getUserStats(row.id);
  return mapUserRow(row, stats);
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      societeId: user.societeId || null,
      keycloakId: user.keycloakId || null,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function initDb() {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('[User Service] MySQL Database connected successfully.');
    try {
      await conn.query(
        'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL'
      );
      console.log('[User Service] Column password_hash added.');
    } catch (e) {
      if (!String(e.message).includes('Duplicate column')) {
        // ignore if already exists
      }
    }
    for (const col of [
      "ALTER TABLE users ADD COLUMN societe_id VARCHAR(50) NULL",
      "ALTER TABLE users ADD COLUMN keycloak_id VARCHAR(100) NULL",
      "ALTER TABLE users ADD COLUMN specialties VARCHAR(255) NULL",
      "ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL",
    ]) {
      try {
        await conn.query(col);
      } catch {
        /* column may exist */
      }
    }
    conn.release();
    useMock = false;
  } catch (error) {
    console.warn(
      '[User Service] MySQL connection failed. Falling back to In-Memory mock storage. Error:',
      error.message
    );
    useMock = true;
  }
}

initDb();

/**
 * Synchronise un utilisateur Keycloak avec MySQL (premier login / refresh).
 * Body: { keycloakId, email, name, role?, societeId? }
 */
app.post('/auth/keycloak-sync', authenticateToken, async (req, res) => {
  try {
    const keycloakId = req.user.keycloakId || req.user.id || req.body.keycloakId;
    const email = (req.body.email || req.user.email || '').toLowerCase();
    const name = req.body.name || req.user.name || email;
    const role = mapLegacyRole(req.body.role || req.user.role || 'CLIENT_USER');
    const societeId = req.body.societeId || req.user.societeId || null;

    if (!email) return res.status(400).json({ message: 'Email requis' });

    let row = await findUserByEmail(email);
    if (!row && keycloakId && !useMock) {
      const [byKc] = await pool.query('SELECT * FROM users WHERE keycloak_id = ?', [keycloakId]);
      row = byKc[0] || null;
    }

    if (!row) {
      const id = `u_${Date.now()}`;
      const joinDate = new Date().toISOString().split('T')[0];
      if (useMock) {
        row = {
          id,
          name,
          email,
          role,
          department: '',
          joinDate,
          societe_id: societeId,
          keycloak_id: keycloakId,
          ticketsCreated: 0,
          ticketsResolved: 0,
        };
        mockUsers.push(row);
      } else {
        await pool.query(
          `INSERT INTO users (id, name, email, role, department, joinDate, societe_id, keycloak_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, name, email, role, null, joinDate, societeId, keycloakId]
        );
        row = await findUserById(id);
      }
    } else {
      if (useMock) {
        row.keycloak_id = keycloakId;
        row.keycloakId = keycloakId;
        if (societeId) row.societe_id = societeId;
        row.role = role;
        row.name = name;
      } else {
        await pool.query(
          `UPDATE users SET keycloak_id = COALESCE(?, keycloak_id),
           societe_id = COALESCE(?, societe_id),
           name = ?, role = ? WHERE id = ?`,
          [keycloakId, societeId, name, role, row.id]
        );
        row = await findUserById(row.id);
      }
    }

    const user = await enrichUser(row);
    // Also issue a legacy token for services that still accept HS256 (optional bridge)
    const token = signToken(user);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ message: 'Sync Keycloak échouée', error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email requis' });
  }

  try {
    let row = await findUserByEmail(email);

    if (!row) {
      // Demo: auto-provision unknown emails as standard users
      const id = `u_${Date.now()}`;
      const name = email
        .split('@')[0]
        .split('.')
        .map(n => n.charAt(0).toUpperCase() + n.slice(1))
        .join(' ');
      const department = 'Marketing';
      const joinDate = new Date().toISOString().split('T')[0];
      const role = 'user';

      if (useMock) {
        row = { id, name, email, role, department, joinDate, passwordHash: null };
        mockUsers.push(row);
      } else {
        await pool.query(
          'INSERT INTO users (id, name, email, role, department, joinDate) VALUES (?, ?, ?, ?, ?, ?)',
          [id, name, email, role, department, joinDate]
        );
        row = { id, name, email, role, department, joinDate, password_hash: null };
      }
    }

    const hash = row.password_hash || row.passwordHash;
    if (hash) {
      if (!password) {
        return res.status(401).json({ message: 'Mot de passe requis' });
      }
      const ok = await bcrypt.compare(password, hash);
      if (!ok) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }
    }

    const user = await enrichUser(row);
    const token = signToken(user);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.post('/register', async (req, res) => {
  const { name, email, department, password } = req.body;
  if (!name || !email) {
    return res.status(400).json({ message: 'Nom et email requis' });
  }

  const role = 'user';
  const joinDate = new Date().toISOString().split('T')[0];
  const id = `u_${Date.now()}`;
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  try {
    const exists = await findUserByEmail(email);
    if (exists) {
      return res.status(400).json({ message: 'Cet email est déjà enregistré' });
    }

    if (useMock) {
      const newUser = {
        id,
        name,
        email,
        role,
        department: department || '',
        joinDate,
        ticketsCreated: 0,
        ticketsResolved: 0,
        passwordHash
      };
      mockUsers.push(newUser);
      const user = await enrichUser(newUser);
      return res.json({ user, token: signToken(user) });
    }

    await pool.query(
      'INSERT INTO users (id, name, email, role, department, joinDate, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, role, department || null, joinDate, passwordHash]
    );
    const user = await enrichUser({
      id,
      name,
      email,
      role,
      department: department || '',
      joinDate
    });
    res.json({ user, token: signToken(user) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

/**
 * Inscription self-service d'une nouvelle société cliente.
 * Crée le compte DANS KEYCLOAK (source de vérité de l'identité, conformément
 * au cahier des charges), puis synchronise la société + l'utilisateur en base
 * locale (societe_id, rôle, keycloak_id). Aucun mot de passe n'est géré en
 * dehors de Keycloak : la connexion se fait ensuite exclusivement via SSO.
 * Body: { societeName, secteurActivite?, name, email, password }
 */
app.post('/register-societe', async (req, res) => {
  const { societeName, secteurActivite, name, email, password, phone } = req.body;
  if (!societeName || !name || !email || !password) {
    return res.status(400).json({ message: 'Nom de société, nom, email et mot de passe requis' });
  }

  try {
    const exists = await findUserByEmail(email);
    if (exists) {
      return res.status(400).json({ message: 'Cet email est déjà enregistré' });
    }

    const societeId = `soc_${Date.now()}`;
    const userId = `u_${Date.now() + 1}`;
    const joinDate = new Date().toISOString().split('T')[0];
    const [firstName, ...rest] = name.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    let keycloakId = null;
    try {
      keycloakId = await createKeycloakUser({
        email,
        firstName: firstName || name,
        lastName,
        password,
        realmRole: 'client-admin',
        societeId,
      });
    } catch (kcErr) {
      return res.status(502).json({
        message: "Impossible de créer le compte dans Keycloak. Vérifiez que Keycloak tourne et que le client 'tritux-backend' a bien le rôle 'manage-users'.",
        error: kcErr.message,
      });
    }

    if (useMock) {
      const newUser = {
        id: userId,
        name,
        email,
        role: 'CLIENT_ADMIN',
        department: 'Direction',
        joinDate,
        societe_id: societeId,
        societeId,
        keycloak_id: keycloakId,
        phone: phone || null,
        ticketsCreated: 0,
        ticketsResolved: 0,
      };
      mockUsers.push(newUser);
      const user = await enrichUser(newUser);
      return res.status(201).json({
        user,
        societe: { id: societeId, nom: societeName, secteur_activite: secteurActivite || null },
      });
    }

    await pool.query(
      `INSERT INTO societes (id, nom, secteur_activite, contact_principal_nom, contact_principal_email, contact_principal_telephone, date_creation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [societeId, societeName, secteurActivite || null, name, email, phone || null, joinDate]
    );

    await pool.query(
      `INSERT INTO users (id, name, email, role, department, joinDate, societe_id, keycloak_id, phone)
       VALUES (?, ?, ?, 'CLIENT_ADMIN', 'Direction', ?, ?, ?, ?)`,
      [userId, name, email, joinDate, societeId, keycloakId, phone || null]
    );

    const row = await findUserById(userId);
    const user = await enrichUser(row);
    res.status(201).json({
      user,
      societe: { id: societeId, nom: societeName, secteur_activite: secteurActivite || null },
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur inscription société', error: err.message });
  }
});

app.get('/profile', authenticateToken, getProfile);
app.get('/me', authenticateToken, getProfile);

async function getProfile(req, res) {
  try {
    const row = await resolveLocalUser(req.user);
    if (!row) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(await enrichUser(row));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
}

// Persist profile changes (fixes logout data loss). Department is read-only (admin/RH only).
app.put('/profile', authenticateToken, async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Le nom est requis' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ message: 'L\'email est requis' });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPhone = phone != null ? String(phone).trim().slice(0, 30) : null;

  try {
    const current = await resolveLocalUser(req.user);
    if (!current) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (cleanEmail !== String(current.email).toLowerCase()) {
      const taken = await findUserByEmail(cleanEmail);
      if (taken && taken.id !== current.id) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé' });
      }
    }

    if (useMock) {
      current.name = cleanName;
      current.email = cleanEmail;
      current.phone = cleanPhone;
      // department intentionally unchanged
      const user = await enrichUser(current);
      return res.json({ user, token: signToken(user) });
    }

    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?',
      [cleanName, cleanEmail, cleanPhone, current.id]
    );

    const updated = await findUserById(current.id);
    const user = await enrichUser(updated);
    res.json({ user, token: signToken(user) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur de mise à jour', error: err.message });
  }
});

app.put('/profile/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({
      message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
    });
  }

  try {
    const row = await resolveLocalUser(req.user);
    if (!row) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const existingHash = row.password_hash || row.passwordHash;
    if (existingHash) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Mot de passe actuel requis' });
      }
      const ok = await bcrypt.compare(currentPassword, existingHash);
      if (!ok) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
      }
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    if (useMock) {
      row.passwordHash = passwordHash;
      return res.json({ message: 'Mot de passe mis à jour' });
    }

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      row.id
    ]);
    res.json({ message: 'Mot de passe mis à jour' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.get('/agents', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    let agents;
    if (useMock) {
      agents = mockUsers
        .filter(u => mapLegacyRole(u.role) === 'AGENT_IT')
        .map(u => mapUserRow(u));
    } else {
      let rows;
      try {
        [rows] = await pool.query(
          'SELECT id, name, email, role, department, joinDate, specialties, phone FROM users'
        );
      } catch {
        [rows] = await pool.query(
          'SELECT id, name, email, role, department, joinDate FROM users'
        );
      }
      const defaultSpecs = {
        u2: ['network', 'security', 'account'],
        u3: ['software', 'email', 'hardware'],
      };
      agents = rows
        .filter(r => mapLegacyRole(r.role) === 'AGENT_IT')
        .map(r => {
          const mapped = mapUserRow(r);
          if (!mapped.specialties?.length && defaultSpecs[r.id]) {
            mapped.specialties = defaultSpecs[r.id];
          }
          return mapped;
        });
    }

    if (category) {
      const specialized = agents.filter(a => agentMatchesCategory(a, category));
      const others = agents.filter(a => !agentMatchesCategory(a, category));
      return res.json({ category, specialized, others, all: agents });
    }

    res.json(agents);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

/**
 * Provisionne dans Keycloak un utilisateur qui existe déjà en base locale
 * mais pas encore dans l'annuaire Keycloak (ex: comptes du seed init.sql
 * créés avant la mise en place de Keycloak). Réservé aux super-admins.
 * Body: { email, password }
 */
app.post('/admin/provision-keycloak', authenticateToken, async (req, res) => {
  const role = mapLegacyRole(req.user.role);
  if (role !== 'SUPER_ADMIN' && role !== 'admin') {
    return res.status(403).json({ message: 'Réservé aux super-administrateurs' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email et password requis' });
  }

  const REALM_ROLE_BY_LOCAL = {
    SUPER_ADMIN: 'super-admin',
    AGENT_IT: 'agent-it',
    CLIENT_ADMIN: 'client-admin',
    CLIENT_USER: 'client-user',
  };

  try {
    const localRow = await findUserByEmail(email);
    if (!localRow) {
      return res.status(404).json({ message: `Aucun utilisateur local avec l'email ${email}` });
    }

    const localRole = mapLegacyRole(localRow.role);
    const realmRole = REALM_ROLE_BY_LOCAL[localRole];
    if (!realmRole) {
      return res.status(400).json({ message: `Rôle local non supporté pour le provisioning Keycloak: ${localRow.role}` });
    }

    const [firstName, ...rest] = String(localRow.name || email).trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    const keycloakId = await createKeycloakUser({
      email,
      firstName: firstName || localRow.name,
      lastName,
      password,
      realmRole,
      societeId: localRow.societe_id || null,
    });

    if (!useMock && pool) {
      await pool.query('UPDATE users SET keycloak_id = ? WHERE id = ?', [keycloakId, localRow.id]);
    }

    res.json({ message: 'Utilisateur provisionné dans Keycloak', keycloakId, email, realmRole });
  } catch (err) {
    res.status(500).json({ message: 'Provisioning Keycloak échoué', error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'user-service', mock: useMock });
});

app.listen(PORT, () => {
  console.log(`[User Service] running on port ${PORT}`);
});
