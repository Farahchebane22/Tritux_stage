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
    localStorage.setItem('user', JSON.stringify(loggedUser));
    if (token) {
      localStorage.setItem('token', token);
    }
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

  const login = async (email: string, role: 'user' | 'agent' | 'admin', password?: string) => {
    if (isKeycloakEnabled()) {
      await loginWithKeycloak();
      return;
    }
    try {
      const { user: loggedUser, token } = await apiService.login(email, role, password);
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
      persistSession(finalUser);
    }
  };

  const logout = async () => {
    user.value = null;
    isLoggedIn.value = false;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    useContractStore().clear();
    if (authMode.value === 'keycloak' && isKeycloakEnabled()) {
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
  };
});
