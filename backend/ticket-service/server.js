import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  authenticateToken,
  requireRoles,
  mapLegacyRole,
} from '../shared/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;
const CONTRACT_SERVICE_URL = process.env.CONTRACT_SERVICE_URL || 'http://localhost:5003';

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
    try {
      await conn.query('ALTER TABLE escalade_notifications ADD COLUMN palier INT NULL DEFAULT 1');
    } catch {
      /* colonne déjà existante */
    }
    try {
      await conn.query('ALTER TABLE escalade_notifications ADD COLUMN detail TEXT NULL');
    } catch {
      /* colonne déjà existante */
    }
    conn.release();
    useMock = false;
  } catch (error) {
    console.warn('[Ticket Service] MySQL connection failed. Falling back to In-Memory mock storage. Error:', error.message);
    useMock = true;
  }
}

initDb();

/**
 * Résout l'ID local (users.id) correspondant à req.user, indispensable pour
 * les sessions Keycloak où req.user.id est l'UUID Keycloak (sub), qui ne
 * correspond à aucune ligne de la table locale `users` (contrainte FK).
 * Auto-provisionne une ligne minimale si aucune n'existe encore (garde-fou).
 */
async function resolveLocalUserId(reqUser) {
  if (useMock || !pool) return reqUser.id;
  try {
    const [byId] = await pool.query('SELECT id FROM users WHERE id = ?', [reqUser.id]);
    if (byId[0]) return byId[0].id;

    if (reqUser.keycloakId) {
      const [byKc] = await pool.query('SELECT id FROM users WHERE keycloak_id = ?', [reqUser.keycloakId]);
      if (byKc[0]) return byKc[0].id;
    }

    if (reqUser.email) {
      const [byEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [reqUser.email]);
      if (byEmail[0]) return byEmail[0].id;
    }

    // Aucune ligne trouvée : auto-provisionne pour ne pas bloquer l'action en cours.
    const newId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await pool.query(
      'INSERT INTO users (id, name, email, role, department, joinDate, societe_id, keycloak_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newId,
        reqUser.name || reqUser.email || 'Utilisateur',
        reqUser.email || `${newId}@inconnu.local`,
        mapLegacyRole(reqUser.role) || 'CLIENT_USER',
        null,
        new Date().toISOString().split('T')[0],
        reqUser.societeId || null,
        reqUser.keycloakId || null,
      ]
    );
    return newId;
  } catch (e) {
    console.warn('[Ticket Service] resolveLocalUserId a échoué, repli sur req.user.id:', e.message);
    return reqUser.id;
  }
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

function parseSpecialties(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Sélectionne automatiquement un agent IT spécialiste de la catégorie du
 * ticket (ou n'importe quel agent si aucun spécialiste n'existe), pour
 * l'auto-assignation immédiate des tickets urgents (voir
 * docs/workflow-urgence-24-7.md).
 */
async function pickAutoAssignAgent(category) {
  if (useMock || !pool) return null;
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, specialties FROM users WHERE role IN ('AGENT_IT', 'agent')"
    );
    const withSpecs = rows.map(r => ({ ...r, specs: parseSpecialties(r.specialties) }));
    const matched = withSpecs.filter(a => a.specs.includes(category) || a.specs.includes('other'));
    const candidates = matched.length ? matched : withSpecs;
    return candidates[0] || null;
  } catch (e) {
    console.warn('[Ticket Service] pickAutoAssignAgent a échoué:', e.message);
    return null;
  }
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
    societeId: row.societe_id || null,
    applicationId: row.application_id || null,
    contratId: row.contrat_id || null,
    slaDeadline: row.sla_deadline || null,
    slaDeferred: !!row.sla_deferred,
    slaResumeAt: row.sla_resume_at || null,
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

