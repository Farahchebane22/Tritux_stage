import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '../types';
import { apiService } from '../services/api';
import { currentUser as defaultUser, agentUser, adminUser, mockUsers } from '../data/mockData';
import {
  getKeycloak,
  getKeycloakToken,
  initKeycloak,
  isKeycloakEnabled,
  keycloakLogin,
  keycloakLogout,
  keycloakPasswordLogin,
  keycloakRefreshToken,
  decodeJwtPayload,
  mapKeycloakRoles,
} from '../auth/keycloak';
import { useContractStore } from './contract';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );
  const isLoggedIn = ref<boolean>(!!user.value);
  const authMode = ref<'legacy' | 'keycloak'>(
    isKeycloakEnabled() ? 'keycloak' : 'legacy'
  );

  const persistSession = (loggedUser: User, token?: string) => {
    user.value = loggedUser;
    isLoggedIn.value = true;
    authMode.value = 'legacy';
    localStorage.setItem('user', JSON.stringify(loggedUser));
    if (token) {
      localStorage.setItem('token', token);
    }
  };

  const setLocalSession = (loggedUser: User, token?: string) => {
    persistSession(loggedUser, token);
  };

  const bootstrapKeycloak = async () => {
    if (!isKeycloakEnabled()) return false;
    const ok = await initKeycloak();
    const kc = getKeycloak();
    if (!ok || !kc?.authenticated || !kc.token) return false;

    localStorage.setItem('token', kc.token);
    const role = mapKeycloakRoles(kc) as User['role'];
    const societeAttr = (kc.tokenParsed as any)?.societe_id;
    const societeId = Array.isArray(societeAttr) ? societeAttr[0] : societeAttr || null;

    try {
      const synced = await apiService.syncKeycloakUser({
        email: kc.tokenParsed?.email || kc.tokenParsed?.preferred_username || '',
        name: kc.tokenParsed?.name || '',
        role,
        societeId,
        keycloakId: kc.subject,
      });
      persistSession(synced.user, synced.token || kc.token);
    } catch {
      persistSession(
        {
          id: kc.subject || 'kc_user',
          email: kc.tokenParsed?.email || '',
          name: kc.tokenParsed?.name || 'Utilisateur',
          role,
          societeId,
          keycloakId: kc.subject,
          joinDate: new Date().toISOString().slice(0, 10),
        },
        kc.token
      );
    }
    authMode.value = 'keycloak';
    return true;
  };

  const loginWithKeycloak = async () => {
    await keycloakLogin();
  };

  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const stopTokenRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  const scheduleTokenRefresh = (refreshToken: string) => {
    stopTokenRefresh();
    refreshTimer = setInterval(async () => {
      try {
        const tokens = await keycloakRefreshToken(refreshToken);
        localStorage.setItem('token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        scheduleTokenRefresh(tokens.refresh_token);
      } catch (e) {
        console.warn('[auth] Session Keycloak expirée, déconnexion.', e);
        stopTokenRefresh();
        await logout();
      }
    }, 4 * 60 * 1000);
  };

  /**
   * Connexion via Keycloak (Direct Access Grant) — utilise notre propre
   * formulaire, mais l'authentification et le token sont 100% Keycloak.
   * C'est le SEUL mécanisme de connexion de l'application, conformément
   * au cahier des charges ("remplacer le JWT maison par Keycloak").
   */
  const loginKeycloakDirect = async (email: string, password: string) => {
    const tokens = await keycloakPasswordLogin(email, password);
    const payload = decodeJwtPayload(tokens.access_token);
    const role = mapKeycloakRoles({ realmAccess: { roles: payload.realm_access?.roles || [] } } as any) as User['role'];
    const societeAttr = payload.societe_id;
    const societeId = Array.isArray(societeAttr) ? societeAttr[0] : societeAttr || null;

    // IMPORTANT : stocker le token AVANT tout appel API, sinon l'intercepteur
    // axios n'a rien à attacher en Authorization (→ 401 "Token manquant").
    localStorage.setItem('token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);

    try {
      const synced = await apiService.syncKeycloakUser({
        email: payload.email || payload.preferred_username || email,
        name: payload.name || email,
        role,
        societeId,
        keycloakId: payload.sub,
      });
      user.value = synced.user;
    } catch (e) {
      console.warn('[auth] keycloak-sync a échoué, session basée sur le token brut.', e);
      user.value = {
        id: payload.sub,
        email: payload.email || email,
        name: payload.name || email,
        role,
        societeId,
        keycloakId: payload.sub,
        joinDate: new Date().toISOString().slice(0, 10),
      } as User;
    }

    isLoggedIn.value = true;
    authMode.value = 'keycloak';
    localStorage.setItem('user', JSON.stringify(user.value));
    scheduleTokenRefresh(tokens.refresh_token);
  };

  const login = async (email: string, role: 'user' | 'agent' | 'admin', password?: string) => {
    // Compatibilité : si Keycloak est actif, toute connexion passe par lui.
    if (isKeycloakEnabled()) {
      await loginKeycloakDirect(email, password || '');
      return;
    }
    try {
      const { user: loggedUser, token } = await apiService.login(email, role, password);
      authMode.value = 'legacy';
      persistSession(loggedUser, token);
    } catch (error) {
      console.warn('API connection failed, falling back to mock login.', error);
      let matchedUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!matchedUser) {
        if (role === 'agent') matchedUser = agentUser;
        else if (role === 'admin') matchedUser = adminUser;
        else matchedUser = defaultUser;
      }
      const finalUser =
        matchedUser.email.toLowerCase() === email.toLowerCase()
          ? { ...matchedUser }
          : { ...matchedUser, role };
      authMode.value = 'legacy';
      persistSession(finalUser);
    }
  };

  const logout = async () => {
    user.value = null;
    isLoggedIn.value = false;
    stopTokenRefresh();
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    useContractStore().clear();
    if (authMode.value === 'keycloak' && isKeycloakEnabled() && getKeycloak()?.authenticated) {
      await keycloakLogout();
    }
  };

  const refreshProfile = async () => {
    try {
      const fresh = await apiService.getCurrentUser();
      user.value = fresh;
      localStorage.setItem('user', JSON.stringify(fresh));
      return fresh;
    } catch (error) {
      console.warn('Unable to refresh profile', error);
      return user.value;
    }
  };

  const updateProfile = async (name: string, email: string, department: string) => {
    const { user: updated, token } = await apiService.updateProfile({ name, email, department });
    persistSession(updated, token);
    return updated;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await apiService.changePassword(currentPassword, newPassword);
  };

  const getAccessToken = () => getKeycloakToken() || localStorage.getItem('token') || undefined;

  /**
   * Reprend le rafraîchissement automatique du token après un rechargement de
   * page. Le setInterval précédent est perdu à chaque reload (mémoire du
   * store), donc sans ça le token Keycloak finit par expirer silencieusement
   * et toutes les requêtes API se mettent à échouer en 401 en cascade.
   */
  const resumeSessionIfNeeded = async () => {
    if (!isLoggedIn.value || authMode.value !== 'keycloak') return;
    const storedRefresh = localStorage.getItem('refresh_token');
    if (!storedRefresh) return;
    try {
      const tokens = await keycloakRefreshToken(storedRefresh);
      localStorage.setItem('token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      scheduleTokenRefresh(tokens.refresh_token);
    } catch (e) {
      console.warn('[auth] Reprise de session Keycloak impossible, déconnexion.', e);
      await logout();
    }
  };

  resumeSessionIfNeeded();

  return {
    user,
    isLoggedIn,
    authMode,
    login,
    loginWithKeycloak,
    bootstrapKeycloak,
    logout,
    refreshProfile,
    updateProfile,
    changePassword,
    getAccessToken,
    setLocalSession,
    loginKeycloakDirect,
  };
});
