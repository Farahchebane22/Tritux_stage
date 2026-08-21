/**
 * Client minimal pour l'API Admin de Keycloak, utilisé pour provisionner
 * automatiquement les comptes créés en self-service (inscription société)
 * directement dans l'annuaire Keycloak — Keycloak reste la seule source
 * de vérité pour l'authentification (conforme au cahier des charges).
 *
 * S'appuie sur le client confidentiel "tritux-backend" (service account)
 * déjà défini dans keycloak/realm-tritux-helpdesk.json.
 */

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || 'http://localhost:8081').replace(/\/$/, '');
const REALM = process.env.KEYCLOAK_REALM || 'tritux-helpdesk';
const ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'tritux-backend';
const ADMIN_CLIENT_SECRET = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || 'tritux-backend-secret';

async function getAdminToken() {
  const res = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ADMIN_CLIENT_ID,
      client_secret: ADMIN_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Impossible d'obtenir un token admin Keycloak (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function findRoleId(adminToken, roleName) {
  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${encodeURIComponent(roleName)}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Rôle Keycloak "${roleName}" introuvable (${res.status})`);
  return res.json();
}

/**
 * Crée un utilisateur dans Keycloak, lui assigne un rôle realm, et pose
 * l'attribut societe_id (utilisé par le protocol mapper du realm pour
 * l'inclure dans le token JWT). Retourne l'ID Keycloak (sub) créé.
 */
export async function createKeycloakUser({ email, firstName, lastName, password, realmRole, societeId }) {
  const adminToken = await getAdminToken();

  const createRes = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: email,
      email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      attributes: societeId ? { societe_id: [societeId] } : undefined,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '');
    throw new Error(`Création utilisateur Keycloak échouée (${createRes.status}): ${body}`);
  }

  const location = createRes.headers.get('location') || '';
  const keycloakId = location.split('/').pop();
  if (!keycloakId) throw new Error('Keycloak n\'a pas renvoyé l\'ID du nouvel utilisateur');

  const role = await findRoleId(adminToken, realmRole);
  const assignRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}/role-mappings/realm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    }
  );
  if (!assignRes.ok) {
    const body = await assignRes.text().catch(() => '');
    // Nettoyage : on supprime l'utilisateur Keycloak orphelin (sans rôle, sans
    // ligne locale) pour ne pas bloquer un futur essai avec le même email.
    await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users/${keycloakId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
    throw new Error(`Attribution du rôle Keycloak échouée (${assignRes.status}): ${body}`);
  }

  return keycloakId;
}