async function getKnownAgents() {
  if (useMock || !pool) return KNOWN_AGENTS;
  try {
    const [rows] = await pool.query("SELECT id, name, email FROM users WHERE role = 'AGENT_IT'");
    // IMPORTANT : ne jamais retomber sur la liste KNOWN_AGENTS codée en dur ici
    // — ses IDs (u2/u3/u4) peuvent ne pas exister dans la vraie base, ce qui
    // provoquait précisément la violation de clé étrangère sur `notifications`.
    return rows;
  } catch (e) {
    console.warn('[Ticket Service] Lecture des agents échouée, aucune notification agent envoyée:', e.message);
    return [];
  }
}

function resolveAgent(assignedTo, assignedToId, agentsList) {
  const list = agentsList || KNOWN_AGENTS;
  if (assignedTo && typeof assignedTo === 'object' && assignedTo.id) {
    const known = list.find(a => a.id === assignedTo.id);
    return known || assignedTo;
  }

  const key = assignedToId || (typeof assignedTo === 'string' ? assignedTo : null);
  if (!key || key === 'Non assigné' || key === '') return null;

  return (
    list.find(a => a.id === key || a.name === key || a.email === key) || null
  );
}

// --- Notifications (must be registered before /:id) ---

app.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const localId = await resolveLocalUserId(req.user);
    if (useMock) {
      const list = mockNotifications
        .filter(n => n.userId === localId)
        .map(toPublicNotification);
      return res.json(list);
    }

    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [localId]
    );
    res.json(rows.map(toPublicNotification));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.patch('/notifications/:id/read', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const localId = await resolveLocalUserId(req.user);
    if (useMock) {
      const notif = mockNotifications.find(n => n.id === id && n.userId === localId);
      if (!notif) return res.status(404).json({ message: 'Notification non trouvée' });
      notif.read = true;
      return res.json(toPublicNotification(notif));
    }

    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, localId]
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
    const localId = await resolveLocalUserId(req.user);
    if (useMock) {
      mockNotifications.forEach(n => {
        if (n.userId === localId) n.read = true;
      });
      return res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
    }

    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [localId]
    );
    res.json({ message: 'Toutes les notifications ont été marquées comme lues' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// --- Tickets ---

function canViewTicket(user, ticket, localId) {
  if (!user || !ticket) return false;
  const role = mapLegacyRole(user.role);
  const id = localId || user.id;
  if (role === 'SUPER_ADMIN' || role === 'admin') return true;
  if (role === 'AGENT_IT' || role === 'agent') {
    // Visible si assigné à cet agent, OU si urgent et pas encore assigné
    // (filet de sécurité : permet à n'importe quel agent de le prendre en
    // charge si l'auto-assignation n'a trouvé personne).
    return ticket.assignedTo?.id === id || (ticket.priority === 'urgent' && !ticket.assignedTo);
  }
  if (role === 'CLIENT_ADMIN' && user.societeId) {
    return ticket.societeId === user.societeId || ticket.createdBy?.id === id;
  }
  return ticket.createdBy?.id === id;
}

async function evaluateSla({ authHeader, societeId, priority, createdAt, ticketId, category }) {
  if (!societeId) return null;
  try {
    const resp = await fetch(`${CONTRACT_SERVICE_URL}/sla/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader || '',
      },
      body: JSON.stringify({ societeId, priority, createdAt, ticketId, category }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.warn('[Ticket Service] SLA evaluate failed:', e.message);
    return null;
  }
}

// --- Escalade des tickets urgents non assignés (voir docs/workflow-urgence-24-7.md) ---

const ESCALATION_PALIER_2_MIN = 5;
const ESCALATION_PALIER_3_MIN = 15;

async function getStaffByRole(roleName) {
  if (useMock || !pool) return [];
  const roles =
    roleName === 'AGENT_IT' || roleName === 'agent'
      ? ['AGENT_IT', 'agent']
      : ['SUPER_ADMIN', 'admin'];
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, phone FROM users WHERE role IN (${roles.map(() => '?').join(',')})`,
      roles
    );
    return rows;
  } catch {
    return [];
  }
}

async function getMaxPalier(ticketId) {
  if (useMock || !pool) return 0;
  const [rows] = await pool.query(
    'SELECT MAX(palier) AS maxP FROM escalade_notifications WHERE ticket_id = ?',
    [ticketId]
  );
  return rows[0]?.maxP || 0;
}

async function notifyEscalation({ authHeader, ticketId, category, canal, palier, ticketTitle, societeId, targetRole, agentId }) {
  try {
    const resp = await fetch(`${CONTRACT_SERVICE_URL}/notify-urgent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader || '',
      },
      body: JSON.stringify({ ticketId, category, canal: canal || 'email', palier, ticketTitle, societeId, targetRole, agentId }),
    });
    if (!resp.ok) {
      console.warn(`[Ticket Service] notify-urgent (palier ${palier}) HTTP`, resp.status);
    }
  } catch (e) {
    console.warn(`[Ticket Service] notify-urgent (palier ${palier}) failed:`, e.message);
  }
}

/**
 * Calcule le palier d'escalade de chaque ticket urgent non assigné et
 * déclenche les notifications correspondant à tout palier nouvellement
 * franchi depuis le dernier appel (pas de scheduler serveur : le calcul se
 * fait à la volée, à chaque interrogation par un agent/admin connecté —
 * voir docs/workflow-urgence-24-7.md §5.1).
 */
async function getUrgentEscalationTickets(authHeader) {
  if (useMock || !pool) return [];

  const [rows] = await pool.query(`
    SELECT t.id, t.title, t.category, t.created_at, t.societe_id, t.contrat_id,
           s.nom AS societe_nom, c.canal_notification_urgence
    FROM tickets t
    LEFT JOIN societes s ON s.id = t.societe_id
    LEFT JOIN contrats_maintenance c ON c.id = t.contrat_id
    JOIN sla_regles r ON r.contrat_id = t.contrat_id AND r.priorite = 'urgent'
    WHERE t.priority = 'urgent'
      AND t.assigned_to_id IS NULL
      AND (t.sla_deferred = 0 OR t.sla_deferred IS NULL)
      AND r.notification_immediate = 1
    ORDER BY t.created_at ASC
  `);

  const now = Date.now();
  const results = [];

  for (const row of rows) {
    const waitingMinutes = Math.max(0, Math.floor((now - new Date(row.created_at).getTime()) / 60000));
    let palier = 1;
    if (waitingMinutes >= ESCALATION_PALIER_3_MIN) palier = 3;
    else if (waitingMinutes >= ESCALATION_PALIER_2_MIN) palier = 2;

    const lastPalier = await getMaxPalier(row.id);
    const canal = row.canal_notification_urgence || 'email';

    if (palier >= 2 && lastPalier < 2) {
      await notifyEscalation({
        authHeader,
        ticketId: row.id,
        category: row.category,
        canal,
        palier: 2,
        ticketTitle: row.title,
        societeId: row.societe_id,
        targetRole: 'AGENT_IT',
      });
      const agents = await getStaffByRole('AGENT_IT');
      for (const agent of agents) {
        await createNotification({
          userId: agent.id,
          type: 'urgent_escalation',
          message: `⚠️ Ticket urgent ${row.id} toujours non assigné (${waitingMinutes} min) — intervention requise`,
          ticketId: row.id,
          ticketTitle: row.title,
        });
      }
    }

    if (palier >= 3 && lastPalier < 3) {
      await notifyEscalation({
        authHeader,
        ticketId: row.id,
        category: row.category,
        canal,
        palier: 3,
        ticketTitle: row.title,
        societeId: row.societe_id,
        targetRole: 'SUPER_ADMIN',
      });
      const admins = await getStaffByRole('SUPER_ADMIN');
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'urgent_escalation',
          message: `🔴 CRITIQUE : ticket urgent ${row.id} non assigné depuis ${waitingMinutes} min — assignation immédiate requise`,
          ticketId: row.id,
          ticketTitle: row.title,
        });
      }
    }

    results.push({
      id: row.id,
      title: row.title,
      category: row.category,
      societeId: row.societe_id,
      societeName: row.societe_nom,
      createdAt: row.created_at,
      waitingMinutes,
      palier,
    });
  }

  return results;
}

/**
 * Liste des tickets urgents non assignés en cours d'escalade, avec leur
 * palier actuel. Réservé au staff interne (AGENT_IT/SUPER_ADMIN). Appelé
 * en polling par le frontend (toutes les 30s) pour alimenter le badge et
 * la popup de palier 3.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'ticket-service', mock: useMock });
});

app.get('/urgent-escalation', authenticateToken, async (req, res) => {
  try {
    const role = mapLegacyRole(req.user.role);
    if (role !== 'AGENT_IT' && role !== 'SUPER_ADMIN' && role !== 'agent' && role !== 'admin') {
      return res.status(403).json({ message: 'Réservé au staff interne' });
    }
    const tickets = await getUrgentEscalationTickets(req.headers.authorization);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.get('/', authenticateToken, async (req, res) => {
  try {
    const role = mapLegacyRole(req.user.role);
    const localId = await resolveLocalUserId(req.user);
    if (useMock) {
      const filtered = mockTickets.filter(t => canViewTicket(req.user, t, localId));
      return res.json(filtered);
    }

    let query = 'SELECT id FROM tickets';
    const params = [];
    if (role === 'AGENT_IT' || role === 'agent') {
      query += " WHERE assigned_to_id = ? OR (priority = 'urgent' AND assigned_to_id IS NULL)";
      params.push(localId);
    } else if (role === 'CLIENT_ADMIN' && req.user.societeId) {
      query += ' WHERE societe_id = ?';
      params.push(req.user.societeId);
    } else if (role !== 'SUPER_ADMIN' && role !== 'admin') {
      query += ' WHERE created_by_id = ?';
      params.push(localId);
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
    const localId = await resolveLocalUserId(req.user);
    if (useMock) {
      const ticket = mockTickets.find(t => t.id === id);
      if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

      if (!canViewTicket(req.user, ticket, localId)) {
        return res.status(403).json({ message: 'Non autorisé' });
      }
      return res.json(ticket);
    }

    const ticket = await buildTicketFromDb(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé' });

    if (!canViewTicket(req.user, ticket, localId)) {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

app.post('/', authenticateToken, async (req, res) => {
  const { title, description, category, priority, files, attachments, aiSuggestion, applicationId } = req.body;
  if (!title || !description) {
    return res.status(400).json({ message: 'Titre et description requis' });
  }

  const id = `TRX-${Math.floor(1043 + Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const creatorName = displayName(req.user);
  const creatorId = await resolveLocalUserId(req.user);
  const fileList = attachments || files || [];
  const societeId = req.user.societeId || req.body.societeId || null;

  const sla = await evaluateSla({
    authHeader: req.headers.authorization,
    societeId,
    priority: priority || 'medium',
    createdAt: now,
    ticketId: id,
    category: category || 'other',
  });

  // Auto-assignation immédiate pour les tickets urgents couverts par un
  // contrat à notification immédiate (ex: 24/7) — pas d'attente d'une
  // assignation manuelle par l'admin (voir docs/workflow-urgence-24-7.md).
  let autoAssignedAgent = null;
  if ((priority || 'medium') === 'urgent' && sla?.escalate && !sla?.deferred) {
    autoAssignedAgent = await pickAutoAssignAgent(category || 'other');
  }

  const historyEntries = [
    {
      id: `h_${Date.now()}`,
      field: 'status',
      oldValue: '',
      newValue: 'open',
      changedBy: { id: creatorId, name: creatorName, email: req.user.email },
      changedAt: now
    }
  ];
  if (autoAssignedAgent) {
    historyEntries.push({
      id: `h_${Date.now()}_a`,
      field: 'assignedTo',
      oldValue: 'Non assigné',
      newValue: autoAssignedAgent.name,
      changedBy: { id: creatorId, name: 'Système (auto-assignation urgence)', email: req.user.email },
      changedAt: now
    });
  }
  const historyEntry = historyEntries[0];

  const newTicket = {
    id,
    title,
    description,
    status: 'open',
    priority: priority || 'medium',
    category: category || 'other',
    createdBy: { id: creatorId, name: creatorName, email: req.user.email },
    assignedTo: autoAssignedAgent
      ? { id: autoAssignedAgent.id, name: autoAssignedAgent.name, email: autoAssignedAgent.email }
      : null,
    createdAt: now,
    updatedAt: now,
    societeId,
    applicationId: applicationId || null,
    contratId: sla?.contratId || null,
    slaDeadline: sla?.slaDeadline || null,
    slaDeferred: !!sla?.deferred,
    slaResumeAt: sla?.resumeAt || null,
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
    history: historyEntries,
    aiSuggestion: aiSuggestion || null
  };

  try {
    if (useMock) {
      mockTickets.unshift(newTicket);
    } else {
      try {
        await pool.query(
          `INSERT INTO tickets
           (id, title, description, status, priority, category, created_by_id, created_by_name, created_by_email,
            created_at, updated_at, societe_id, application_id, contrat_id, sla_deadline, sla_deferred, sla_resume_at,
            assigned_to_id, assigned_to_name, assigned_to_email)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, title, description, 'open', newTicket.priority, newTicket.category,
            creatorId, creatorName, req.user.email, now, now,
            societeId, applicationId || null, sla?.contratId || null,
            sla?.slaDeadline || null, sla?.deferred ? 1 : 0, sla?.resumeAt || null,
            autoAssignedAgent?.id || null, autoAssignedAgent?.name || null, autoAssignedAgent?.email || null
          ]
        );
      } catch (colErr) {
        // Fallback if multi-tenant columns not yet migrated
        await pool.query(
          'INSERT INTO tickets (id, title, description, status, priority, category, created_by_id, created_by_name, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, title, description, 'open', newTicket.priority, newTicket.category, creatorId, creatorName, req.user.email, now, now]
        );
      }

      for (const h of historyEntries) {
        await pool.query(
          'INSERT INTO history (id, ticket_id, field, old_value, new_value, changed_by_id, changed_by_name, changed_by_email, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [h.id, id, h.field, h.oldValue, h.newValue, h.changedBy.id, h.changedBy.name, h.changedBy.email, h.changedAt]
        );
      }

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

    const agents = await getKnownAgents();
    for (const agent of agents) {
      try {
        await createNotification({
          userId: agent.id,
          type: 'new_ticket',
          message: `Nouveau ticket ${id} créé par ${creatorName} : ${title}`,
          ticketId: id,
          ticketTitle: title
        });
      } catch (notifErr) {
        // Une notification qui échoue (agent supprimé, etc.) ne doit jamais
        // faire échouer la création du ticket lui-même.
        console.warn('[Ticket Service] Notification agent échouée pour', agent.id, ':', notifErr.message);
      }
    }

    if (autoAssignedAgent) {
      // Agent déjà auto-assigné : on ne notifie QUE lui (appel+SMS), pas tous
      // les autres spécialistes.
      await notifyEscalation({
        authHeader: req.headers.authorization,
        ticketId: id,
        category: newTicket.category,
        canal: sla?.canal || sla?.rule?.canal,
        palier: 1,
        ticketTitle: title,
        societeId,
        agentId: autoAssignedAgent.id,
      });
      try {
        await createNotification({
          userId: autoAssignedAgent.id,
          type: 'assignment',
          message: `🔴 Ticket URGENT ${id} vous a été automatiquement assigné — intervention immédiate requise`,
          ticketId: id,
          ticketTitle: title,
        });
      } catch (e) {
        console.warn('[Ticket Service] Notification auto-assignation échouée:', e.message);
      }
    } else if (
      newTicket.priority === 'urgent' &&
      sla?.escalate &&
      !sla?.deferred
    ) {
      // Aucun agent auto-assignable trouvé : on repasse sur l'alerte large
      // aux spécialistes (palier 1 classique, en attente d'une prise en charge).
      await notifyEscalation({
        authHeader: req.headers.authorization,
        ticketId: id,
        category: newTicket.category,
        canal: sla?.canal || sla?.rule?.canal,
        palier: 1,
        ticketTitle: title,
        societeId,
        targetRole: 'AGENT_IT',
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
    const changerId = await resolveLocalUserId(req.user);

    await pool.query(
      'UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );

    const historyId = `h_${Date.now()}`;
    await pool.query(
      'INSERT INTO history (id, ticket_id, field, old_value, new_value, changed_by_id, changed_by_name, changed_by_email, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [historyId, id, 'status', oldVal, status, changerId, changerName, req.user.email, now]
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

app.put('/:id/status', authenticateToken, requireRoles('agent', 'admin', 'AGENT_IT', 'SUPER_ADMIN'), updateStatusHandler);
app.patch('/:id/status', authenticateToken, requireRoles('agent', 'admin', 'AGENT_IT', 'SUPER_ADMIN'), updateStatusHandler);

const assignTicketHandler = async (req, res) => {
  const { id } = req.params;
  const { assignedTo, assignedToId } = req.body;

  const now = new Date().toISOString();
  const changerName = displayName(req.user);
  const agents = await getKnownAgents();
  const agent = resolveAgent(assignedTo, assignedToId, agents);

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
    const changerId = await resolveLocalUserId(req.user);

    await pool.query(
      'UPDATE tickets SET assigned_to_id = ?, assigned_to_name = ?, assigned_to_email = ?, updated_at = ? WHERE id = ?',
      [agent?.id || null, agent?.name || null, agent?.email || null, now, id]
    );

    const historyId = `h_${Date.now()}`;
    await pool.query(
      'INSERT INTO history (id, ticket_id, field, old_value, new_value, changed_by_id, changed_by_name, changed_by_email, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [historyId, id, 'assignedTo', oldVal, agent?.name || 'Non assigné', changerId, changerName, req.user.email, now]
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

app.put('/:id/assign', authenticateToken, requireRoles('agent', 'admin', 'AGENT_IT', 'SUPER_ADMIN'), assignTicketHandler);
app.patch('/:id/assign', authenticateToken, requireRoles('agent', 'admin', 'AGENT_IT', 'SUPER_ADMIN'), assignTicketHandler);

app.post('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content, isInternal } = req.body;

  if (!content) return res.status(400).json({ message: 'Contenu requis' });

  if (isInternal && req.user.role !== 'agent' && req.user.role !== 'admin' && req.user.role !== 'AGENT_IT' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Seuls les agents et admins peuvent créer des commentaires internes' });
  }

  const now = new Date().toISOString();
  const authorName = displayName(req.user);
  const authorId = await resolveLocalUserId(req.user);
  const commentId = `c_${Date.now()}`;

  const commentObj = {
    id: commentId,
    content,
    author: { id: authorId, name: authorName, email: req.user.email },
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
        [commentId, id, content, authorId, authorName, req.user.email, now, isInternal ? 1 : 0]
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
      const isAgentOrAdmin =
        req.user.role === 'agent' || req.user.role === 'admin' ||
        req.user.role === 'AGENT_IT' || req.user.role === 'SUPER_ADMIN';
      let notifyUserId = null;

      if (isAgentOrAdmin) {
        notifyUserId = ticket.createdBy?.id;
      } else {
        notifyUserId = ticket.assignedTo?.id;
      }

      if (notifyUserId && notifyUserId !== authorId) {
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
    const localId = await resolveLocalUserId(req.user);

    if (row.created_by_id !== localId) {
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
