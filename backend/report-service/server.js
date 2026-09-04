/**
 * report-service — Rapports périodiques par société + archivage.
 * Port 5004
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
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
const GATEWAY_PORT = process.env.GATEWAY_PORT || 5000;

/**
 * Détecte l'adresse IP locale (réseau Wi-Fi/LAN) de la machine, pour que le
 * lien du QR code soit joignable depuis un téléphone sur le même réseau
 * (localhost ne fonctionnerait que depuis la machine elle-même).
 * Peut être forcée via la variable d'environnement PUBLIC_BASE_URL.
 */
function getLanBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const VIRTUAL_NAME_PATTERN = /virtual|vethernet|docker|wsl|vmware|virtualbox|hyper-v|loopback|tailscale|zerotier|bluetooth|npcap/i;
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        candidates.push({ name, address: net.address });
      }
    }
  }
  // Priorité aux vraies interfaces Wi-Fi/Ethernet, on écarte les adaptateurs
  // virtuels (Docker, WSL, VPN...) qui ne sont pas joignables depuis un téléphone.
  const real = candidates.find((c) => !VIRTUAL_NAME_PATTERN.test(c.name));
  const chosen = real || candidates[0];
  if (!chosen) return `http://localhost:${GATEWAY_PORT}`;
  console.log(`[Report Service] URL publique QR détectée : http://${chosen.address}:${GATEWAY_PORT} (interface "${chosen.name}")`);
  if (candidates.length > 1) {
    console.log('[Report Service] Autres interfaces disponibles :', candidates.map(c => `${c.name}=${c.address}`).join(', '));
    console.log('[Report Service] Si le QR ne fonctionne pas, forcez la bonne adresse avec PUBLIC_BASE_URL=http://<votre-ip-wifi>:5000 avant de lancer le service.');
  }
  return `http://${chosen.address}:${GATEWAY_PORT}`;
}

app.use(cors());
app.use(express.json());

if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'tritux_user',
  password: process.env.DB_PASSWORD || 'tritux_password',
  database: process.env.DB_NAME || 'tritux_db',
  ssl: (process.env.DB_SSL === 'true' || (process.env.DB_HOST && process.env.DB_HOST.includes('azure')))
    ? { rejectUnauthorized: false }
    : undefined,
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
    try {
      await c.query('ALTER TABLE rapports_archives ADD COLUMN share_token VARCHAR(64) NULL');
    } catch {
      /* colonne déjà existante */
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

// Palette alignée sur la charte de la plateforme (même dégradé que les boutons/en-têtes de l'app)
const BLUE = '#1D4ED8';
const PURPLE = '#7C3AED';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const PANEL = '#F8FAFC';
const HEADER_H = 108;
const PAGE_BOTTOM = 760;

/** Dessine le logo vectoriel Tritux (losange à facettes) en (x, y). */
function drawLogo(doc, x, y, scale = 1) {
  const s = scale;
  doc.save();
  doc.translate(x, y);
  doc.polygon([13 * s, 0], [26 * s, 13 * s], [13 * s, 26 * s], [0, 13 * s]).fill('#FFFFFF');
  doc.polygon([13 * s, 0], [26 * s, 13 * s], [13 * s, 13 * s]).fillOpacity(0.55).fill('#DBEAFE');
  doc.fillOpacity(1);
  doc.restore();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16 * s).text('TRITUX', x + 34 * s, y + 2 * s);
  doc.fillColor('#DBEAFE').font('Helvetica').fontSize(7 * s).text('G R O U P E', x + 34 * s, y + 19 * s, { characterSpacing: 1.1 });
}

