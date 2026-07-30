import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '../types';
import { apiService } from '../services/api';
import { currentUser as defaultUser, agentUser, adminUser, mockUsers } from '../data/mockData';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );
  const isLoggedIn = ref<boolean>(!!user.value);

  const persistSession = (loggedUser: User, token?: string) => {
    user.value = loggedUser;
    isLoggedIn.value = true;
    localStorage.setItem('user', JSON.stringify(loggedUser));
    if (token) {
      localStorage.setItem('token', token);
    }
  };

  const login = async (email: string, role: 'user' | 'agent' | 'admin', password?: string) => {
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

  const logout = () => {
    user.value = null;
    isLoggedIn.value = false;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
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

  return {
    user,
    isLoggedIn,
    login,
    logout,
    refreshProfile,
    updateProfile,
    changePassword,
  };
});
