<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-slate-900">
          {{ listTitle }}
        </h1>
        <p class="text-slate-500 text-sm mt-0.5">
          {{ filteredTickets.length }} ticket{{ filteredTickets.length !== 1 ? 's' : '' }} trouvé{{ filteredTickets.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <router-link
        to="/tickets/create"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 cursor-pointer"
        style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
      >
        <PlusIcon :size="15" :stroke-width="2.5" />
        Nouveau ticket
      </router-link>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-6">
      <div class="relative flex-1 min-w-56">
        <SearchIcon :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          v-model="search"
          placeholder="Rechercher par titre, ID…"
          class="w-full pl-9 pr-3.5 py-2.5 rounded-lg text-sm border bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style="borderColor: var(--border)"
        />
      </div>

      <!-- Status select -->
      <div class="relative">
        <select
          v-model="filterStatus"
          class="appearance-none pl-3 pr-8 py-2.5 rounded-lg text-sm border bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          style="borderColor: var(--border)"
        >
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <ChevronDownIcon :size="13" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      <!-- Priority select -->
      <div class="relative">
        <select
          v-model="filterPriority"
          class="appearance-none pl-3 pr-8 py-2.5 rounded-lg text-sm border bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          style="borderColor: var(--border)"
        >
          <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <ChevronDownIcon :size="13" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      <!-- Category select -->
      <div class="relative">
        <select
          v-model="filterCategory"
          class="appearance-none pl-3 pr-8 py-2.5 rounded-lg text-sm border bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          style="borderColor: var(--border)"
        >
          <option value="all">Toutes catégories</option>
          <option v-for="(label, key) in categoryLabels" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <ChevronDownIcon :size="13" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border overflow-hidden" style="borderColor: var(--border)">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[780px]">
          <thead>
            <tr class="border-b" style="borderColor: var(--border)">
              <th
                v-for="col in tableHeaders"
                :key="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                style="background: var(--muted)"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100" style="borderColor: var(--border)">
            <tr v-if="filteredTickets.length === 0">
              <td :colspan="tableHeaders.length" class="px-4 py-12 text-center text-slate-400 text-sm">
                Aucun ticket ne correspond à vos filtres
              </td>
            </tr>
            <tr
              v-else
              v-for="ticket in filteredTickets"
              :key="ticket.id"
              @click="viewTicket(ticket.id)"
              class="hover:bg-slate-50 cursor-pointer transition-colors duration-100"
            >
              <td class="px-4 py-3.5">
                <span class="font-mono text-xs text-slate-500">{{ ticket.id }}</span>
              </td>
              <td class="px-4 py-3.5">
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-slate-800 line-clamp-1">{{ ticket.title }}</span>
                  <span
                    v-if="isUrgentUnassigned(ticket)"
                    class="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 animate-pulse"
                  >
                    🔴 {{ urgentLabel(ticket) }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3.5">
                <Badge :category="ticket.category" />
              </td>
              <td class="px-4 py-3.5">
                <Badge :priority="ticket.priority" />
              </td>
              <td class="px-4 py-3.5">
                <Badge :status="ticket.status" />
              </td>
              <td v-if="isStaff" class="px-4 py-3.5">
                <div class="flex items-center gap-2">
                  <div
                    class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                    style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
                  >
                    {{ getUserInitials(ticket.createdBy.name) }}
                  </div>
                  <span class="text-xs text-slate-600 truncate max-w-[120px]">{{ ticket.createdBy.name }}</span>
                </div>
              </td>
              <td v-if="isStaff" class="px-4 py-3.5">
                <span class="text-xs text-slate-500">{{ societeName(ticket.societeId) }}</span>
              </td>
              <td class="px-4 py-3.5">
                <span v-if="ticket.assignedTo" class="text-xs text-slate-600">{{ ticket.assignedTo.name }}</span>
                <span v-else class="text-xs text-slate-300">Non assigné</span>
              </td>
              <td class="px-4 py-3.5">
                <span class="text-xs text-slate-400">
                  {{ formatDateTime(ticket.updatedAt) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredTickets.length > 0" class="px-4 py-3 border-t flex items-center justify-between" style="borderColor: var(--border); background: var(--muted)">
        <span class="text-xs text-slate-500">{{ filteredTickets.length }} résultats</span>
        <div class="flex gap-1">
          <button
            v-for="p in [1, 2, 3]"
            :key="p"
            class="w-7 h-7 rounded text-xs font-medium transition-colors cursor-pointer"
            :style="p === 1 ? { background: 'var(--primary)', color: '#fff' } : { color: '#64748b' }"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTicketsStore } from '../stores/tickets';
import { apiService } from '../services/api';
import { isUrgentUnassigned, urgentEscalationLabel } from '../utils/urgentEscalation';
import Badge from '../components/ui/Badge.vue';
import {
  Search as SearchIcon,
  Plus as PlusIcon,
  ChevronDown as ChevronDownIcon
} from 'lucide-vue-next';
import type { TicketStatus, TicketPriority, TicketCategory } from '../types';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const ticketsStore = useTicketsStore();

const search = ref('');
const filterStatus = ref<TicketStatus | 'all'>('all');
const filterPriority = ref<TicketPriority | 'all'>(
  route.query.priority === 'urgent' ? 'urgent' : 'all'
);
const filterCategory = ref<TicketCategory | 'all'>('all');
const filterUnassigned = ref(route.query.unassigned === '1');
const societeFilter = ref<string | null>((route.query.societeId as string) || null);
const societeNames = ref<Record<string, string>>({});

const societeName = (id?: string | null) => (id ? societeNames.value[id] || id : '—');

onMounted(async () => {
  await ticketsStore.fetchTickets();
  if (isStaff.value) {
    try {
      const societes = await apiService.getSocietes();
      societeNames.value = Object.fromEntries(societes.map((s: any) => [s.id, s.nom]));
    } catch {
      /* pas bloquant pour l'affichage des tickets */
    }
  }
});

const isStaff = computed(() => {
  const r = authStore.user?.role;
  return r === 'agent' || r === 'admin' || r === 'AGENT_IT' || r === 'SUPER_ADMIN';
});
const isAdmin = computed(() => {
  const r = authStore.user?.role;
  return r === 'admin' || r === 'SUPER_ADMIN';
});
const isAgentOnly = computed(() => {
  const r = authStore.user?.role;
  return r === 'agent' || r === 'AGENT_IT';
});

const listTitle = computed(() => {
  if (societeFilter.value) return `Tickets — ${societeName(societeFilter.value)}`;
  if (isAdmin.value) return 'Tous les tickets';
  if (isAgentOnly.value) return 'Mes tickets assignés';
  return 'Mes tickets';
});

const statusOptions: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'open', label: 'Ouvert' },
  { value: 'inprogress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
];

const priorityOptions: { value: TicketPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes priorités' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Haute' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Basse' },
];

const categoryLabels: Record<TicketCategory, string> = {
  hardware: 'Matériel',
  software: 'Logiciel',
  network: 'Réseau',
  account: 'Compte',
  email: 'Email',
  security: 'Sécurité',
  other: 'Autre',
};

const tableHeaders = computed(() => {
  const base = ['ID', 'Titre', 'Catégorie', 'Priorité', 'Statut'];
  if (isStaff.value) base.push('Créé par', 'Société');
  base.push('Assigné à', 'Mise à jour');
  return base;
});

const filteredTickets = computed(() => {
  const uid = authStore.user?.id;
  const role = authStore.user?.role;
  return ticketsStore.tickets.filter(t => {
    let userMatch = false;
    if (role === 'admin' || role === 'SUPER_ADMIN') userMatch = true;
    else if (role === 'agent' || role === 'AGENT_IT') userMatch = t.assignedTo?.id === uid;
    else userMatch = t.createdBy.id === uid;

    const searchMatch = !search.value ||
      t.title.toLowerCase().includes(search.value.toLowerCase()) ||
      t.id.toLowerCase().includes(search.value.toLowerCase()) ||
      t.description.toLowerCase().includes(search.value.toLowerCase());

    const statusMatch = filterStatus.value === 'all' || t.status === filterStatus.value;
    const priorityMatch = filterPriority.value === 'all' || t.priority === filterPriority.value;
    const catMatch = filterCategory.value === 'all' || t.category === filterCategory.value;
    const societeMatch = !societeFilter.value || (t as any).societeId === societeFilter.value;
    const unassignedMatch = !filterUnassigned.value || !t.assignedTo;

    return userMatch && searchMatch && statusMatch && priorityMatch && catMatch && societeMatch && unassignedMatch;
  });
});

const urgentLabel = (ticket: Parameters<typeof urgentEscalationLabel>[0]) => urgentEscalationLabel(ticket);

const viewTicket = (id: string) => {
  router.push(`/tickets/${id}`);
};

const getUserInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>