/** Bandeau dégradé bleu → violet, identique sur chaque page (plus haut + logo/QR sur la 1ère). */
function drawHeader(doc, { first, reportId, qrBuffer }) {
  const h = first ? HEADER_H : 46;
  const grad = doc.linearGradient(0, 0, doc.page.width, 0);
  grad.stop(0, BLUE).stop(1, PURPLE);
  doc.rect(0, 0, doc.page.width, h).fill(grad);

  if (first) {
    drawLogo(doc, 50, 30, 1);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11.5).text('RAPPORT DE MAINTENANCE', 50, 72, { characterSpacing: 0.5 });
    doc.fillColor('#E0E7FF').font('Helvetica').fontSize(8).text(`Édité le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 50, 87);

    if (qrBuffer) {
      const qrSize = 78;
      const qrX = 545 - qrSize;
      const qrY = (h - qrSize) / 2;
      doc.roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 6).fill('#FFFFFF');
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      doc.fillColor('#FFFFFF').font('Helvetica').fontSize(6).text('Scanner pour ouvrir le PDF', qrX - 10, qrY + qrSize + 8, { width: qrSize + 20, align: 'center' });
    }
  } else {
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('TRITUX GROUPE', 50, 16);
    doc.fillColor('#E0E7FF').font('Helvetica').fontSize(8).text(`Réf. ${reportId}`, 300, 16, { width: 245, align: 'right' });
  }
  doc.y = h + 24;
}

function addFooter(doc, pageLabel) {
  const bottom = doc.page.height - 40;
  doc.save();
  doc.moveTo(50, bottom).lineTo(545, bottom).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8');
  doc.text('Tritux Groupe - Plateforme de maintenance IT - Document confidentiel', 50, bottom + 6, { width: 300 });
  doc.text(pageLabel, 50, bottom + 6, { width: 495, align: 'right' });
  doc.restore();
}

/** Vérifie l'espace restant ; change de page si nécessaire (évite les titres orphelins). */
function ensureSpace(doc, needed, ctx) {
  if (doc.y + needed > PAGE_BOTTOM) {
    doc.addPage();
    drawHeader(doc, ctx);
  }
}

async function buildPdfDocument(filePath, { societeId, societeNom, debut, fin, stats, tickets, chatLogs, reportId, publicUrl }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, autoFirstPage: false });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const qrDataUrl = await QRCode.toDataURL(publicUrl, {
        margin: 2,
        width: 300,
        errorCorrectionLevel: 'M',
        color: { dark: '#1E1B4B', light: '#FFFFFF' },
      });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      const ctx = { first: false, reportId, qrBuffer };

      doc.addPage();
      drawHeader(doc, { first: true, reportId, qrBuffer });

      // ===== Bloc société =====
      doc.roundedRect(50, doc.y, 495, 50, 8).fillAndStroke(PANEL, LINE);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(societeNom || societeId, 65, doc.y + 11);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(
        `Période couverte : ${new Date(debut).toLocaleDateString('fr-FR')} au ${new Date(fin).toLocaleDateString('fr-FR')}`,
        65, doc.y + 29
      );
      doc.y += 66;

      // ===== Cartes de synthèse =====
      const cardY = doc.y;
      const cards = [
        ['TICKETS TOTAL', stats.ticketsTotal, INK],
        ['RÉSOLUS', stats.ticketsResolus, '#059669'],
        ['OUVERTS', stats.ticketsOuverts, '#D97706'],
        ['RESPECT SLA', stats.tauxRespectSla != null ? `${Math.round(stats.tauxRespectSla * 100)}%` : 'N/A', BLUE],
      ];
      const cardW = (495 - 3 * 10) / 4;
      cards.forEach(([label, value, color], i) => {
        const x = 50 + i * (cardW + 10);
        doc.roundedRect(x, cardY, cardW, 58, 8).fillAndStroke('#FFFFFF', LINE);
        doc.rect(x, cardY, cardW, 3).fill(color);
        doc.fillColor(color).font('Helvetica-Bold').fontSize(19).text(String(value), x + 10, cardY + 14, { width: cardW - 16 });
        doc.fillColor('#94A3B8').font('Helvetica-Bold').fontSize(6.5).text(label, x + 10, cardY + 38, { width: cardW - 16, characterSpacing: 0.3 });
      });
      doc.y = cardY + 72;

      doc.fontSize(8.5).fillColor(MUTED).font('Helvetica').text(
        `Temps moyen de résolution : ${stats.tempsMoyenResolutionHeures ?? 'N/A'} h    -    Interactions assistant IA : ${stats.chatbotInteractions}`,
        50, doc.y
      );
      doc.y += 22;

      // ===== Historique des tickets =====
      ensureSpace(doc, 60, ctx);
      doc.font('Helvetica-Bold').fontSize(12.5).fillColor(INK).text('Historique des tickets', 50, doc.y);
      doc.moveTo(50, doc.y + 4).lineTo(140, doc.y + 4).lineWidth(2).strokeColor(PURPLE).stroke();
      doc.y += 18;

      if (!tickets.length) {
        doc.fontSize(9).font('Helvetica').fillColor('#94A3B8').text('Aucun ticket sur cette période.', 50, doc.y);
        doc.y += 16;
      } else {
        const colX = { id: 58, title: 118, prio: 308, status: 378, date: 452 };
        ensureSpace(doc, 26, ctx);
        const headerY = doc.y;
        doc.roundedRect(50, headerY, 495, 20, 4).fill(INK);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#E2E8F0');
        doc.text('ID', colX.id, headerY + 6, { width: 55 });
        doc.text('TITRE', colX.title, headerY + 6, { width: 185 });
        doc.text('PRIORITÉ', colX.prio, headerY + 6, { width: 65 });
        doc.text('STATUT', colX.status, headerY + 6, { width: 65 });
        doc.text('DATE', colX.date, headerY + 6, { width: 90 });
        doc.y = headerY + 24;

        tickets.forEach((t, idx) => {
          ensureSpace(doc, 20, ctx);
          const rowY = doc.y;
          if (idx % 2 === 0) doc.rect(50, rowY - 2, 495, 19).fill('#F1F5F9');
          doc.fillColor(INK).font('Helvetica').fontSize(8);
          doc.text(t.id, colX.id, rowY + 2, { width: 55 });
          doc.text((t.title || '').slice(0, 34), colX.title, rowY + 2, { width: 185 });
          doc.fillColor(
            { urgent: '#DC2626', high: '#EA580C', medium: '#B45309', low: '#65A30D' }[t.priority] || MUTED
          ).font('Helvetica-Bold').text(PRIORITY_LABELS[t.priority] || t.priority, colX.prio, rowY + 2, { width: 65 });
          doc.fillColor(INK).font('Helvetica').text(STATUS_LABELS[t.status] || t.status, colX.status, rowY + 2, { width: 65 });
          doc.fillColor(MUTED).text(new Date(t.created_at).toLocaleDateString('fr-FR'), colX.date, rowY + 2, { width: 90 });
          doc.y = rowY + 19;
        });
      }

      doc.y += 16;

      // ===== Historique chatbot =====
      ensureSpace(doc, 60, ctx);
      doc.font('Helvetica-Bold').fontSize(12.5).fillColor(INK).text('Échanges avec l’assistant IA', 50, doc.y);
      doc.moveTo(50, doc.y + 4).lineTo(140, doc.y + 4).lineWidth(2).strokeColor(PURPLE).stroke();
      doc.y += 18;

      if (!chatLogs.length) {
        doc.fontSize(9).font('Helvetica').fillColor('#94A3B8').text('Aucun échange avec le chatbot enregistré sur cette période.', 50, doc.y);
      } else {
        chatLogs.forEach((m) => {
          const isUser = m.role === 'user';
          const textHeight = doc.heightOfString(m.content, { width: 480 });
          ensureSpace(doc, textHeight + 34, ctx);

          doc.roundedRect(50, doc.y, 4, textHeight + 24, 2).fill(isUser ? BLUE : PURPLE);
          doc.fillColor(isUser ? BLUE : PURPLE).font('Helvetica-Bold').fontSize(8)
            .text(`${isUser ? (m.user_name || 'Utilisateur') : 'Assistant IA Tritux'}   ${new Date(m.created_at).toLocaleString('fr-FR')}`, 62, doc.y);
          doc.fontSize(9).font('Helvetica').fillColor('#334155').text(m.content, 62, doc.y + 13, { width: 480 });
          doc.y += textHeight + 24;
        });
      }

      // ===== Pagination =====
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        addFooter(doc, `Page ${i + 1} / ${range.count}`);
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (e) {
      reject(e);
    }
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
      const shareToken = crypto.randomBytes(20).toString('hex');
      const now = new Date().toISOString();
      const fileName = `${id}.pdf`;
      const filePath = path.join(EXPORT_DIR, fileName);
      const publicUrl = `${getLanBaseUrl()}/api/reports/public/${shareToken}`;

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
        reportId: id,
        publicUrl,
      });

      const archive = {
        id,
        societe_id: societeId,
        periode_debut: periodeDebut,
        periode_fin: periodeFin,
        date_generation: now,
        contenu_resume: stats,
        export_pdf_path: filePath,
        share_token: shareToken,
      };

      if (useMock) {
        mockArchives.unshift(archive);
      } else {
        await pool.query(
          `INSERT INTO rapports_archives
           (id, societe_id, periode_debut, periode_fin, date_generation, contenu_resume, export_pdf_path, share_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            societeId,
            periodeDebut,
            periodeFin,
            now,
            JSON.stringify(stats),
            filePath,
            shareToken,
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
        publicUrl,
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
 * Téléchargement PUBLIC (sans authentification) via le jeton secret encodé
 * dans le QR code du PDF. Permet d'ouvrir le rapport directement depuis un
 * téléphone qui scanne le code, sans avoir à se connecter à l'application.
 * Sécurité : jeton aléatoire 160 bits, non énumérable, propre à ce rapport.
 */
app.get('/public/:token', async (req, res) => {
  try {
    let archive;
    if (useMock) {
      archive = mockArchives.find((a) => a.share_token === req.params.token);
    } else {
      const [rows] = await pool.query('SELECT * FROM rapports_archives WHERE share_token = ?', [
        req.params.token,
      ]);
      archive = rows[0];
    }
    if (!archive) return res.status(404).send('Lien invalide ou expiré.');
    const p = archive.export_pdf_path;
    if (!p || !fs.existsSync(p)) return res.status(404).send('Fichier introuvable.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="rapport-${archive.societe_id}.pdf"`);
    fs.createReadStream(p).pipe(res);
  } catch (err) {
    res.status(500).send('Erreur serveur.');
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
    // req.user.keycloakId (si présent) identifie mieux l'utilisateur qu'un
    // UUID Keycloak brut comparé à rien d'utile ici — pas de contrainte FK
    // sur cette table, mais on garde une valeur cohérente pour les rapports.
    const userId = req.user.keycloakId || req.user.id;

    if (useMock) {
      mockChatLogs.push({
        id,
        societe_id: societeId,
        user_id: userId,
        user_name: req.user.name,
        role,
        content: String(content).slice(0, 4000),
        created_at: now,
      });
    } else {
      await pool.query(
        `INSERT INTO chatbot_logs (id, societe_id, user_id, user_name, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, societeId, userId, req.user.name, role, String(content).slice(0, 4000), now]
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
