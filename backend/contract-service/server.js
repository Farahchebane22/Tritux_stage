/**
 * contract-service — Sociétés, contrats, gate d'accès, moteur SLA.
 * Port 5003
 */
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  authenticateToken,
  isInternalStaff,
  isClientRole,
  mapLegacyRole,
} from '../shared/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'tritux_user',
  password: process.env.DB_PASSWORD || 'tritux_password',
  database: process.env.DB_NAME || 'tritux_db',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool = null;
let useMock = true;

const mockSocietes = [
  {
    id: 'soc_demo',
    nom: 'Acme Tunisie SAS',
    secteur_activite: 'Industrie',
    contact_principal_nom: 'Nour Ben Ali',
    contact_principal_email: 'nour.benali@acme.tn',
    contact_principal_telephone: '+216 71 000 000',
    date_creation: '2026-01-10',
  },
];

const mockContrats = [
  {
    id: 'ctr_acme_57',
    societe_id: 'soc_demo',
    type_contrat: '5/7',
    canal_notification_urgence: 'email',
    jours_ouvres: 'lundi-vendredi',
    heures_ouvrees: '08:00-18:00',
    date_debut: '2026-01-01',
    date_fin: '2026-12-31',
    statut: 'actif',
    conditions_texte:
      'Contrat de maintenance 5/7 (lundi–vendredi 08h–18h). Escalade immédiate pour urgences en heures ouvrées.',
  },
];

const mockSla = [
  { id: 'sla_acme_low', contrat_id: 'ctr_acme_57', priorite: 'low', delai_reponse_minutes: 480, notification_immediate: 0, canal: 'email' },
  { id: 'sla_acme_med', contrat_id: 'ctr_acme_57', priorite: 'medium', delai_reponse_minutes: 240, notification_immediate: 0, canal: 'email' },
  { id: 'sla_acme_high', contrat_id: 'ctr_acme_57', priorite: 'high', delai_reponse_minutes: 120, notification_immediate: 1, canal: 'email' },
  { id: 'sla_acme_urg', contrat_id: 'ctr_acme_57', priorite: 'urgent', delai_reponse_minutes: 30, notification_immediate: 1, canal: 'sms' },
];

const mockAcceptances = [];
const mockEscalades = [];

async function initDb() {
  try {
    pool = mysql.createPool(dbConfig);
    const c = await pool.getConnection();
    c.release();
    useMock = false;
    console.log('[Contract Service] MySQL connected');
  } catch (e) {
    useMock = true;
    console.warn('[Contract Service] MySQL unavailable, mock mode:', e.message);
  }
}

function isContractActive(contrat, now = new Date()) {
  if (!contrat || contrat.statut !== 'actif') return false;
  const end = new Date(contrat.date_fin);
  end.setHours(23, 59, 59, 999);
  return end >= now;
}

function parseCoverageWindow(contrat, now = new Date()) {
  if (contrat.type_contrat === '24/7') {
    return { covered: true, resumeAt: null };
  }

  const day = now.getDay(); // 0=Sun
  const isWeekend = day === 0 || day === 6;
  const [startH, endH] = (contrat.heures_ouvrees || '08:00-18:00').split('-');
  const [sh, sm] = startH.split(':').map(Number);
  const [eh, em] = endH.split(':').map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const startM = sh * 60 + (sm || 0);
  const endM = eh * 60 + (em || 0);
  const inHours = minutes >= startM && minutes < endM;

  if (contrat.type_contrat === '5/7' || contrat.type_contrat === '8/5') {
    if (!isWeekend && inHours) return { covered: true, resumeAt: null };
    // next Monday 08:00 (or next day open)
    const resume = new Date(now);
    if (isWeekend) {
      const add = day === 6 ? 2 : 1;
      resume.setDate(resume.getDate() + add);
    } else if (!inHours && minutes >= endM) {
      resume.setDate(resume.getDate() + (day === 5 ? 3 : 1));
    }
    resume.setHours(sh, sm || 0, 0, 0);
    return { covered: false, resumeAt: resume.toISOString() };
  }

  return { covered: true, resumeAt: null };
}

