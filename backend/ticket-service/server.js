import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;
const JWT_SECRET = process.env.JWT_SECRET || 'tritux_secret_key_12345';

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// In-Memory mock database for tickets fallback
let mockTickets = [
  {
    id: 'TRX-1040',
    title: 'Impossible de se connecter au VPN',
    description: 'Erreur "La tentative de connexion VPN a échoué" lors de la connexion avec les identifiants Tritux depuis le réseau externe.',
    status: 'inprogress',
    priority: 'high',
    category: 'network',
    createdBy: { id: 'u1', name: 'Sami Belhadj', email: 'sami.belhadj@tritux.com' },
    assignedTo: { id: 'u2', name: 'Leila Mansour', email: 'leila.mansour@tritux.com' },
    createdAt: '2026-07-15T08:30:00Z',
    updatedAt: '2026-07-16T10:15:00Z',
    comments: [
      {
        id: 'c1',
        content: 'Veuillez vérifier si vous utilisez la dernière version du client OpenVPN.',
        author: { id: 'u2', name: 'Leila Mansour', email: 'leila.mansour@tritux.com' },
        createdAt: '2026-07-15T11:00:00Z',
        isInternal: false
      },
      {
        id: 'c2',
        content: 'Oui, j\'ai réinstallé le client hier mais le problème persiste. J\'ai la même erreur.',
        author: { id: 'u1', name: 'Sami Belhadj', email: 'sami.belhadj@tritux.com' },
        createdAt: '2026-07-15T14:30:00Z',
        isInternal: false
      }
    ],
    attachments: [
      {
        id: 'a1',
        name: 'vpn_error_log.txt',
        size: '12 KB',
        type: 'text/plain',
        url: '#',
        uploadedBy: 'Sami Belhadj',
        uploadedAt: '2026-07-15T08:32:00Z'
      }
    ],
    history: [
      {
        id: 'h1',
        field: 'status',
        oldValue: 'open',
        newValue: 'inprogress',
        changedBy: { id: 'u2', name: 'Leila Mansour', email: 'leila.mansour@tritux.com' },
        changedAt: '2026-07-15T10:15:00Z'
      }
    ],
    aiSuggestion: {
      category: 'network',
      priority: 'high',
      confidence: 91,
      suggestedResponse: 'Ce type d\'erreur VPN est souvent lié à l\'expiration du certificat client. Vérifiez la date système et essayez de réinstaller le certificat.'
    }
  },
  {
    id: 'TRX-1041',
    title: 'Demande d\'installation de Docker sur mon poste de travail',
    description: 'Besoin d\'installer Docker Desktop pour les développements locaux du projet Tritux Groupe.',
    status: 'open',
    priority: 'medium',
    category: 'software',
    createdBy: { id: 'u1', name: 'Sami Belhadj', email: 'sami.belhadj@tritux.com' },
    createdAt: '2026-07-16T09:00:00Z',
    updatedAt: '2026-07-16T09:00:00Z',
    comments: [],
    attachments: [],
    history: [],
    aiSuggestion: {
      category: 'software',
      priority: 'medium',
      confidence: 85,
      suggestedResponse: 'Pour les installations de logiciels tiers, vérifiez que votre poste dispose de la configuration minimale requise. Un agent interviendra à distance pour accorder les droits d\'administrateur requis.'
    }
  },
  {
    id: 'TRX-1042',
    title: 'Écran secondaire scintille continuellement',
    description: 'Mon deuxième écran Dell scintille lorsqu\'il est branché en HDMI sur le hub USB-C de mon ordinateur portable.',
    status: 'resolved',
    priority: 'low',
    category: 'hardware',
    createdBy: { id: 'u1', name: 'Sami Belhadj', email: 'sami.belhadj@tritux.com' },
    assignedTo: { id: 'u3', name: 'Karim Oueslati', email: 'karim.oueslati@tritux.com' },
    createdAt: '2026-07-14T10:00:00Z',
    updatedAt: '2026-07-14T16:00:00Z',
    comments: [
      {
        id: 'c3',
        content: 'J\'ai remplacé le câble HDMI défectueux. L\'affichage est maintenant stable.',
        author: { id: 'u3', name: 'Karim Oueslati', email: 'karim.oueslati@tritux.com' },
        createdAt: '2026-07-14T15:45:00Z',
        isInternal: false
      }
    ],
    attachments: [],
    history: [
      {
        id: 'h2',
        field: 'status',
        oldValue: 'inprogress',
        newValue: 'resolved',
        changedBy: { id: 'u3', name: 'Karim Oueslati', email: 'karim.oueslati@tritux.com' },
        changedAt: '2026-07-14T16:00:00Z'
      }
    ],
    satisfactionRating: {
      score: 5,
      comment: 'Résolution ultra-rapide par Karim, merci beaucoup !'
    }
  }
];

