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
