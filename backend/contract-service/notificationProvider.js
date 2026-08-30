/**
 * Fournisseur RÉEL de notifications d'urgence (appel téléphonique / SMS) via
 * Twilio. Remplace le mock console.log pour les alertes urgentes.
 *
 * Configuration requise (fichier .env de contract-service) :
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
 *
 * Si ces variables ne sont pas définies, le module retombe automatiquement
 * en mode mock (log console) — jamais de crash silencieux en dev.
 *
 * ⚠️ Compte Twilio d'essai (trial) : seuls les numéros vérifiés dans la
 * console Twilio (Phone Numbers → Verified Caller IDs) peuvent être appelés.
 */

import twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const isConfigured = !!(ACCOUNT_SID && AUTH_TOKEN && FROM_NUMBER);
const client = isConfigured ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

if (!isConfigured) {
  console.warn(
    '[NotificationProvider] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER ' +
    'non configurés — retour au mode mock (aucun appel/SMS réel ne sera envoyé).'
  );
} else {
  console.log('[NotificationProvider] Twilio configuré — appels/SMS réels activés.');
}

/**
 * Normalise un numéro tunisien local (ex: "22 123 456" ou "22123456") au
 * format E.164 attendu par Twilio (+21622123456). Si le numéro commence déjà
 * par "+", il est laissé tel quel.
 */
function toE164(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/[\s-]/g, '');
  const digits = trimmed.replace(/[\s-]/g, '');
  if (digits.length === 8) return `+216${digits}`; // format local TN par défaut
  return `+${digits}`;
}

/**
 * Passe un vrai appel téléphonique via Twilio, avec un message vocal
 * (text-to-speech) annonçant l'urgence.
 */
export async function placeUrgentCall({ toPhone, ticketId, ticketTitle, societeName }) {
  const to = toE164(toPhone);
  if (!to) return { ok: false, reason: 'Numéro de téléphone manquant' };
  if (!isConfigured) {
    console.log(`[MOCK CALL] Appel à ${to} — ticket ${ticketId} (${societeName})`);
    return { ok: true, mock: true };
  }

  const message = `Alerte Tritux. Un ticket urgent a été créé pour ${societeName || 'un client'}. ` +
    `Référence ${ticketId.split('').join(' ')}. Sujet : ${ticketTitle}. ` +
    `Merci de vous connecter à la plateforme pour intervenir immédiatement.`;

  try {
    const call = await client.calls.create({
      to,
      from: FROM_NUMBER,
      twiml: `<Response><Say language="fr-FR" voice="Polly.Celine">${escapeXml(message)}</Say></Response>`,
    });
    console.log(`[Twilio] Appel initié vers ${to} — SID ${call.sid}`);
    return { ok: true, sid: call.sid };
  } catch (err) {
    console.error(`[Twilio] Échec de l'appel vers ${to}:`, err.message);
    return { ok: false, reason: err.message };
  }
}

/**
 * Envoie un vrai SMS via Twilio.
 */
export async function sendUrgentSms({ toPhone, ticketId, ticketTitle, societeName }) {
  const to = toE164(toPhone);
  if (!to) return { ok: false, reason: 'Numéro de téléphone manquant' };
  if (!isConfigured) {
    console.log(`[MOCK SMS] SMS à ${to} — ticket ${ticketId} (${societeName})`);
    return { ok: true, mock: true };
  }

  const body = `Tritux — Ticket urgent ${ticketId} (${societeName || ''}) : ${ticketTitle}. Connectez-vous pour intervenir.`;

  try {
    const sms = await client.messages.create({ to, from: FROM_NUMBER, body });
    console.log(`[Twilio] SMS envoyé à ${to} — SID ${sms.sid}`);
    return { ok: true, sid: sms.sid };
  } catch (err) {
    console.error(`[Twilio] Échec de l'envoi SMS à ${to}:`, err.message);
    return { ok: false, reason: err.message };
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const twilioConfigured = isConfigured;
