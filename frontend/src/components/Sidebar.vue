<template>
  <aside
    class="fixed left-0 top-0 h-screen w-64 flex flex-col z-40"
    style="background: var(--sidebar-bg)"
  >
    <!-- Logo -->
    <div class="px-5 py-5 border-b" style="borderColor: var(--sidebar-border)">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 via-violet-500 to-rose-500 flex-shrink-0">
          <span class="text-white text-xs font-bold font-display">T</span>
        </div>
        <div>
          <div class="text-white font-display font-bold text-sm leading-tight">Tritux Groupe</div>
          <div class="text-xs leading-tight" style="color: var(--sidebar-fg)">IT Helpdesk</div>
        </div>
      </div>
    </div>

    <!-- Create ticket CTA -->
    <div class="px-4 py-4">
      <button
        @click="navigate('create-ticket')"
        class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] cursor-pointer"
        style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
      >
        <PlusIcon :size="15" :stroke-width="2.5" />
        Nouveau ticket
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 overflow-y-auto sidebar-scroll space-y-0.5">
      <button
        v-for="item in navItems"
        :key="item.id"
        @click="navigate(item.id)"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative group cursor-pointer"
        :style="{
          background: isActive(item.id) ? 'var(--sidebar-active)' : 'transparent',
          color: isActive(item.id) ? 'var(--sidebar-active-fg)' : 'var(--sidebar-fg)',
        }"
        @mouseenter="onHover"
        @mouseleave="onLeave"
      >
        <component :is="item.icon" :size="16" :stroke-width="isActive(item.id) ? 2 : 1.75" />
        <span class="font-medium">{{ item.label }}</span>
        
        <span
          v-if="item.id === 'notifications' && notificationsStore.unreadCount > 0"
          class="ml-auto w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
        >
          {{ notificationsStore.unreadCount }}
        </span>
        
        <ChevronRightIcon v-if="isActive(item.id)" :size="13" class="ml-auto opacity-60" />
      </button>

      <button
        v-if="currentUser.role === 'admin'"
        @click="navigate('tickets')"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer"
        style="color: var(--sidebar-fg)"
        @mouseenter="onHover"
        @mouseleave="onLeave"
      >
        <SettingsIcon :size="16" :stroke-width="1.75" />
        <span class="font-medium">Tous les tickets</span>
      </button>
    </nav>

    <!-- User footer -->
    <div class="px-4 py-4 border-t" style="borderColor: var(--sidebar-border)">
      <div class="flex items-center gap-3" v-if="currentUser">
        <div
          class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
          style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
        >
          {{ initials }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-white text-sm font-medium truncate leading-tight">{{ currentUser.name }}</div>
          <span :class="['inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5', roleColors[currentUser.role]]">
            {{ roleLabels[currentUser.role] }}
          </span>
        </div>
        <button
          @click="logout"
          class="p-1.5 rounded-md transition-colors duration-150 hover:bg-white/10 cursor-pointer"
          style="color: var(--sidebar-fg)"
          title="Se déconnecter"
        >
          <LogOutIcon :size="14" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNotificationsStore } from '../stores/notifications';
import {
  LayoutDashboard as LayoutDashboardIcon,
  Ticket as TicketIcon,
  Bell as BellIcon,
  User as UserIcon,
  Plus as PlusIcon,
  LogOut as LogOutIcon,
  Settings as SettingsIcon,
  ChevronRight as ChevronRightIcon,
  ShieldAlert as ShieldAlertIcon
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

const currentUser = computed(() => authStore.user || { name: 'Guest', role: 'user' });

const initials = computed(() => {
  if (!currentUser.value.name) return '';
  return currentUser.value.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
});

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, path: '/' },
  { id: 'tickets', label: 'Tickets', icon: TicketIcon, path: '/tickets' },
  { id: 'security', label: 'Analyse cyber', icon: ShieldAlertIcon, path: '/security' },
  { id: 'notifications', label: 'Notifications', icon: BellIcon, path: '/notifications' },
  { id: 'profile', label: 'Profil', icon: UserIcon, path: '/profile' }
];

const roleLabels: Record<string, string> = {
  user: 'Utilisateur',
  agent: 'Agent IT',
  admin: 'Administrateur',
};

const roleColors: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-300',
  agent: 'bg-violet-500/20 text-violet-300',
  admin: 'bg-rose-500/20 text-rose-300',
};

const isActive = (id: string) => {
  if (id === 'dashboard') return route.path === '/';
  if (id === 'tickets') return route.path.startsWith('/tickets');
  if (id === 'security') return route.path === '/security';
  if (id === 'notifications') return route.path === '/notifications';
  if (id === 'profile') return route.path === '/profile';
  return false;
};

const navigate = (id: string) => {
  if (id === 'dashboard') router.push('/');
  else if (id === 'tickets') router.push('/tickets');
  else if (id === 'security') router.push('/security');
  else if (id === 'notifications') router.push('/notifications');
  else if (id === 'profile') router.push('/profile');
  else if (id === 'create-ticket') router.push('/tickets/create');
};

const logout = () => {
  authStore.logout();
  router.push('/login');
};

const onHover = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const isCurrentlyActive = target.style.background === 'var(--sidebar-active)';
  if (!isCurrentlyActive) {
    target.style.background = 'var(--sidebar-hover)';
  }
};

const onLeave = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const isCurrentlyActive = target.style.color === 'var(--sidebar-active-fg)';
  if (!isCurrentlyActive) {
    target.style.background = 'transparent';
  }
};
</script>
