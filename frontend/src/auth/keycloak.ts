import Keycloak from 'keycloak-js';

const enabled = import.meta.env.VITE_KEYCLOAK_ENABLED === 'true';

const keycloak = enabled
  ? new Keycloak({
      url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081',
      realm: import.meta.env.VITE_KEYCLOAK_REALM || 'tritux-helpdesk',
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'tritux-frontend',
    })
  : null;

let initPromise: Promise<boolean> | null = null;

export function isKeycloakEnabled() {
  return enabled && !!keycloak;
}

export function getKeycloak() {
  return keycloak;
}

export async function initKeycloak(): Promise<boolean> {
  if (!keycloak) return false;
  if (initPromise) return initPromise;
  initPromise = keycloak
    .init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    })
    .catch((err) => {
      console.warn('[Keycloak] init failed', err);
      return false;
    });
  return initPromise;
}

export async function keycloakLogin() {
  if (!keycloak) return;
  await keycloak.login({ redirectUri: window.location.origin + '/' });
}

const KEYCLOAK_BASE_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081';
const KEYCLOAK_REALM_NAME = import.meta.env.VITE_KEYCLOAK_REALM || 'tritux-helpdesk';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'tritux-frontend';

export interface DirectGrantTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Connexion Keycloak "Direct Access Grant" (Resource Owner Password Credentials) :
 * permet de garder notre propre formulaire de connexion (email/mot de passe)
 * tout en authentifiant réellement via Keycloak, sans redirection de page.
 * Nécessite que le client "tritux-frontend" ait directAccessGrantsEnabled=true
 * (déjà le cas dans keycloak/realm-tritux-helpdesk.json).
 */
export async function keycloakPasswordLogin(username: string, password: string): Promise<DirectGrantTokens> {
  const res = await fetch(`${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM_NAME}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: KEYCLOAK_CLIENT_ID,
      username,
      password,
    }),
  });
  if (!res.ok) {
    const err: any = new Error('Identifiants invalides');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function keycloakRefreshToken(refreshToken: string): Promise<DirectGrantTokens> {
  const res = await fetch(`${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM_NAME}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: KEYCLOAK_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error('Rafraîchissement de session Keycloak échoué');
  return res.json();
}

export function decodeJwtPayload(token: string): any {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export async function keycloakLogout() {
  if (!keycloak) return;
  await keycloak.logout({ redirectUri: window.location.origin + '/welcome' });
}

export function getKeycloakToken(): string | undefined {
  return keycloak?.token;
}

export function mapKeycloakRoles(kc: Keycloak): string {
  const roles = kc.realmAccess?.roles || [];
  if (roles.includes('super-admin')) return 'SUPER_ADMIN';
  if (roles.includes('agent-it')) return 'AGENT_IT';
  if (roles.includes('client-admin')) return 'CLIENT_ADMIN';
  return 'CLIENT_USER';
}
