/**
 * contract-service — Sociétés, contrats, gate d'accès, moteur SLA.
 * Port 5003
 */
import 'dotenv/config';
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
import { placeUrgentCall, sendUrgentSms, twilioConfigured } from './notificationProvider.js';

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
  ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('azure')))
    ? { rejectUnauthorized: false }
    : undefined,
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
    const conn = await pool.getConnection();
    for (const col of [
      'ALTER TABLE escalade_notifications ADD COLUMN palier INT NULL DEFAULT 1',
      'ALTER TABLE escalade_notifications ADD COLUMN detail TEXT NULL',
    ]) {
      try {
        await conn.query(col);
      } catch {
        /* colonne déjà existante */
      }
    }
    conn.release();
    useMock = false;
    console.log('[Contract Service] MySQL connected');
  } catch (e) {
    useMock = true;
    console.warn('[Contract Service] MySQL unavailable, mock mode:', e.message);
  }
}

function parseSpecialties(row) {
  if (!row.specialties) return [];
  if (Array.isArray(row.specialties)) return row.specialties;
  return String(row.specialties)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function agentMatchesCategory(agent, category) {
  if (!category) return true;
  const specs = agent.specialties || [];
  if (!specs.length) return false;
  return specs.includes(category) || specs.includes('other');
}

async function getItAgents() {
  if (useMock || !pool) {
    return [
      { id: 'u2', name: 'Leila Mansour', email: 'leila.mansour@tritux.com', phone: null, specialties: ['network', 'security', 'account'] },
      { id: 'u3', name: 'Karim Oueslati', email: 'karim.oueslati@tritux.com', phone: null, specialties: ['software', 'email', 'hardware'] },
    ];
  }
  let rows;
  try {
    [rows] = await pool.query(
      "SELECT id, name, email, phone, specialties FROM users WHERE role IN ('AGENT_IT', 'agent')"
    );
  } catch {
    [rows] = await pool.query(
      "SELECT id, name, email, specialties FROM users WHERE role IN ('AGENT_IT', 'agent')"
    );
  }
  return rows.map((r) => ({ ...r, specialties: parseSpecialties(r) }));
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

    res.json({
      contratId: contrat.id,
      slaDeadline,
      deferred: !coverage.covered,
      resumeAt: coverage.resumeAt,
      covered: coverage.covered,
      escalate,
      canal: rule?.canal || contrat.canal_notification_urgence || 'email',
      rule: rule
        ? {
            priorite: rule.priorite,
            delai_reponse_minutes: rule.delai_reponse_minutes,
            canal: rule.canal,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * NotificationService — appelle un vrai fournisseur (Twilio) pour SMS et
 * appels téléphoniques quand configuré (voir notificationProvider.js), sinon
 * retombe en mock console. Journalise toujours dans escalade_notifications.
 * Interface: sendUrgentAlert({ ticketId, agentId, canal })
 */
export async function sendUrgentAlert({ ticketId, agentId, agent, canal, category, palier = 1, ticketTitle, societeName }) {
  const id = `esc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const recipient = agent?.name || agentId || 'destinataire inconnu';
  const viaPhone = (canal === 'sms' || canal === 'telephone') && agent?.phone;

  // Pour une alerte urgente, on déclenche l'APPEL ET le SMS ensemble dès que
  // le contrat prévoit un canal téléphonique (sms OU telephone) — un seul
  // canal peut être manqué (SMS non lu, appel non décroché).
  let callResult = { ok: true, mock: true };
  let smsResult = { ok: true, mock: true };
  if (viaPhone) {
    callResult = await placeUrgentCall({ toPhone: agent.phone, ticketId, ticketTitle: ticketTitle || '', societeName });
    smsResult = await sendUrgentSms({ toPhone: agent.phone, ticketId, ticketTitle: ticketTitle || '', societeName });
  }
  const sendResult = {
    ok: callResult.ok && smsResult.ok,
    reason: [!callResult.ok ? `appel: ${callResult.reason}` : null, !smsResult.ok ? `sms: ${smsResult.reason}` : null]
      .filter(Boolean)
      .join(' | '),
  };

  const providerLabel = twilioConfigured && viaPhone ? 'TWILIO' : 'MOCK';
  const statut = sendResult.ok ? 'envoye' : 'echec';
  const detail = `[${providerLabel} ${canal}] Palier ${palier} — ticket ${ticketId} → ${recipient}${viaPhone ? ` (${agent.phone}, appel+sms)` : ''} (catégorie=${category || 'n/a'})${sendResult.ok ? '' : ` — ÉCHEC: ${sendResult.reason}`}`;
  console.log(`[NotificationService] ${detail}`);

  const row = {
    id,
    ticket_id: ticketId,
    agent_id: agentId || agent?.id || null,
    canal: canal || 'email',
    date_envoi: now,
    statut_envoi: statut,
    detail,
    palier,
  };

  if (useMock) {
    mockEscalades.push(row);
  } else if (pool) {
    try {
      await pool.query(
        `INSERT INTO escalade_notifications (id, ticket_id, agent_id, canal, date_envoi, statut_envoi, detail, palier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.ticket_id, row.agent_id, row.canal, row.date_envoi, row.statut_envoi, row.detail, row.palier]
      );
    } catch {
      await pool.query(
        `INSERT INTO escalade_notifications (id, ticket_id, agent_id, canal, date_envoi, statut_envoi, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.ticket_id, row.agent_id, row.canal, row.date_envoi, row.statut_envoi, row.detail]
      );
    }
  }
  return row;
}

/**
 * Palier 1 — alerte immédiate aux agents IT spécialisés dans la catégorie du ticket.
 * Journalise chaque envoi dans escalade_notifications.
 */
async function getStaffForEscalation(role, category) {
  if (role === 'SUPER_ADMIN') {
    if (useMock || !pool) return [];
    try {
      const [rows] = await pool.query(
        "SELECT id, name, email, phone FROM users WHERE role IN ('SUPER_ADMIN', 'admin')"
      );
      return rows;
    } catch {
      return [];
    }
  }
  const agents = await getItAgents();
  const matched = agents.filter((a) => agentMatchesCategory(a, category));
  return matched.length ? matched : agents;
}

app.post('/notify-urgent', authenticateToken, async (req, res) => {
  try {
    const {
      ticketId,
      category,
      canal = 'email',
      palier = 1,
      ticketTitle,
      societeId,
      targetRole = 'AGENT_IT',
      agentId,
    } = req.body;
    if (!ticketId) {
      return res.status(400).json({ message: 'ticketId requis' });
    }

    const societe = societeId ? await getSociete(societeId) : null;

    let recipients;
    if (agentId) {
      // Notifie UNIQUEMENT l'agent déjà auto-assigné (pas tous les spécialistes).
      const agents = await getItAgents();
      const one = agents.find((a) => a.id === agentId);
      recipients = one ? [one] : [];
    } else {
      recipients = await getStaffForEscalation(targetRole, category);
    }

    const results = [];
    for (const agent of recipients) {
      results.push(
        await sendUrgentAlert({
          ticketId,
          agentId: agent.id,
          agent,
          canal,
          category,
          palier,
          ticketTitle,
          societeName: societe?.nom,
        })
      );
    }

    res.json({ notified: results.length, palier, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

/**
 * Création self-service du contrat de maintenance par le CLIENT_ADMIN
 * d'une société qui n'en a pas encore. Bloquée si un contrat actif existe déjà.
 */
const DEFAULT_SLA_BY_TYPE = {
  '24/7': [
    { priorite: 'low', delai_reponse_minutes: 240, notification_immediate: 0 },
    { priorite: 'medium', delai_reponse_minutes: 120, notification_immediate: 0 },
    { priorite: 'high', delai_reponse_minutes: 60, notification_immediate: 1 },
    { priorite: 'urgent', delai_reponse_minutes: 15, notification_immediate: 1 },
  ],
  '8/5': [
    { priorite: 'low', delai_reponse_minutes: 480, notification_immediate: 0 },
    { priorite: 'medium', delai_reponse_minutes: 240, notification_immediate: 0 },
    { priorite: 'high', delai_reponse_minutes: 120, notification_immediate: 1 },
    { priorite: 'urgent', delai_reponse_minutes: 30, notification_immediate: 1 },
  ],
  '5/7': [
    { priorite: 'low', delai_reponse_minutes: 480, notification_immediate: 0 },
    { priorite: 'medium', delai_reponse_minutes: 240, notification_immediate: 0 },
    { priorite: 'high', delai_reponse_minutes: 120, notification_immediate: 1 },
    { priorite: 'urgent', delai_reponse_minutes: 30, notification_immediate: 1 },
  ],
};

app.post('/contrats', authenticateToken, async (req, res) => {
  try {
    const role = mapLegacyRole(req.user.role);
    if (role !== 'CLIENT_ADMIN') {
      return res.status(403).json({ message: 'Seul un administrateur de la société peut créer le contrat' });
    }
    const societeId = req.user.societeId;
    if (!societeId) {
      return res.status(400).json({ message: 'Aucune société associée à ce compte' });
    }

    const existing = await getActiveContractForSociete(societeId);
    if (existing) {
      return res.status(409).json({ message: 'Un contrat actif existe déjà pour votre société' });
    }

    const {
      type_contrat = '5/7',
      canal_notification_urgence = 'email',
      jours_ouvres,
      heures_ouvrees = '08:00-18:00',
      date_fin,
      conditions_texte,
    } = req.body;

    const contratId = `ctr_${societeId}_${Date.now()}`;
    const dateDebut = new Date().toISOString().slice(0, 10);
    const dateFin = date_fin || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
    const joursOuvres = jours_ouvres || (type_contrat === '24/7' ? 'lundi-dimanche' : 'lundi-vendredi');
    const conditions =
      conditions_texte ||
      `Contrat de maintenance ${type_contrat} (${joursOuvres} ${type_contrat === '24/7' ? '24h/24' : heures_ouvrees}). Créé en self-service par l'administrateur de la société.`;

    const regles = (DEFAULT_SLA_BY_TYPE[type_contrat] || DEFAULT_SLA_BY_TYPE['5/7']).map((r) => ({
      ...r,
      canal: r.notification_immediate ? canal_notification_urgence : 'email',
    }));

    if (useMock) {
      const contrat = {
        id: contratId,
        societe_id: societeId,
        type_contrat,
        canal_notification_urgence,
        jours_ouvres: joursOuvres,
        heures_ouvrees,
        date_debut: dateDebut,
        date_fin: dateFin,
        statut: 'actif',
        conditions_texte: conditions,
      };
      mockContrats.push(contrat);
      regles.forEach((r, i) =>
        mockSla.push({ id: `sla_${contratId}_${i}`, contrat_id: contratId, canal: r.canal, ...r })
      );
    } else {
      await pool.query(
        `INSERT INTO contrats_maintenance
         (id, societe_id, type_contrat, canal_notification_urgence, jours_ouvres, heures_ouvrees, date_debut, date_fin, statut, conditions_texte)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'actif', ?)`,
        [contratId, societeId, type_contrat, canal_notification_urgence, joursOuvres, heures_ouvrees, dateDebut, dateFin, conditions]
      );
      for (const [i, r] of regles.entries()) {
        await pool.query(
          `INSERT INTO sla_regles (id, contrat_id, priorite, delai_reponse_minutes, notification_immediate, canal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`sla_${contratId}_${i}`, contratId, r.priorite, r.delai_reponse_minutes, r.notification_immediate, r.canal]
        );
      }
    }

    const contrat = await getActiveContractForSociete(societeId);
    res.status(201).json({ contrat });
  } catch (err) {
    res.status(500).json({ message: 'Erreur création contrat', error: err.message });
  }
});

/**
 * Modification du contrat par le CLIENT_ADMIN de la société propriétaire.
 */
app.put('/contrats/:id', authenticateToken, async (req, res) => {
  try {
    const role = mapLegacyRole(req.user.role);
    if (role !== 'CLIENT_ADMIN') {
      return res.status(403).json({ message: 'Seul un administrateur de la société peut modifier le contrat' });
    }

    const contratId = req.params.id;
    const current = useMock
      ? mockContrats.find((c) => c.id === contratId)
      : (await pool.query('SELECT * FROM contrats_maintenance WHERE id = ?', [contratId]))[0][0];

    if (!current) return res.status(404).json({ message: 'Contrat introuvable' });
    if (current.societe_id !== req.user.societeId) {
      return res.status(403).json({ message: 'Ce contrat n’appartient pas à votre société' });
    }

    const {
      type_contrat = current.type_contrat,
      canal_notification_urgence = current.canal_notification_urgence,
      jours_ouvres = current.jours_ouvres,
      heures_ouvrees = current.heures_ouvrees,
      date_fin = current.date_fin,
      conditions_texte = current.conditions_texte,
    } = req.body;

    if (useMock) {
      Object.assign(current, {
        type_contrat,
        canal_notification_urgence,
        jours_ouvres,
        heures_ouvrees,
        date_fin,
        conditions_texte,
      });
    } else {
      await pool.query(
        `UPDATE contrats_maintenance
         SET type_contrat = ?, canal_notification_urgence = ?, jours_ouvres = ?, heures_ouvrees = ?, date_fin = ?, conditions_texte = ?
         WHERE id = ?`,
        [type_contrat, canal_notification_urgence, jours_ouvres, heures_ouvrees, date_fin, conditions_texte, contratId]
      );
    }

    const contrat = await getActiveContractForSociete(req.user.societeId);
    res.json({ contrat });
  } catch (err) {
    res.status(500).json({ message: 'Erreur modification contrat', error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'contract-service', mock: useMock });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`[Contract Service] running on port ${PORT}`));
});
