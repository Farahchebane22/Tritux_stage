<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="font-display text-2xl font-bold text-slate-900">
        Bonjour, {{ currentFirstName }} 👋
      </h1>
      <p class="text-slate-500 text-sm mt-1">
        {{ formattedDate }}
        · Tableau de bord {{ isAgent ? 'agent IT' : 'utilisateur' }}
      </p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="bg-white rounded-xl p-5 border transition-shadow duration-150 hover:shadow-md"
        style="borderColor: var(--border)"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: card.bg }">
            <component :is="card.icon" :size="18" :style="{ color: card.color }" :stroke-width="1.75" />
          </div>
          <TrendingUpIcon :size="14" class="text-slate-300" />
        </div>
        <div class="font-display text-3xl font-bold text-slate-900 mb-0.5">{{ card.value }}</div>
        <div class="text-xs font-medium text-slate-600 mb-0.5">{{ card.label }}</div>
        <div class="text-xs text-slate-400">{{ card.sub }}</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-8">
      <!-- Bar chart — 3/5 -->
      <div class="xl:col-span-3 bg-white rounded-xl p-5 border" style="borderColor: var(--border)">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-display font-semibold text-sm text-slate-900">Activité hebdomadaire</h2>
            <p class="text-xs text-slate-400">Tickets ouverts vs résolus</p>
          </div>
          <span class="text-xs font-mono px-2 py-1 rounded-md bg-slate-50 text-slate-500">7 derniers jours</span>
        </div>
        
        <!-- Custom SVG Bar Chart -->
        <div class="w-full h-[180px] relative mt-4">
          <svg class="w-full h-full" viewBox="0 0 500 180">
            <!-- Grid Lines -->
            <line x1="40" y1="20" x2="480" y2="20" stroke="#F1F5F9" stroke-dasharray="3 3" />
            <line x1="40" y1="60" x2="480" y2="60" stroke="#F1F5F9" stroke-dasharray="3 3" />
            <line x1="40" y1="100" x2="480" y2="100" stroke="#F1F5F9" stroke-dasharray="3 3" />
            <line x1="40" y1="140" x2="480" y2="140" stroke="#F1F5F9" stroke-dasharray="3 3" />
            <line x1="40" y1="150" x2="480" y2="150" stroke="#E2E8F0" />

            <!-- Y-Axis Labels -->
            <text x="15" y="24" fill="#94A3B8" font-size="10" font-family="Inter">12</text>
            <text x="15" y="64" fill="#94A3B8" font-size="10" font-family="Inter">8</text>
            <text x="15" y="104" fill="#94A3B8" font-size="10" font-family="Inter">4</text>
            <text x="15" y="144" fill="#94A3B8" font-size="10" font-family="Inter">0</text>

            <!-- Bars & X-Axis Labels -->
            <g v-for="(item, i) in weeklyTickets" :key="item.day">
              <!-- Opened Bar (Blue) -->
              <rect
                :x="45 + i * 62"
                :y="150 - (item.opened * 10)"
                width="16"
                :height="item.opened * 10"
                fill="#3B82F6"
                rx="3"
              />
              <!-- Resolved Bar (Green) -->
              <rect
                :x="64 + i * 62"
                :y="150 - (item.resolved * 10)"
                width="16"
                :height="item.resolved * 10"
                fill="#10B981"
                rx="3"
              />
              <!-- Day Label -->
              <text :x="60 + i * 62" y="168" fill="#94A3B8" font-size="11" font-family="Inter" text-anchor="middle">
                {{ item.day }}
              </text>
            </g>
          </svg>
        </div>

        <div class="flex justify-center gap-4 mt-2">
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded bg-[#3B82F6]" />
            <span class="text-xs text-slate-500 font-medium">Ouverts</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded bg-[#10B981]" />
            <span class="text-xs text-slate-500 font-medium">Résolus</span>
          </div>
        </div>
      </div>

      <!-- Donut — 2/5 -->
      <div class="xl:col-span-2 bg-white rounded-xl p-5 border" style="borderColor: var(--border)">
        <div class="mb-4">
          <h2 class="font-display font-semibold text-sm text-slate-900">Par catégorie</h2>
          <p class="text-xs text-slate-400">Répartition des {{ ticketsStore.tickets.length }} tickets</p>
        </div>
        
        <!-- Custom Donut Chart -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-6 h-[180px] mt-2">
          <!-- SVG Donut -->
          <div class="relative w-[120px] h-[120px] flex-shrink-0">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <!-- Cumulative Circle Segments -->
              <circle
                v-for="(seg, i) in categorySegments"
                :key="i"
                cx="50"
                cy="50"
                r="36"
                fill="transparent"
                :stroke="seg.color"
                stroke-width="12"
                :stroke-dasharray="`${seg.length} ${100 - seg.length}`"
                :stroke-dashoffset="-seg.offset"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-xl font-bold font-display text-slate-800">{{ ticketsStore.tickets.length }}</span>
              <span class="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Tickets</span>
            </div>
          </div>

          <!-- Legend -->
          <div class="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5 w-full">
            <div v-for="cat in byCategory" :key="cat.name" class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: cat.color }" />
              <span class="text-xs text-slate-600 font-medium truncate">{{ cat.name }} ({{ cat.value }})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI row for agent -->
    <div v-if="isAgent" class="grid grid-cols-3 gap-4 mb-8">
      <div
        v-for="kpi in agentKpis"
        :key="kpi.label"
        class="bg-white rounded-xl p-4 border flex items-center gap-4"
        style="borderColor: var(--border)"
      >
        <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: `${kpi.color}15` }">
          <component :is="kpi.icon" :size="16" :style="{ color: kpi.color }" />
        </div>
        <div>
          <div class="font-display text-xl font-bold text-slate-900">{{ kpi.value }}</div>
          <div class="text-xs text-slate-500">{{ kpi.label }}</div>
        </div>
      </div>
    </div>

    <!-- Recent tickets -->
    <div class="bg-white rounded-xl border" style="borderColor: var(--border)">
      <div class="px-5 py-4 border-b flex items-center justify-between" style="borderColor: var(--border)">
        <h2 class="font-display font-semibold text-sm text-slate-900">Tickets récents</h2>
        <router-link
          to="/tickets"
          class="text-xs font-medium transition-colors hover:opacity-80"
          style="color: var(--primary)"
        >
          Voir tous →
        </router-link>
      </div>
      <div class="divide-y divide-slate-100">
        <button
          v-for="ticket in recentTickets"
          :key="ticket.id"
          @click="viewTicket(ticket.id)"
          class="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors duration-100 cursor-pointer"
        >
          <span class="font-mono text-xs text-slate-400 w-20 flex-shrink-0">{{ ticket.id }}</span>
          <span class="flex-1 text-sm text-slate-800 truncate font-medium">{{ ticket.title }}</span>
          <div class="flex items-center gap-2 flex-shrink-0">
            <Badge :priority="ticket.priority" />
            <Badge :status="ticket.status" />
            <span class="text-xs text-slate-400 w-24 text-right">
              {{ formatDateString(ticket.updatedAt) }}
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTicketsStore } from '../stores/tickets';
import Badge from '../components/ui/Badge.vue';
import {
  Ticket as TicketIcon,
  Clock as ClockIcon,
  CheckCircle2 as CheckCircle2Icon,
  AlertTriangle as AlertTriangleIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  Users as UsersIcon
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const ticketsStore = useTicketsStore();

onMounted(async () => {
  await ticketsStore.fetchTickets();
});

const isAgent = computed(() => authStore.user?.role === 'agent' || authStore.user?.role === 'admin');

const currentFirstName = computed(() => {
  return authStore.user?.name.split(' ')[0] || 'Utilisateur';
});

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
});

