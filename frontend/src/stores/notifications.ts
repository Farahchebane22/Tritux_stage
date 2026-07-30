import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Notification } from '../types';
import { apiService } from '../services/api';
import { mockNotifications } from '../data/mockData';

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const isLoading = ref<boolean>(false);

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      notifications.value = JSON.parse(saved);
      return true;
    }
    return false;
  };

  const saveToLocalStorage = () => {
    localStorage.setItem('notifications', JSON.stringify(notifications.value));
  };

  const fetchNotifications = async () => {
    isLoading.value = true;
    try {
      const data = await apiService.getNotifications();
      notifications.value = data;
      saveToLocalStorage();
    } catch (error) {
      console.warn('API getNotifications failed, falling back to mock notifications', error);
      if (!loadFromLocalStorage()) {
        notifications.value = JSON.parse(JSON.stringify(mockNotifications));
        saveToLocalStorage();
      }
    } finally {
      isLoading.value = false;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiService.markNotificationRead(id);
      const notif = notifications.value.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        saveToLocalStorage();
      }
    } catch (error) {
      console.warn('API markNotificationRead failed, marking locally', error);
      const notif = notifications.value.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        saveToLocalStorage();
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      notifications.value.forEach(n => n.read = true);
      saveToLocalStorage();
    } catch (error) {
      console.warn('API markAllNotificationsRead failed, marking locally', error);
      notifications.value.forEach(n => n.read = true);
      saveToLocalStorage();
    }
  };

  const addNotification = (type: Notification['type'], message: string, ticketId?: string, ticketTitle?: string) => {
    const newNotif: Notification = {
      id: `n_local_${Date.now()}`,
      type,
      message,
      ticketId,
      ticketTitle,
      read: false,
      createdAt: new Date().toISOString()
    };
    notifications.value.unshift(newNotif);
    saveToLocalStorage();
  };

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

  return {
    notifications,
    isLoading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    addNotification
  };
});