const KNOWN_AGENTS = [
  { id: 'u2', name: 'Leila Mansour', email: 'leila.mansour@tritux.com' },
  { id: 'u3', name: 'Karim Oueslati', email: 'karim.oueslati@tritux.com' },
  { id: 'u4', name: 'Admin Tritux', email: 'admin@tritux.com' }
];

let mockNotifications = [];

// DB Connection pool config
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

async function initDb() {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('[Ticket Service] MySQL Database connected successfully.');
    conn.release();
    useMock = false;
  } catch (error) {
    console.warn('[Ticket Service] MySQL connection failed. Falling back to In-Memory mock storage. Error:', error.message);
    useMock = true;
  }
}

initDb();

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Non autorisé - Token manquant' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session invalide ou expirée' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé - rôle insuffisant' });
    }
    next();
  };
}

function mapAttachment(row) {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    url: row.url,
    uploadedBy: row.uploaded_by ?? row.uploadedBy,
    uploadedAt: row.uploaded_at ?? row.uploadedAt
  };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(user) {
  if (user.name) return user.name;
  if (user.email) return user.email.split('@')[0].replace('.', ' ');
  return user.id || 'Utilisateur';
}

async function buildTicketFromDb(id) {
  const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const row = rows[0];

  const [comments] = await pool.query('SELECT * FROM comments WHERE ticket_id = ?', [id]);
  const [attachments] = await pool.query('SELECT * FROM attachments WHERE ticket_id = ?', [id]);
  const [history] = await pool.query('SELECT * FROM history WHERE ticket_id = ?', [id]);
  const [rating] = await pool.query('SELECT * FROM satisfaction_ratings WHERE ticket_id = ? LIMIT 1', [id]);
  const [ai] = await pool.query('SELECT * FROM ai_suggestions WHERE ticket_id = ? LIMIT 1', [id]);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    createdBy: { id: row.created_by_id, name: row.created_by_name, email: row.created_by_email },
    assignedTo: row.assigned_to_id
      ? { id: row.assigned_to_id, name: row.assigned_to_name, email: row.assigned_to_email }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: comments.map(c => ({
      id: c.id,
      content: c.content,
      author: { id: c.author_id, name: c.author_name, email: c.author_email },
      createdAt: c.created_at,
      isInternal: !!c.is_internal
    })),
    attachments: attachments.map(mapAttachment),
    history: history.map(h => ({
      id: h.id,
      field: h.field,
      oldValue: h.old_value,
      newValue: h.new_value,
      changedBy: { id: h.changed_by_id, name: h.changed_by_name, email: h.changed_by_email },
      changedAt: h.changed_at
    })),
    aiSuggestion: ai[0]
      ? {
          category: ai[0].category,
          priority: ai[0].priority,
          confidence: ai[0].confidence,
          suggestedResponse: ai[0].suggested_response
        }
      : null,
    satisfactionRating: rating[0]
      ? {
          score: rating[0].score,
          comment: rating[0].comment
        }
      : null
  };
}

