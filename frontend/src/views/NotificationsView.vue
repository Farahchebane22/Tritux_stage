<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-slate-900">Notifications</h1>
        <p class="text-slate-500 text-sm mt-0.5">
          {{ unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour' }}
        </p>
      </div>
      <button
        v-if="unreadCount > 0"
        @click="notificationsStore.markAllAsRead"
        class="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <CheckCheckIcon :size="15" />
        Tout marquer lu
      </button>
    </div>

    <div class="bg-white rounded-xl border overflow-hidden" style="borderColor: var(--border)">
      <div v-if="notificationsStore.notifications.length === 0" class="p-12 text-center">
        <BellIcon :size="32" class="mx-auto mb-3 text-slate-200" />
        <p class="text-slate-400 text-sm">Aucune notification</p>
      </div>
      
      <div v-else class="divide-y divide-slate-100" style="borderColor: var(--border)">
        <div
          v-for="notif in sortedNotifications"
          :key="notif.id"
          :class="[
            'flex gap-4 px-5 py-4 cursor-pointer transition-colors duration-100',
            !notif.read ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50'
          ]"
          @click="clickNotification(notif)"
        >
          <div
            class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
            :style="{ background: typeConfig[notif.type].bg }"
          >
            <component :is="typeConfig[notif.type].icon" :size="16" :style="{ color: typeConfig[notif.type].color }" />
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span class="text-[10px] font-semibold uppercase tracking-wider" :style="{ color: typeConfig[notif.type].color }">
                    {{ typeConfig[notif.type].label }}
                  </span>
                  <span v-if="!notif.read" class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                </div>
                <p class="text-sm text-slate-700 leading-snug">{{ notif.message }}</p>
                <p v-if="notif.ticketTitle" class="text-xs text-slate-400 mt-0.5 truncate">{{ notif.ticketTitle }}</p>
              </div>
              <span class="text-xs text-slate-400 flex-shrink-0">{{ timeAgo(notif.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '../stores/notifications';
import {
  Bell as BellIcon,
  MessageSquare as MessageSquareIcon,
  GitPullRequest as GitPullRequestIcon,
  UserCheck as UserCheckIcon,
  CheckCheck as CheckCheckIcon
} from 'lucide-vue-next';
import type { NotificationType } from '../types';

const router = useRouter();
const notificationsStore = useNotificationsStore();

onMounted(() => {
  notificationsStore.fetchNotifications();
});

const unreadCount = computed(() => notificationsStore.unreadCount);

const sortedNotifications = computed(() => {
  return [...notificationsStore.notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
});

const typeConfig: Record<NotificationType, { icon: any; color: string; bg: string; label: string }> = {
  new_ticket: { icon: BellIcon, color: '#1D4ED8', bg: '#EFF6FF', label: 'Nouveau ticket' },
  status_change: { icon: GitPullRequestIcon, color: '#7C3AED', bg: '#FAF5FF', label: 'Changement de statut' },
  new_comment: { icon: MessageSquareIcon, color: '#0D9488', bg: '#F0FDFA', label: 'Nouveau commentaire' },
  assignment: { icon: UserCheckIcon, color: '#F59E0B', bg: '#FFFBEB', label: 'Affectation' },
};

const clickNotification = (notif: any) => {
  notificationsStore.markAsRead(notif.id);
  if (notif.ticketId) {
    router.push(`/tickets/${notif.ticketId}`);
  }
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 1) return `il y a ${d} jours`;
  if (d === 1) return "il y a 1 jour";
  if (h >= 1) return `il y a ${h}h`;
  const m = Math.floor(diff / 60000);
  return m <= 1 ? "à l'instant" : `il y a ${m} min`;
};
</script>