function addMinutes(isoOrDate, minutes) {
  const d = new Date(isoOrDate);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

async function getActiveContractForSociete(societeId) {
  if (!societeId) return null;
  if (useMock) {
    const c = mockContrats.find((x) => x.societe_id === societeId && isContractActive(x));
    if (!c) return null;
    const regles = mockSla.filter((s) => s.contrat_id === c.id);
    return { ...c, slaRegles: regles };
  }
  const [rows] = await pool.query(
    `SELECT * FROM contrats_maintenance
     WHERE societe_id = ? AND statut = 'actif' AND date_fin >= CURDATE()
     ORDER BY date_fin DESC LIMIT 1`,
    [societeId]
  );
  if (!rows[0]) return null;
  const [regles] = await pool.query('SELECT * FROM sla_regles WHERE contrat_id = ?', [rows[0].id]);
  return { ...rows[0], slaRegles: regles };
}

async function getSociete(id) {
  if (useMock) return mockSocietes.find((s) => s.id === id) || null;
  const [rows] = await pool.query('SELECT * FROM societes WHERE id = ?', [id]);
  return rows[0] || null;
}

/** Access gate for clients */
app.get('/access/status', authenticateToken, async (req, res) => {
  try {
    const role = mapLegacyRole(req.user.role);
    if (isInternalStaff(role)) {
      return res.json({
        allowed: true,
        requiresContractAck: false,
        reason: 'internal_staff',
        role,
      });
    }

    const societeId = req.user.societeId;
    if (!societeId) {
      return res.json({
        allowed: false,
        requiresContractAck: false,
        reason: 'no_company',
        message: 'Aucun contrat de maintenance actif',
        contact: {
          email: 'commercial@tritux.com',
          phone: '+216 71 000 111',
          label: 'Contact commercial Tritux',
        },
      });
    }

    const contrat = await getActiveContractForSociete(societeId);
    if (!contrat) {
      return res.json({
        allowed: false,
        requiresContractAck: false,
        reason: 'no_active_contract',
        message: 'Aucun contrat de maintenance actif',
        societe: await getSociete(societeId),
        contact: {
          email: 'commercial@tritux.com',
          phone: '+216 71 000 111',
          label: 'Contact commercial Tritux pour souscrire un contrat',
        },
      });
    }

    // Check if already accepted this session (optional query sessionId)
    const sessionId = req.query.sessionId || req.headers['x-session-id'];
    let alreadyAcked = false;
    if (sessionId) {
      if (useMock) {
        alreadyAcked = mockAcceptances.some(
          (a) => a.user_id === req.user.id && a.contrat_id === contrat.id && a.session_id === sessionId
        );
      } else {
        const [acks] = await pool.query(
          'SELECT id FROM contrat_acceptances WHERE user_id = ? AND contrat_id = ? AND session_id = ? LIMIT 1',
          [req.user.id, contrat.id, sessionId]
        );
        alreadyAcked = acks.length > 0;
      }
    }

    const societe = await getSociete(societeId);
    return res.json({
      allowed: true,
      requiresContractAck: !alreadyAcked,
      reason: 'contract_ok',
      role,
      societe,
      contrat: {
        id: contrat.id,
        type_contrat: contrat.type_contrat,
        canal_notification_urgence: contrat.canal_notification_urgence,
        jours_ouvres: contrat.jours_ouvres,
        heures_ouvrees: contrat.heures_ouvrees,
        date_debut: contrat.date_debut,
        date_fin: contrat.date_fin,
        statut: contrat.statut,
        conditions_texte: contrat.conditions_texte,
        slaRegles: (contrat.slaRegles || []).map((r) => ({
          priorite: r.priorite,
          delai_reponse_minutes: r.delai_reponse_minutes,
          notification_immediate: !!r.notification_immediate,
          canal: r.canal,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur accès contrat', error: err.message });
  }
});

app.post('/access/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { contratId, sessionId } = req.body;
    if (!contratId) return res.status(400).json({ message: 'contratId requis' });
    const id = `ack_${Date.now()}`;
    const now = new Date().toISOString();
    if (useMock) {
      mockAcceptances.push({
        id,
        user_id: req.user.id,
        contrat_id: contratId,
        accepted_at: now,
        session_id: sessionId || null,
      });
    } else {
      await pool.query(
        `INSERT INTO contrat_acceptances (id, user_id, contrat_id, accepted_at, session_id)
         VALUES (?, ?, ?, ?, ?)`,
        [id, req.user.id, contratId, now, sessionId || null]
      );
    }
    res.json({ ok: true, acceptedAt: now });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** SLA engine — called by ticket-service on ticket creation */
app.post('/sla/evaluate', authenticateToken, async (req, res) => {
  try {
    const { societeId, priority, createdAt, ticketId, category } = req.body;
    if (!societeId) {
      return res.json({
        contratId: null,
        slaDeadline: null,
        deferred: false,
        covered: true,
        escalate: false,
      });
    }

    const contrat = await getActiveContractForSociete(societeId);
    if (!contrat) {
      return res.status(422).json({ message: 'Aucun contrat actif pour cette société' });
    }

    const now = createdAt ? new Date(createdAt) : new Date();
    const coverage = parseCoverageWindow(contrat, now);
    const rule =
      (contrat.slaRegles || []).find((r) => r.priorite === priority) ||
      (contrat.slaRegles || []).find((r) => r.priorite === 'medium');

    const delay = rule?.delai_reponse_minutes || 240;
    const base = coverage.covered ? now : new Date(coverage.resumeAt);
    const slaDeadline = addMinutes(base, delay);

    const escalate =
      coverage.covered &&
      !!rule?.notification_immediate &&
      (priority === 'urgent' || priority === 'high');

    let escalade = null;
    if (escalate && ticketId) {
      escalade = await sendUrgentAlert({
        ticketId,
        canal: rule.canal || contrat.canal_notification_urgence || 'email',
        category,
        agentHint: null,
      });
    }

    res.json({
      contratId: contrat.id,
      slaDeadline,
      deferred: !coverage.covered,
      resumeAt: coverage.resumeAt,
      covered: coverage.covered,
      escalate,
      rule: rule
        ? {
            priorite: rule.priorite,
            delai_reponse_minutes: rule.delai_reponse_minutes,
            canal: rule.canal,
          }
        : null,
      escalade,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * NotificationService mock — replace body with Twilio later.
 * Interface: sendUrgentAlert({ ticketId, agentId, canal })
 */
export async function sendUrgentAlert({ ticketId, agentId, canal, category }) {
  const id = `esc_${Date.now()}`;
  const now = new Date().toISOString();
  const detail = `[MOCK ${canal}] Alerte urgente ticket ${ticketId} (catégorie=${category || 'n/a'})`;
  console.log(`[NotificationService] ${detail}`);

  const row = {
    id,
    ticket_id: ticketId,
    agent_id: agentId || null,
    canal: canal || 'email',
    date_envoi: now,
    statut_envoi: 'envoye',
    detail,
  };

  if (useMock) {
    mockEscalades.push(row);
  } else if (pool) {
    await pool.query(
      `INSERT INTO escalade_notifications (id, ticket_id, agent_id, canal, date_envoi, statut_envoi, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.ticket_id, row.agent_id, row.canal, row.date_envoi, row.statut_envoi, row.detail]
    );
  }
  return row;
}

app.post('/notifications/urgent', authenticateToken, async (req, res) => {
  try {
    const result = await sendUrgentAlert(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/societes', authenticateToken, async (req, res) => {
  try {
    const role = mapLegacyRole(req.user.role);
    if (isClientRole(role)) {
      const s = await getSociete(req.user.societeId);
      return res.json(s ? [s] : []);
    }
    if (useMock) return res.json(mockSocietes);
    const [rows] = await pool.query('SELECT * FROM societes ORDER BY nom');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/societes/:id/contrats', authenticateToken, async (req, res) => {
  try {
    if (useMock) {
      return res.json(mockContrats.filter((c) => c.societe_id === req.params.id));
    }
    const [rows] = await pool.query('SELECT * FROM contrats_maintenance WHERE societe_id = ?', [
      req.params.id,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/contrats/:id', authenticateToken, async (req, res) => {
  try {
    const contrat = useMock
      ? mockContrats.find((c) => c.id === req.params.id)
      : (await pool.query('SELECT * FROM contrats_maintenance WHERE id = ?', [req.params.id]))[0][0];
    if (!contrat) return res.status(404).json({ message: 'Contrat introuvable' });
    const regles = useMock
      ? mockSla.filter((s) => s.contrat_id === contrat.id)
      : (await pool.query('SELECT * FROM sla_regles WHERE contrat_id = ?', [contrat.id]))[0];
    res.json({ ...contrat, slaRegles: regles });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'contract-service', mock: useMock });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`[Contract Service] running on port ${PORT}`));
});