async function createNotification({ userId, type, message, ticketId, ticketTitle }) {
  const notif = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    type,
    message,
    ticketId: ticketId || null,
    ticketTitle: ticketTitle || null,
    read: false,
    createdAt: new Date().toISOString()
  };

  mockNotifications.unshift(notif);

  if (!useMock && pool) {
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, message, ticket_id, ticket_title, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [notif.id, userId, type, message, ticketId || null, ticketTitle || null, 0, notif.createdAt]
    );
  }

  return notif;
}

function toPublicNotification(n) {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    ticketId: n.ticketId ?? n.ticket_id ?? undefined,
    ticketTitle: n.ticketTitle ?? n.ticket_title ?? undefined,
    read: n.read !== undefined ? !!n.read : !!n.is_read,
    createdAt: n.createdAt ?? n.created_at
  };
}

function resolveAgent(assignedTo, assignedToId) {
  if (assignedTo && typeof assignedTo === 'object' && assignedTo.id) {
    const known = KNOWN_AGENTS.find(a => a.id === assignedTo.id);
    return known || assignedTo;
  }

  const key = assignedToId || (typeof assignedTo === 'string' ? assignedTo : null);
  if (!key || key === 'Non assigné' || key === '') return null;

  return (
    KNOWN_AGENTS.find(a => a.id === key || a.name === key || a.email === key) || null
  );
}

// --- Notifications (must be registered before /:id) ---

app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    if (useMock) {
      const list = mockNotifications
        .filter(n => n.userId === req.user.id)
        .map(toPublicNotification);
      return res.json(list);
    }

    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows.map(toPublicNotification));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (useMock) {
      const notif = mockNotifications.find(n => n.id === id && n.userId === req.user.id);
      if (!notif) return res.status(404).json({ message: 'Notification non trouvée' });
      notif.read = true;
      return res.json(toPublicNotification(notif));
    }

    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }
    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    res.json(toPublicNotification(rows[0]));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.post('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    if (useMock) {
      mockNotifications.forEach(n => {
        if (n.userId === req.user.id) n.read = true;
      });
      return res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
    }

    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// --- Tickets ---

function canViewTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'agent') return ticket.assignedTo?.id === user.id;
  return ticket.createdBy?.id === user.id;
}