const recentTickets = computed(() => {
  return ticketsStore.tickets.slice(0, 5);
});

// Computed statistics based on actual tickets list where possible
const openTicketsCount = computed(() => ticketsStore.tickets.filter(t => t.status === 'open').length);
const inProgressTicketsCount = computed(() => ticketsStore.tickets.filter(t => t.status === 'inprogress').length);
const urgentActiveCount = computed(() => ticketsStore.tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length);
const resolvedCount = computed(() => ticketsStore.tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length);

const statCards = computed(() => [
  { label: 'Tickets total', value: ticketsStore.tickets.length, icon: TicketIcon, color: '#1D4ED8', bg: '#EFF6FF', sub: `${openTicketsCount.value} ouverts` },
  { label: 'En cours', value: inProgressTicketsCount.value, icon: ClockIcon, color: '#F97316', bg: '#FFF7ED', sub: 'Traitement en cours' },
  { label: 'Résolus', value: resolvedCount.value, icon: CheckCircle2Icon, color: '#10B981', bg: '#ECFDF5', sub: 'Résolus ou fermés' },
  { label: 'Urgents actifs', value: urgentActiveCount.value, icon: AlertTriangleIcon, color: '#EF4444', bg: '#FEF2F2', sub: 'Action requise' },
]);

const agentKpis = computed(() => {
  const rated = ticketsStore.tickets.filter(t => t.satisfactionRating);
  const avgScore = rated.length
    ? (rated.reduce((s, t) => s + (t.satisfactionRating?.score || 0), 0) / rated.length).toFixed(1)
    : '—';
  const byPriority = {
    urgent: ticketsStore.tickets.filter(t => t.priority === 'urgent').length,
    high: ticketsStore.tickets.filter(t => t.priority === 'high').length,
    medium: ticketsStore.tickets.filter(t => t.priority === 'medium').length,
    low: ticketsStore.tickets.filter(t => t.priority === 'low').length,
  };
  return [
    { icon: ClockIcon, label: 'Tickets haute priorité', value: String(byPriority.urgent + byPriority.high), color: '#3B82F6' },
    { icon: StarIcon, label: 'Score de satisfaction', value: rated.length ? `${avgScore} / 5` : 'N/A', color: '#F59E0B' },
    { icon: UsersIcon, label: 'Priorité moyenne / basse', value: String(byPriority.medium + byPriority.low), color: '#10B981' },
  ];
});

