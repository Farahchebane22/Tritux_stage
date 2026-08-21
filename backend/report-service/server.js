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
import PDFDocument from 'pdfkit';
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
    try {
      await c.query(`CREATE TABLE IF NOT EXISTS chatbot_logs (
        id VARCHAR(50) PRIMARY KEY,
        societe_id VARCHAR(50) NULL,
        user_id VARCHAR(50) NULL,
        user_name VARCHAR(100) NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at VARCHAR(50) NOT NULL
      )`);
    } catch (e) {
      console.warn('[Report Service] chatbot_logs table check failed:', e.message);
    }
    c.release();
    useMock = false;
    console.log('[Report Service] MySQL connected');
  } catch (e) {
    useMock = true;
    console.warn('[Report Service] mock mode:', e.message);
  }
}

const mockChatLogs = [];

function canAccessSociete(user, societeId) {
  const role = mapLegacyRole(user.role);
  if (role === 'SUPER_ADMIN' || role === 'AGENT_IT') return true;
  if (isClientRole(role)) return user.societeId === societeId;
  return false;
}

async function collectStats(societeId, debut, fin) {
  if (useMock) {
    const chatLogs = mockChatLogs.filter(
      (c) => c.societe_id === societeId && c.created_at >= debut && c.created_at <= fin + 'T23:59:59.999Z'
    );
    return {
      stats: {
        ticketsTotal: 12,
        ticketsResolus: 9,
        ticketsOuverts: 3,
        tempsMoyenResolutionHeures: 18.5,
        tauxRespectSla: 0.83,
        parPriorite: { urgent: 2, high: 3, medium: 5, low: 2 },
        parStatut: { open: 2, inprogress: 1, resolved: 7, closed: 2 },
        chatbotInteractions: chatLogs.length,
        note: 'Données de démonstration (mock)',
      },
      tickets: [],
      chatLogs,
    };
  }

  const [tickets] = await pool.query(
    `SELECT id, title, status, priority, category, created_by_name, created_at, updated_at, sla_deadline, sla_deferred
     FROM tickets
     WHERE societe_id = ? AND created_at >= ? AND created_at <= ?
     ORDER BY created_at DESC`,
    [societeId, debut, fin + 'T23:59:59.999Z']
  );

  let chatLogs = [];
  try {
    [chatLogs] = await pool.query(
      `SELECT * FROM chatbot_logs WHERE societe_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at ASC`,
      [societeId, debut, fin + 'T23:59:59.999Z']
    );
  } catch {
    chatLogs = [];
  }

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
    stats: {
      ticketsTotal: total,
      ticketsResolus: resolus.length,
      ticketsOuverts: total - resolus.length,
      tempsMoyenResolutionHeures:
        resolus.length ? Math.round((sumHours / resolus.length) * 10) / 10 : null,
      tauxRespectSla: resolus.length ? Math.round((respect / resolus.length) * 100) / 100 : null,
      parPriorite,
      parStatut,
      chatbotInteractions: chatLogs.length,
    },
    tickets,
    chatLogs,
  };
}

const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Haute', medium: 'Moyenne', low: 'Basse' };
const STATUS_LABELS = { open: 'Ouvert', inprogress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };

