/**
 * Auth middleware partagé : Keycloak JWT (prioritaire) + JWT legacy Tritux (fallback).
 * Utilisé par user-service, ticket-service, contract-service, report-service.
 */
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const JWT_SECRET = process.env.JWT_SECRET || 'tritux_secret_key_12345';
const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || 'http://localhost:8081').replace(/\/$/, '');
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'tritux-helpdesk';
const KEYCLOAK_ENABLED = process.env.KEYCLOAK_ENABLED !== 'false';

const ROLE_MAP = {
  'super-admin': 'SUPER_ADMIN',
  'agent-it': 'AGENT_IT',
  'client-admin': 'CLIENT_ADMIN',
  'client-user': 'CLIENT_USER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  AGENT_IT: 'AGENT_IT',
  CLIENT_ADMIN: 'CLIENT_ADMIN',
  CLIENT_USER: 'CLIENT_USER',
  // legacy
  admin: 'SUPER_ADMIN',
  agent: 'AGENT_IT',
  user: 'CLIENT_USER',
};

let jwks = null;

function getJwks() {
  if (!jwks) {
    jwks = jwksClient({
      jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
      cache: true,
      rateLimit: true,
      timeout: 10000,
    });
  }
  return jwks;
}

function getKey(header, callback) {
  getJwks().getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function normalizeRole(rawRoles = []) {
  const list = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  for (const r of list) {
    if (ROLE_MAP[r]) return ROLE_MAP[r];
  }
  return 'CLIENT_USER';
}

function extractRealmRoles(payload) {
  const realm = payload?.realm_access?.roles || [];
  const resource = Object.values(payload?.resource_access || {}).flatMap((x) => x.roles || []);
  return [...realm, ...resource];
}

function toUser(payload, source) {
  const roles = extractRealmRoles(payload);
  const role = normalizeRole(roles.length ? roles : [payload.role]);
  const societeId =
    payload.societe_id ||
    payload.societeId ||
    (Array.isArray(payload.societe_id) ? payload.societe_id[0] : null) ||
    null;

  return {
    id: payload.sub || payload.id,
    email: payload.email || payload.preferred_username,
    name:
      payload.name ||
      [payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
      payload.preferred_username ||
      'Utilisateur',
    role,
    societeId: societeId || null,
    keycloakId: source === 'keycloak' ? payload.sub : payload.keycloak_id || null,
    authSource: source,
    raw: payload,
  };
}

export function mapLegacyRole(role) {
  return ROLE_MAP[role] || role;
}

export function isInternalStaff(role) {
  const r = mapLegacyRole(role);
  return r === 'SUPER_ADMIN' || r === 'AGENT_IT';
}

export function isClientRole(role) {
  const r = mapLegacyRole(role);
  return r === 'CLIENT_ADMIN' || r === 'CLIENT_USER';
}

/**
 * Express middleware — tries Keycloak first, then legacy HS256 JWT.
 */
export function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  const tryLegacy = () => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: mapLegacyRole(decoded.role),
        societeId: decoded.societeId || decoded.societe_id || null,
        keycloakId: decoded.keycloakId || null,
        authSource: 'legacy',
      };
      return next();
    } catch {
      return res.status(401).json({ message: 'Token invalide ou expiré' });
    }
  };

  if (!KEYCLOAK_ENABLED) {
    return tryLegacy();
  }

  // Heuristic: Keycloak tokens are RS256; legacy are HS256
  let headerJson;
  try {
    headerJson = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
  } catch {
    return tryLegacy();
  }

  if (headerJson.alg !== 'RS256') {
    return tryLegacy();
  }

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ['RS256'],
      issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
    },
    (err, decoded) => {
      if (err) {
        // Keycloak down or misconfigured → try legacy for local demo continuity
        console.warn('[auth] Keycloak verify failed, trying legacy:', err.message);
        return tryLegacy();
      }
      req.user = toUser(decoded, 'keycloak');
      return next();
    }
  );
}

export function requireRoles(...roles) {
  const allowed = roles.map(mapLegacyRole);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Non authentifié' });
    const role = mapLegacyRole(req.user.role);
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    next();
  };
}

export { JWT_SECRET, KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_ENABLED };