app.get('/', authenticateToken, async (req, res) => {
  try {
    if (useMock) {
      const filtered = mockTickets.filter(t => canViewTicket(req.user, t));
      return res.json(filtered);
    }

    let query = 'SELECT id FROM tickets';
    const params = [];
    if (req.user.role === 'agent') {
      query += ' WHERE assigned_to_id = ?';
      params.push(req.user.id);
    } else if (req.user.role !== 'admin') {
      query += ' WHERE created_by_id = ?';
      params.push(req.user.id);
    }

    const [rows] = await pool.query(query, params);
    const tickets = await Promise.all(rows.map(row => buildTicketFromDb(row.id)));
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (useMock) {
      const ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      if (!canViewTicket(req.user, ticket)) {
        return res.status(403).json({ message: 'Non autorisé' });
      }
      return res.json(ticket);
    }

    const ticket = await buildTicketFromDb(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

    if (!canViewTicket(req.user, ticket)) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.post('/', authenticateToken, async (req, res) => {
  const { title, description, category, priority, files, attachments, aiSuggestion } = req.body;
  if (!title || !description) {
    return res.status(400).json({ message: 'Titre et description requis' });
  }

  const id = `TRX-${Math.floor(1043 + Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const creatorName = displayName(req.user);
  const fileList = attachments || files || [];

  const historyEntry = {
    id: `h_${Date.now()}`,
    field: 'status',
    oldValue: '',
    newValue: 'open',
    changedBy: { id: req.user.id, name: creatorName, email: req.user.email },
    changedAt: now
  };

  const newTicket = {
    id,
    title,
    description,
    status: 'open',
    priority: priority || 'medium',
    category: category || 'other',
    createdBy: { id: req.user.id, name: creatorName, email: req.user.email },
    createdAt: now,
    updatedAt: now,
    comments: [],
    attachments: fileList.map((f, index) => ({
      id: `a_${Date.now()}_${index}`,
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
      url: f.url || '#',
      uploadedBy: creatorName,
      uploadedAt: now
    })),
    history: [historyEntry],
    aiSuggestion: aiSuggestion || null
  };

  try {
    if (useMock) {
      mockTickets.unshift(newTicket);
    } else {
      await pool.query(
        'INSERT INTO tickets (id, title, description, status, priority, category, created_by_id, created_by_name, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, title, description, 'open', newTicket.priority, newTicket.category, req.user.id, creatorName, req.user.email, now, now]
      );

      await pool.query(
        'INSERT INTO history (id, ticket_id, field, old_value, new_value, changed_by_id, changed_by_name, changed_by_email, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [historyEntry.id, id, 'status', '', 'open', req.user.id, creatorName, req.user.email, now]
      );

      for (const a of newTicket.attachments) {
        await pool.query(
          'INSERT INTO attachments (id, ticket_id, name, size, type, url, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [a.id, id, a.name, a.size, a.type, a.url, a.uploadedBy, a.uploadedAt]
        );
      }

      if (aiSuggestion) {
        const aiId = `ai_${Date.now()}`;
        await pool.query(
          'INSERT INTO ai_suggestions (id, ticket_id, category, priority, confidence, suggested_response) VALUES (?, ?, ?, ?, ?, ?)',
          [
            aiId,
            id,
            aiSuggestion.category || newTicket.category,
            aiSuggestion.priority || newTicket.priority,
            aiSuggestion.confidence || 0,
            aiSuggestion.suggestedResponse || ''
          ]
        );
      }
    }

    for (const agent of KNOWN_AGENTS) {
      await createNotification({
        userId: agent.id,
        type: 'new_ticket',
        message: `Nouveau ticket ${id} créé par ${creatorName} : ${title}`,
        ticketId: id,
        ticketTitle: title
      });
    }

    if (!useMock) {
      const full = await buildTicketFromDb(id);
      return res.status(201).json(full);
    }

    res.status(201).json(newTicket);
  } catch (err) {
    res.status(500).json({ message: 'Erreur de création', error: err.message });
  }
});

const updateStatusHandler = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ message: 'Statut requis' });

  const now = new Date().toISOString();
  const changerName = displayName(req.user);

  try {
    if (useMock) {
      const ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      const oldVal = ticket.status;
      ticket.status = status;
      ticket.updatedAt = now;

      ticket.history.push({
        id: `h_${Date.now()}`,
        field: 'status',
        oldValue: oldVal,
        newValue: status,
        changedBy: { id: req.user.id, name: changerName, email: req.user.email },
        changedAt: now
      });

      if (ticket.createdBy?.id) {
        await createNotification({
          userId: ticket.createdBy.id,
          type: 'status_change',
          message: `Le statut de votre ticket ${id} a été mis à jour : ${oldVal} → ${status}`,
          ticketId: id,
          ticketTitle: ticket.title
        });
      }

      return res.json(ticket);
    }

    const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Ticket non trouvé' });
    const oldVal = rows[0].status;

    await pool.query(
      'UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );

    const historyId = `h_${Date.now()}`;
    await pool.query(
      'INSERT INTO history (id, ticket_id, field, old_value, new_value, changed_by_id, changed_by_name, changed_by_email, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [historyId, id, 'status', oldVal, status, req.user.id, changerName, req.user.email, now]
    );

    await createNotification({
      userId: rows[0].created_by_id,
      type: 'status_change',
      message: `Le statut de votre ticket ${id} a été mis à jour : ${oldVal} → ${status}`,
      ticketId: id,
      ticketTitle: rows[0].title
    });

    const full = await buildTicketFromDb(id);
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};

app.put('/:id/status', authenticateToken, requireRoles('agent', 'admin'), updateStatusHandler);
app.patch('/:id/status', authenticateToken, requireRoles('agent', 'admin'), updateStatusHandler);

const assignTicketHandler = async (req, res) => {
  const { id } = req.params;
  const { assignedTo, assignedToId } = req.body;

  const now = new Date().toISOString();
  const changerName = displayName(req.user);
  const agent = resolveAgent(assignedTo, assignedToId);

  try {
    if (useMock) {
      const ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      const oldVal = ticket.assignedTo ? ticket.assignedTo.name : 'Non assigné';
      ticket.assignedTo = agent;
      ticket.updatedAt = now;

      ticket.history.push({
        id: `h_${Date.now()}`,
        field: 'assignedTo',
        oldValue: oldVal,
        newValue: agent ? agent.name : 'Non assigné',
        changedBy: { id: req.user.id, name: changerName, email: req.user.email },
        changedAt: now
      });

      if (agent?.id) {
        await createNotification({
          userId: agent.id,
          type: 'assignment',
          message: `Le ticket ${id} vous a été assigné par ${changerName}`,
          ticketId: id,
          ticketTitle: ticket.title
        });
      }

      return res.json(ticket);
    }

    const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Ticket non trouvé' });
    const oldVal = rows[0].assigned_to_name || 'Non assigné';

    await pool.query(
      'UPDATE tickets SET assigned_to_id = ?, assigned_to_name = ?, assigned_to_email = ?, updated_at = ? WHERE id = ?',
      [agent?.id || null, agent?.name || null, agent?.email || null, now, id]
    );

    const historyId = `h_${Date.now()}`;
    await pool.query(
      'INSERT INTO history (id, ticket_id, field, old_value, new_value, changed_by_id, changed_by_name, changed_by_email, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [historyId, id, 'assignedTo', oldVal, agent?.name || 'Non assigné', req.user.id, changerName, req.user.email, now]
    );

    if (agent?.id) {
      await createNotification({
        userId: agent.id,
        type: 'assignment',
        message: `Le ticket ${id} vous a été assigné par ${changerName}`,
        ticketId: id,
        ticketTitle: rows[0].title
      });
    }

    const full = await buildTicketFromDb(id);
    res.json(full);
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};

app.put('/:id/assign', authenticateToken, requireRoles('agent', 'admin'), assignTicketHandler);
app.patch('/:id/assign', authenticateToken, requireRoles('agent', 'admin'), assignTicketHandler);

app.post('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content, isInternal } = req.body;

  if (!content) return res.status(400).json({ message: 'Contenu requis' });

  if (isInternal && req.user.role !== 'agent' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Seuls les agents et admins peuvent créer des commentaires internes' });
  }

  const now = new Date().toISOString();
  const authorName = displayName(req.user);
  const commentId = `c_${Date.now()}`;

  const commentObj = {
    id: commentId,
    content,
    author: { id: req.user.id, name: authorName, email: req.user.email },
    createdAt: now,
    isInternal: !!isInternal
  };

  try {
    let ticket = null;

    if (useMock) {
      ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      ticket.comments.push(commentObj);
      ticket.updatedAt = now;
    } else {
      const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Ticket non trouvé' });

      await pool.query(
        'INSERT INTO comments (id, ticket_id, content, author_id, author_name, author_email, created_at, is_internal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [commentId, id, content, req.user.id, authorName, req.user.email, now, isInternal ? 1 : 0]
      );
      await pool.query('UPDATE tickets SET updated_at = ? WHERE id = ?', [now, id]);

      ticket = {
        id: rows[0].id,
        title: rows[0].title,
        createdBy: { id: rows[0].created_by_id },
        assignedTo: rows[0].assigned_to_id
          ? { id: rows[0].assigned_to_id }
          : null
      };
    }

    if (!isInternal) {
      const isAgentOrAdmin = req.user.role === 'agent' || req.user.role === 'admin';
      let notifyUserId = null;

      if (isAgentOrAdmin) {
        notifyUserId = ticket.createdBy?.id;
      } else {
        notifyUserId = ticket.assignedTo?.id;
      }

      if (notifyUserId && notifyUserId !== req.user.id) {
        await createNotification({
          userId: notifyUserId,
          type: 'new_comment',
          message: `${authorName} a ajouté un commentaire sur le ticket ${id}`,
          ticketId: id,
          ticketTitle: ticket.title
        });
      }
    }

    res.status(201).json(commentObj);
  } catch (err) {
    res.status(500).json({ message: 'Erreur de création du commentaire', error: err.message });
  }
});

app.post('/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: 'Fichier requis' });
  }

  const now = new Date().toISOString();
  const uploaderName = displayName(req.user);
  const attachmentId = `a_${Date.now()}`;
  const fileUrl = `/uploads/${req.file.filename}`;

  const attachmentObj = {
    id: attachmentId,
    name: req.file.originalname,
    size: formatFileSize(req.file.size),
    type: req.file.mimetype || 'application/octet-stream',
    url: fileUrl,
    uploadedBy: uploaderName,
    uploadedAt: now
  };

  try {
    if (useMock) {
      const ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      ticket.attachments.push(attachmentObj);
      ticket.updatedAt = now;
      return res.status(201).json(attachmentObj);
    }

    const [rows] = await pool.query('SELECT id FROM tickets WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Ticket non trouvé' });

    await pool.query(
      'INSERT INTO attachments (id, ticket_id, name, size, type, url, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [attachmentId, id, attachmentObj.name, attachmentObj.size, attachmentObj.type, attachmentObj.url, attachmentObj.uploadedBy, attachmentObj.uploadedAt]
    );
    await pool.query('UPDATE tickets SET updated_at = ? WHERE id = ?', [now, id]);

    res.status(201).json(attachmentObj);
  } catch (err) {
    res.status(500).json({ message: 'Erreur d\'upload', error: err.message });
  }
});

app.post('/:id/evaluate', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { score, rating, comment } = req.body;
  const finalScore = score || rating;

  if (!finalScore) return res.status(400).json({ message: 'Score ou évaluation requis' });

  try {
    if (useMock) {
      const ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      if (ticket.createdBy.id !== req.user.id) {
        return res.status(403).json({ message: 'Seul le créateur du ticket peut l\'évaluer' });
      }

      if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
        return res.status(400).json({ message: 'Le ticket doit être résolu ou fermé pour être évalué' });
      }

      if (ticket.satisfactionRating) {
        return res.status(400).json({ message: 'Ce ticket a déjà été évalué' });
      }

      ticket.satisfactionRating = { score: finalScore, comment: comment || '' };
      return res.json({ message: 'Évaluation enregistrée', satisfactionRating: ticket.satisfactionRating });
    }

    const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Ticket non trouvé' });
    const row = rows[0];

    if (row.created_by_id !== req.user.id) {
      return res.status(403).json({ message: 'Seul le créateur du ticket peut l\'évaluer' });
    }

    if (row.status !== 'resolved' && row.status !== 'closed') {
      return res.status(400).json({ message: 'Le ticket doit être résolu ou fermé pour être évalué' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM satisfaction_ratings WHERE ticket_id = ? LIMIT 1',
      [id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Ce ticket a déjà été évalué' });
    }

    const ratingId = `r_${Date.now()}`;
    await pool.query(
      'INSERT INTO satisfaction_ratings (id, ticket_id, score, comment) VALUES (?, ?, ?, ?)',
      [ratingId, id, finalScore, comment || '']
    );

    res.json({
      message: 'Évaluation enregistrée',
      satisfactionRating: { score: finalScore, comment: comment || '' }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur d\'évaluation', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Ticket Service] running on port ${PORT}`);
});