function buildPdfDocument(filePath, { societeId, societeNom, debut, fin, stats, tickets, chatLogs }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // --- En-tête ---
    doc.rect(0, 0, doc.page.width, 90).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('Tritux Groupe', 50, 30);
    doc.fontSize(10).font('Helvetica').fillColor('#94A3B8').text('Rapport de maintenance IT', 50, 55);
    doc.fontSize(10).fillColor('#CBD5E1').text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 50, 68);
    doc.fillColor('#000000');

    doc.moveDown(4);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text(societeNom || societeId);
    doc.fontSize(10).font('Helvetica').fillColor('#64748B').text(`Période : ${debut} → ${fin}`);
    doc.moveDown(1);

    // --- Cartes de synthèse ---
    const cardY = doc.y;
    const cards = [
      ['Tickets total', stats.ticketsTotal],
      ['Résolus', stats.ticketsResolus],
      ['Ouverts', stats.ticketsOuverts],
      ['Respect SLA', stats.tauxRespectSla != null ? `${Math.round(stats.tauxRespectSla * 100)}%` : 'N/A'],
    ];
    const cardW = (doc.page.width - 100 - 3 * 10) / 4;
    cards.forEach(([label, value], i) => {
      const x = 50 + i * (cardW + 10);
      doc.roundedRect(x, cardY, cardW, 55, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#1D4ED8').font('Helvetica-Bold').fontSize(18).text(String(value), x, cardY + 10, { width: cardW, align: 'center' });
      doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(label, x, cardY + 33, { width: cardW, align: 'center' });
    });
    doc.y = cardY + 70;
    doc.moveDown(1);

    doc.fontSize(9).fillColor('#475569').font('Helvetica').text(
      `Temps moyen de résolution : ${stats.tempsMoyenResolutionHeures ?? 'N/A'} h    |    Interactions chatbot : ${stats.chatbotInteractions}`
    );
    doc.moveDown(1.2);

    // --- Tableau tickets ---
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0F172A').text('Historique des tickets');
    doc.moveDown(0.4);

    if (!tickets.length) {
      doc.fontSize(9).font('Helvetica').fillColor('#94A3B8').text('Aucun ticket sur cette période.');
    } else {
      const colX = { id: 50, title: 110, prio: 300, status: 370, date: 440 };
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B');
      doc.text('ID', colX.id, doc.y, { continued: false });
      doc.text('Titre', colX.title, doc.y - 10);
      doc.text('Priorité', colX.prio, doc.y - 10);
      doc.text('Statut', colX.status, doc.y - 10);
      doc.text('Date', colX.date, doc.y - 10);
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').stroke();
      doc.moveDown(0.3);

      tickets.forEach((t) => {
        if (doc.y > 720) doc.addPage();
        const rowY = doc.y;
        doc.fontSize(8).font('Helvetica').fillColor('#0F172A');
        doc.text(t.id, colX.id, rowY, { width: 55 });
        doc.text((t.title || '').slice(0, 38), colX.title, rowY, { width: 185 });
        doc.text(PRIORITY_LABELS[t.priority] || t.priority, colX.prio, rowY, { width: 65 });
        doc.text(STATUS_LABELS[t.status] || t.status, colX.status, rowY, { width: 65 });
        doc.text(new Date(t.created_at).toLocaleDateString('fr-FR'), colX.date, rowY, { width: 90 });
        doc.moveDown(0.6);
      });
    }

    doc.moveDown(1);
    if (doc.y > 680) doc.addPage();

    // --- Historique chatbot ---
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0F172A').text('Historique des échanges avec l’assistant IA');
    doc.moveDown(0.4);

    if (!chatLogs.length) {
      doc.fontSize(9).font('Helvetica').fillColor('#94A3B8').text('Aucun échange avec le chatbot enregistré sur cette période.');
    } else {
      chatLogs.forEach((m) => {
        if (doc.y > 730) doc.addPage();
        const isUser = m.role === 'user';
        doc.fontSize(8).font('Helvetica-Bold').fillColor(isUser ? '#1D4ED8' : '#7C3AED')
          .text(`${isUser ? (m.user_name || 'Utilisateur') : 'Assistant IA'} — ${new Date(m.created_at).toLocaleString('fr-FR')}`);
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(m.content, { width: 495 });
        doc.moveDown(0.5);
      });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
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

      const { stats, tickets, chatLogs } = await collectStats(societeId, periodeDebut, periodeFin);
      const id = `rpt_${Date.now()}`;
      const now = new Date().toISOString();
      const fileName = `${id}.pdf`;
      const filePath = path.join(EXPORT_DIR, fileName);

      let societeNom = societeId;
      try {
        if (!useMock) {
          const [srows] = await pool.query('SELECT nom FROM societes WHERE id = ?', [societeId]);
          if (srows[0]) societeNom = srows[0].nom;
        }
      } catch { /* garde societeId par défaut */ }

      await buildPdfDocument(filePath, {
        societeId,
        societeNom,
        debut: periodeDebut,
        fin: periodeFin,
        stats,
        tickets,
        chatLogs,
      });

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

/**
 * Enregistre un message d'échange avec le chatbot (utilisateur ou assistant),
 * rattaché à la société de l'utilisateur connecté, pour inclusion dans les rapports.
 */
app.post('/chat-log', authenticateToken, async (req, res) => {
  try {
    const { role, content } = req.body;
    if (!role || !content) return res.status(400).json({ message: 'role et content requis' });

    const id = `chatlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const societeId = req.user.societeId || null;

    if (useMock) {
      mockChatLogs.push({
        id,
        societe_id: societeId,
        user_id: req.user.id,
        user_name: req.user.name,
        role,
        content: String(content).slice(0, 4000),
        created_at: now,
      });
    } else {
      await pool.query(
        `INSERT INTO chatbot_logs (id, societe_id, user_id, user_name, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, societeId, req.user.id, req.user.name, role, String(content).slice(0, 4000), now]
      );
    }
    res.status(201).json({ ok: true });
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