const weeklyTickets = computed(() => {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const result = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const dayTickets = ticketsStore.tickets.filter(t => t.createdAt?.slice(0, 10) === key);
    const resolved = ticketsStore.tickets.filter(t =>
      (t.status === 'resolved' || t.status === 'closed') && t.updatedAt?.slice(0, 10) === key
    );
    return { day: days[d.getDay()], opened: dayTickets.length, resolved: resolved.length };
  });
  return result;
});

const categoryLabelMap: Record<string, string> = {
  network: 'Réseau', software: 'Logiciel', hardware: 'Matériel',
  account: 'Compte', email: 'Email', security: 'Sécurité', other: 'Autre'
};
const categoryColors: Record<string, string> = {
  network: '#3B82F6', software: '#7C3AED', hardware: '#0D9488',
  account: '#F59E0B', email: '#EC4899', security: '#EF4444', other: '#94A3B8'
};

const byCategory = computed(() => {
  const counts: Record<string, number> = {};
  ticketsStore.tickets.forEach(t => {
    counts[t.category] = (counts[t.category] || 0) + 1;
  });
  return Object.entries(counts).map(([key, value]) => ({
    name: categoryLabelMap[key] || key,
    value,
    color: categoryColors[key] || '#94A3B8'
  }));
});

// Calculate segments values for SVG Pie segment rendering
const categorySegments = computed(() => {
  const total = byCategory.value.reduce((acc, curr) => acc + curr.value, 0) || 1;
  let accumulatedOffset = 0;
  return byCategory.value.map(cat => {
    const percentage = (cat.value / total) * 100;
    const item = {
      color: cat.color,
      length: percentage,
      offset: accumulatedOffset
    };
    accumulatedOffset += percentage;
    return item;
  });
});

const viewTicket = (id: string) => {
  router.push(`/tickets/${id}`);
};

const formatDateString = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  });
};
</script>
