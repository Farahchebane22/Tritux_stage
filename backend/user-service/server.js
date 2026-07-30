import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'tritux_secret_key_12345';

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
  queueLimit: 0
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
    role: row.role,
    department: row.department || '',
    joinDate: row.joinDate,
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
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Non autorisé — token manquant' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Session invalide ou expirée' });
  }
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

app.get('/profile', authenticateToken, getProfile);
app.get('/me', authenticateToken, getProfile);

async function getProfile(req, res) {
  try {
    const row = await findUserById(req.user.id);
    if (!row) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.json(await enrichUser(row));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
}

// Persist profile changes (fixes logout data loss)
app.put('/profile', authenticateToken, async (req, res) => {
  const { name, email, department } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Le nom est requis' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ message: 'L\'email est requis' });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanDept = department != null ? String(department).trim() : '';

  try {
    const current = await findUserById(req.user.id);
    if (!current) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (cleanEmail !== String(current.email).toLowerCase()) {
      const taken = await findUserByEmail(cleanEmail);
      if (taken && taken.id !== req.user.id) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé' });
      }
    }

    if (useMock) {
      current.name = cleanName;
      current.email = cleanEmail;
      current.department = cleanDept;
      const user = await enrichUser(current);
      return res.json({ user, token: signToken(user) });
    }

    await pool.query(
      'UPDATE users SET name = ?, email = ?, department = ? WHERE id = ?',
      [cleanName, cleanEmail, cleanDept || null, req.user.id]
    );

    const updated = await findUserById(req.user.id);
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
    const row = await findUserById(req.user.id);
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
      req.user.id
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
        .filter(u => u.role === 'agent')
        .map(u => mapUserRow(u));
    } else {
      let rows;
      try {
        [rows] = await pool.query(
          "SELECT id, name, email, role, department, joinDate, specialties FROM users WHERE role = 'agent'"
        );
      } catch {
        [rows] = await pool.query(
          "SELECT id, name, email, role, department, joinDate FROM users WHERE role = 'agent'"
        );
      }
      const defaultSpecs = {
        u2: ['network', 'security', 'account'],
        u3: ['software', 'email', 'hardware'],
      };
      agents = rows.map(r => {
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

app.listen(PORT, () => {
  console.log(`[User Service] running on port ${PORT}`);
});
