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
        v-if="isInternalStaffRole"
        @click="navigate('clients')"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer"
        :style="{
          background: isActive('clients') ? 'var(--sidebar-active)' : 'transparent',
          color: isActive('clients') ? 'var(--sidebar-active-fg)' : 'var(--sidebar-fg)',
        }"
        @mouseenter="onHover"
        @mouseleave="onLeave"
      >
        <SettingsIcon :size="16" :stroke-width="1.75" />
        <span class="font-medium">Clients</span>
      </button>
    </nav>

    <!-- Contrat de maintenance (sociétés clientes) -->
    <div v-if="contractStore.status?.contrat" class="px-4 pb-3">
      <div class="rounded-lg px-3 py-2.5" style="background: rgba(255,255,255,0.05)">
        <div class="flex items-center justify-between">
          <p class="text-[10px] uppercase tracking-wide" style="color: var(--sidebar-fg)">Contrat</p>
          <button
            v-if="currentUser.role === 'CLIENT_ADMIN'"
            type="button"
            title="Modifier le contrat"
            class="text-slate-400 hover:text-white cursor-pointer"
            @click="router.push('/contract/settings')"
          >
            <PencilIcon :size="12" />
          </button>
        </div>
        <p class="text-white text-xs font-semibold mt-0.5">{{ contractStore.status.contrat.type_contrat }}</p>
        <p class="text-[10px] mt-0.5" style="color: var(--sidebar-fg)">
          Jusqu'au {{ formatContractDate(contractStore.status.contrat.date_fin) }}
        </p>
      </div>
    </div>

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
import { useContractStore } from '../stores/contract';
import {
  LayoutDashboard as LayoutDashboardIcon,
  Ticket as TicketIcon,
  Bell as BellIcon,
  User as UserIcon,
  Plus as PlusIcon,
  LogOut as LogOutIcon,
  Settings as SettingsIcon,
  ChevronRight as ChevronRightIcon,
  ShieldAlert as ShieldAlertIcon,
  FileBarChart as FileBarChartIcon,
  Pencil as PencilIcon
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const contractStore = useContractStore();

const formatContractDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const currentUser = computed(() => authStore.user || { name: 'Guest', role: 'user' });
const isInternalStaffRole = computed(() => {
  const r = currentUser.value.role;
  return r === 'admin' || r === 'SUPER_ADMIN' || r === 'agent' || r === 'AGENT_IT';
});

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
  { id: 'reports', label: 'Rapports', icon: FileBarChartIcon, path: '/reports' },
  { id: 'notifications', label: 'Notifications', icon: BellIcon, path: '/notifications' },
  { id: 'profile', label: 'Profil', icon: UserIcon, path: '/profile' }
];

const roleLabels: Record<string, string> = {
  user: 'Utilisateur',
  agent: 'Agent IT',
  admin: 'Administrateur',
  CLIENT_USER: 'Utilisateur',
  CLIENT_ADMIN: 'Admin société',
  AGENT_IT: 'Agent IT',
  SUPER_ADMIN: 'Administrateur',
};

const roleColors: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-300',
  agent: 'bg-violet-500/20 text-violet-300',
  admin: 'bg-rose-500/20 text-rose-300',
  CLIENT_USER: 'bg-blue-500/20 text-blue-300',
  CLIENT_ADMIN: 'bg-emerald-500/20 text-emerald-300',
  AGENT_IT: 'bg-violet-500/20 text-violet-300',
  SUPER_ADMIN: 'bg-rose-500/20 text-rose-300',
};

const isActive = (id: string) => {
  if (id === 'dashboard') return route.path === '/';
  if (id === 'tickets') return route.path.startsWith('/tickets');
  if (id === 'clients') return route.path === '/clients';
  if (id === 'security') return route.path === '/security';
  if (id === 'reports') return route.path === '/reports';
  if (id === 'notifications') return route.path === '/notifications';
  if (id === 'profile') return route.path === '/profile';
  return false;
};

const navigate = (id: string) => {
  if (id === 'dashboard') router.push('/');
  else if (id === 'tickets') router.push('/tickets');
  else if (id === 'clients') router.push('/clients');
  else if (id === 'security') router.push('/security');
  else if (id === 'reports') router.push('/reports');
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
