/**
 * report-service — Rapports périodiques par société + archivage.
 * Port 5004
 */
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  authenticateToken,
  requireRoles,
  mapLegacyRole,
  isClientRole,
} from '../shared/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5004;
const EXPORT_DIR = path.join(__dirname, 'exports');

app.use(cors());
app.use(express.json());

if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'tritux_user',
  password: process.env.DB_PASSWORD || 'tritux_password',
  database: process.env.DB_NAME || 'tritux_db',
};

let pool = null;
let useMock = true;
const mockArchives = [];

async function initDb() {
  try {
    pool = mysql.createPool(dbConfig);
    const c = await pool.getConnection();
    c.release();
    useMock = false;
    console.log('[Report Service] MySQL connected');
  } catch (e) {
    useMock = true;
    console.warn('[Report Service] mock mode:', e.message);
  }
}

function canAccessSociete(user, societeId) {
  const role = mapLegacyRole(user.role);
  if (role === 'SUPER_ADMIN' || role === 'AGENT_IT') return true;
  if (isClientRole(role)) return user.societeId === societeId;
  return false;
}

async function collectStats(societeId, debut, fin) {
  if (useMock) {
    return {
      ticketsTotal: 12,
      ticketsResolus: 9,
      ticketsOuverts: 3,
      tempsMoyenResolutionHeures: 18.5,
      tauxRespectSla: 0.83,
      parPriorite: { urgent: 2, high: 3, medium: 5, low: 2 },
      parStatut: { open: 2, inprogress: 1, resolved: 7, closed: 2 },
      chatbotInteractions: 4,
      note: 'Données de démonstration (mock)',
    };
  }

  const [tickets] = await pool.query(
    `SELECT id, status, priority, created_at, updated_at, sla_deadline, sla_deferred
     FROM tickets
     WHERE societe_id = ? AND created_at >= ? AND created_at <= ?`,
    [societeId, debut, fin]
  );

  const total = tickets.length;
  const resolus = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
  let respect = 0;
  let sumHours = 0;
  for (const t of resolus) {
    const created = new Date(t.created_at).getTime();
    const updated = new Date(t.updated_at).getTime();
    sumHours += (updated - created) / 3600000;
    if (t.sla_deadline) {
      if (updated <= new Date(t.sla_deadline).getTime()) respect += 1;
    } else {
      respect += 1;
    }
  }

  const parPriorite = { urgent: 0, high: 0, medium: 0, low: 0 };
  const parStatut = { open: 0, inprogress: 0, resolved: 0, closed: 0 };
  for (const t of tickets) {
    if (parPriorite[t.priority] != null) parPriorite[t.priority] += 1;
    if (parStatut[t.status] != null) parStatut[t.status] += 1;
  }

  return {
    ticketsTotal: total,
    ticketsResolus: resolus.length,
    ticketsOuverts: total - resolus.length,
    tempsMoyenResolutionHeures:
      resolus.length ? Math.round((sumHours / resolus.length) * 10) / 10 : null,
    tauxRespectSla: resolus.length ? Math.round((respect / resolus.length) * 100) / 100 : null,
    parPriorite,
    parStatut,
    chatbotInteractions: null,
  };
}

function buildPdfLikeText(societeId, debut, fin, stats) {
  return [
    '=== RAPPORT MAINTENANCE TRITUX ===',
    `Société: ${societeId}`,
    `Période: ${debut} → ${fin}`,
    `Généré: ${new Date().toISOString()}`,
    '',
    `Tickets total: ${stats.ticketsTotal}`,
    `Résolus: ${stats.ticketsResolus}`,
    `Ouverts: ${stats.ticketsOuverts}`,
    `Temps moyen résolution (h): ${stats.tempsMoyenResolutionHeures ?? 'N/A'}`,
    `Taux respect SLA: ${stats.tauxRespectSla != null ? Math.round(stats.tauxRespectSla * 100) + '%' : 'N/A'}`,
    '',
    'Par priorité: ' + JSON.stringify(stats.parPriorite),
    'Par statut: ' + JSON.stringify(stats.parStatut),
    '',
    '(Export texte — remplacer par PDF réel / puppeteer en production)',
  ].join('\n');
}

app.post(
  '/generate',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'AGENT_IT', 'CLIENT_ADMIN', 'admin', 'agent'),
  async (req, res) => {
    try {
      const { societeId, periodeDebut, periodeFin } = req.body;
      if (!societeId || !periodeDebut || !periodeFin) {
        return res.status(400).json({ message: 'societeId, periodeDebut, periodeFin requis' });
      }
      if (!canAccessSociete(req.user, societeId)) {
        return res.status(403).json({ message: 'Accès refusé à cette société' });
      }

      const stats = await collectStats(societeId, periodeDebut, periodeFin);
      const id = `rpt_${Date.now()}`;
      const now = new Date().toISOString();
      const fileName = `${id}.txt`;
      const filePath = path.join(EXPORT_DIR, fileName);
      fs.writeFileSync(filePath, buildPdfLikeText(societeId, periodeDebut, periodeFin, stats), 'utf8');

      const archive = {
        id,
        societe_id: societeId,
        periode_debut: periodeDebut,
        periode_fin: periodeFin,
        date_generation: now,
        contenu_resume: stats,
        export_pdf_path: filePath,
      };

      if (useMock) {
        mockArchives.unshift(archive);
      } else {
        await pool.query(
          `INSERT INTO rapports_archives
           (id, societe_id, periode_debut, periode_fin, date_generation, contenu_resume, export_pdf_path)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            societeId,
            periodeDebut,
            periodeFin,
            now,
            JSON.stringify(stats),
            filePath,
          ]
        );
      }

      res.json({
        id,
        societeId,
        periodeDebut,
        periodeFin,
        dateGeneration: now,
        resume: stats,
        downloadPath: `/api/reports/${id}/download`,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

app.get(
  '/',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'AGENT_IT', 'CLIENT_ADMIN', 'admin', 'agent'),
  async (req, res) => {
    try {
      const societeId = req.query.societeId;
      if (useMock) {
        let list = mockArchives;
        if (societeId) list = list.filter((a) => a.societe_id === societeId);
        if (isClientRole(req.user.role)) {
          list = list.filter((a) => a.societe_id === req.user.societeId);
        }
        return res.json(list);
      }
      let sql = 'SELECT * FROM rapports_archives';
      const params = [];
      if (isClientRole(req.user.role)) {
        sql += ' WHERE societe_id = ?';
        params.push(req.user.societeId);
      } else if (societeId) {
        sql += ' WHERE societe_id = ?';
        params.push(societeId);
      }
      sql += ' ORDER BY date_generation DESC';
      const [rows] = await pool.query(sql, params);
      res.json(
        rows.map((r) => ({
          ...r,
          contenu_resume:
            typeof r.contenu_resume === 'string'
              ? JSON.parse(r.contenu_resume)
              : r.contenu_resume,
        }))
      );
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

app.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    let archive;
    if (useMock) {
      archive = mockArchives.find((a) => a.id === req.params.id);
    } else {
      const [rows] = await pool.query('SELECT * FROM rapports_archives WHERE id = ?', [
        req.params.id,
      ]);
      archive = rows[0];
    }
    if (!archive) return res.status(404).json({ message: 'Rapport introuvable' });
    if (!canAccessSociete(req.user, archive.societe_id)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const p = archive.export_pdf_path;
    if (!p || !fs.existsSync(p)) {
      return res.status(404).json({ message: 'Fichier export introuvable' });
    }
    res.download(p);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'UP', service: 'report-service', mock: useMock });
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`[Report Service] running on port ${PORT}`));
});
