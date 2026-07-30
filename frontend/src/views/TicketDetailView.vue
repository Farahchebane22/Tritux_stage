<template>
  <div class="p-8" v-if="ticket">
    <!-- Back -->
    <button
      @click="$router.push('/tickets')"
      class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors cursor-pointer"
    >
      <ChevronLeftIcon :size="15" />
      Retour aux tickets
    </button>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Main content — 2/3 -->
      <div class="xl:col-span-2 space-y-4">
        <!-- Title card -->
        <div class="bg-white rounded-xl border p-6" style="borderColor: var(--border)">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="font-mono text-xs text-slate-400">{{ ticket.id }}</span>
                <span class="text-slate-200">·</span>
                <Badge :category="ticket.category" />
              </div>
              <h1 class="font-display text-xl font-bold text-slate-900 leading-snug">{{ ticket.title }}</h1>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
            <Badge :status="ticket.status" />
            <Badge :priority="ticket.priority" />
          </div>

          <div class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border" style="borderColor: var(--border)">
            {{ ticket.description }}
          </div>

          <div class="flex flex-wrap gap-x-6 gap-y-1 mt-4">
            <div class="text-xs text-slate-400">
              Créé par <span class="text-slate-600 font-medium">{{ ticket.createdBy.name }}</span>
              · {{ formatDate(ticket.createdAt) }}
            </div>
            <div class="text-xs text-slate-400">
              Mis à jour {{ timeAgo(ticket.updatedAt) }}
            </div>
            <div class="text-xs text-slate-400" v-if="ticket.assignedTo">
              Assigné à <span class="text-slate-600 font-medium">{{ ticket.assignedTo.name }}</span>
            </div>
          </div>
        </div>

        <!-- Satisfaction CTA -->
        <div
          v-if="canRate"
          class="rounded-xl border p-4 flex items-center gap-3"
          style="background: linear-gradient(135deg, #EFF6FF 0%, #FAF5FF 100%); borderColor: #BFDBFE"
        >
          <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-yellow-100">
            <StarIcon :size="16" class="text-yellow-600" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-slate-900">Ce ticket a été résolu.</p>
            <p class="text-xs text-slate-500">Évaluez la qualité du support pour nous aider à nous améliorer.</p>
          </div>
          <button
            @click="showSatisfaction = true"
            class="px-4 py-2 rounded-lg text-xs font-semibold text-white flex-shrink-0 transition-all hover:opacity-90 cursor-pointer"
            style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
          >
            Évaleur
          </button>
        </div>

        <!-- Satisfaction Rating Result -->
        <div
          v-if="ticket.satisfactionRating"
          class="rounded-xl border p-4 flex items-center gap-3"
          style="background: #F0FDF4; borderColor: #BBF7D0"
        >
          <div class="flex gap-0.5">
            <StarIcon
              v-for="s in [1, 2, 3, 4, 5]"
              :key="s"
              :size="14"
              :fill="s <= ticket.satisfactionRating.score ? '#F59E0B' : 'none'"
              stroke="#F59E0B"
            />
          </div>
          <p class="text-xs text-slate-600 italic">"{{ ticket.satisfactionRating.comment }}"</p>
        </div>

        <!-- Tabs -->
        <div class="bg-white rounded-xl border overflow-hidden" style="borderColor: var(--border)">
          <div class="flex border-b" style="borderColor: var(--border)">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              ]"
            >
              <component :is="tab.icon" :size="14" />
              {{ tab.label }}
              <span
                :class="[
                  'text-xs px-1.5 py-0.5 rounded-full ml-1',
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                ]"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>

          <div class="p-5">
            <!-- Comments Tab -->
            <div v-if="activeTab === 'comments'" class="space-y-4">
              <p v-if="ticket.comments.length === 0" class="text-sm text-slate-400 text-center py-4">
                Aucun commentaire pour le moment.
              </p>
              
              <div
                v-for="c in ticket.comments"
                :key="c.id"
                :class="['flex gap-3', c.author.id === currentUser?.id ? 'flex-row-reverse' : '']"
              >
                <div
                  class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  :style="{
                    background: c.author.id === currentUser?.id
                      ? 'linear-gradient(135deg, #1D4ED8, #7C3AED)'
                      : 'linear-gradient(135deg, #0D9488, #1D4ED8)'
                  }"
                >
                  {{ getUserInitials(c.author.name) }}
                </div>
                
                <div :class="['max-w-[80%] flex flex-col gap-1', c.author.id === currentUser?.id ? 'items-end' : 'items-start']">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-slate-700">{{ c.author.name }}</span>
                    <span v-if="c.isInternal" class="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.25 rounded">Interne</span>
                    <span class="text-xs text-slate-400">{{ timeAgo(c.createdAt) }}</span>
                  </div>
                  
                  <div
                    :class="[
                      'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                      c.author.id === currentUser?.id
                        ? 'text-white rounded-tr-sm'
                        : 'text-slate-700 rounded-tl-sm bg-slate-100'
                    ]"
                    :style="c.author.id === currentUser?.id ? { background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' } : {}"
                  >
                    {{ c.content }}
                  </div>
                </div>
              </div>

              <!-- Comment input -->
              <div class="flex gap-3 mt-5 pt-4 border-t" style="borderColor: var(--border)">
                <div
                  class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style="background: linear-gradient(135deg, #1D4ED8, #7C3AED)"
                >
                  {{ currentUser ? getUserInitials(currentUser.name) : 'G' }}
                </div>
                <div class="flex-1 flex gap-2">
                  <input
                    type="text"
                    v-model="newComment"
                    @keydown.enter="submitComment"
                    placeholder="Ajouter un commentaire…"
                    class="flex-1 px-3.5 py-2.5 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    style="borderColor: var(--border)"
                  />
                  <button
                    @click="submitComment"
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 flex-shrink-0 cursor-pointer"
                    style="background: linear-gradient(135deg, #1D4ED8, #7C3AED)"
                  >
                    <SendIcon :size="15" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Attachments Tab -->
            <div v-if="activeTab === 'attachments'" class="space-y-2">
              <p v-if="ticket.attachments.length === 0" class="text-sm text-slate-400 text-center py-4">
                Aucune pièce jointe.
              </p>
              <div
                v-else
                v-for="a in ticket.attachments"
                :key="a.id"
                class="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                style="borderColor: var(--border)"
              >
                <ImageIcon v-if="a.type.startsWith('image/')" :size="16" class="text-blue-500 flex-shrink-0" />
                <FileTextIcon v-else :size="16" class="text-slate-400 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-slate-800 truncate">{{ a.name }}</p>
                  <p class="text-xs text-slate-400">
                    {{ a.size }} · Uploadé par {{ a.uploadedBy }} · {{ formatDate(a.uploadedAt) }}
                  </p>
                </div>
                <a :href="a.url" class="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                  <DownloadIcon :size="14" />
                </a>
              </div>
            </div>

            <!-- History Tab -->
            <div v-if="activeTab === 'history'" class="space-y-3">
              <div v-for="(h, i) in ticket.history" :key="h.id" class="flex gap-3 items-start">
                <div class="flex flex-col items-center">
                  <div class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <ClockIcon :size="11" class="text-slate-400" />
                  </div>
                  <div v-if="i < ticket.history.length - 1" class="w-px flex-1 bg-slate-100 mt-1 min-h-[16px]" />
                </div>
                <div class="pb-3 flex-1">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-slate-700">{{ h.changedBy.name }}</span>
                    <span class="text-xs text-slate-400">
                      {{ h.field === 'status' ? 'a changé le statut' : h.field === 'assignedTo' ? 'a assigné le ticket' : `a modifié ${h.field}` }}
                    </span>
                    <span class="text-xs text-slate-400 ml-auto">{{ timeAgo(h.changedAt) }}</span>
                  </div>
                  <div v-if="h.oldValue" class="flex items-center gap-1.5 mt-1">
                    <span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">{{ formatHistoryValue(h.field, h.oldValue) }}</span>
                    <span class="text-xs text-slate-300">→</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">{{ formatHistoryValue(h.field, h.newValue) }}</span>
                  </div>
                  <span v-else class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium mt-1 inline-block">
                    {{ formatHistoryValue(h.field, h.newValue) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar — 1/3 -->
      <div class="space-y-4">
        <!-- AI Suggestion -->
        <div
          v-if="ticket.aiSuggestion"
          class="rounded-xl border overflow-hidden"
          style="background: linear-gradient(145deg, #FAF5FF, #EFF6FF); borderColor: #7C3AED30"
        >
          <div
            class="px-4 py-3 flex items-center gap-2"
            style="background: linear-gradient(90deg, #7C3AED, #1D4ED8)"
          >
            <SparklesIcon :size="13" class="text-white" />
            <span class="text-xs font-semibold text-white">Suggestion IA</span>
            <span class="ml-auto font-mono text-[10px] text-white/70">{{ ticket.aiSuggestion.confidence }}%</span>
          </div>
          <div class="p-4 space-y-3">
            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg bg-white border text-center" style="borderColor: #E9D5FF">
                <p class="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Catégorie</p>
                <p class="text-xs font-bold text-slate-900 mt-0.5">{{ categoryLabels[ticket.aiSuggestion.category] }}</p>
              </div>
              <div class="p-2.5 rounded-lg bg-white border text-center" style="borderColor: #E9D5FF">
                <p class="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Priorité</p>
                <p class="text-xs font-bold text-slate-900 mt-0.5 capitalize">{{ priorityLabel[ticket.aiSuggestion.priority] }}</p>
              </div>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-1.5">Réponse suggérée</p>
              <p class="text-xs text-slate-600 leading-relaxed bg-white border rounded-lg p-2.5" style="borderColor: #E9D5FF">
                {{ ticket.aiSuggestion.suggestedResponse }}
              </p>
            </div>
          </div>
        </div>

        <!-- Agent actions -->
        <div v-if="isAgent" class="bg-white rounded-xl border p-4 space-y-4" style="borderColor: var(--border)">
          <h3 class="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserCheckIcon :size="14" class="text-slate-400" />
            Actions agent
          </h3>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5">Changer le statut</label>
            <div class="relative">
              <select
                v-model="status"
                class="w-full appearance-none px-3 py-2.5 rounded-lg text-sm border text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                style="borderColor: var(--border)"
              >
                <option v-for="o in statusOptions" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
              <ChevronDownIcon :size="13" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">
              Assigner à
              <span v-if="ticket" class="font-normal text-slate-400">
                — domaine {{ categoryLabels[ticket.category] || ticket.category }}
              </span>
            </label>
            <p v-if="ticket" class="text-[11px] text-slate-500 mb-2">
              Agents spécialisés pour la catégorie « {{ categoryLabels[ticket.category] }} » en premier.
            </p>
            <div class="relative">
              <select
                v-model="assigneeId"
                class="w-full appearance-none px-3 py-2.5 rounded-lg text-sm border text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                style="borderColor: var(--border)"
              >
                <option value="">Non assigné</option>
                <optgroup
                  v-if="specializedAgents.length"
                  :label="`Spécialistes — ${categoryLabels[ticket?.category || 'other']}`"
                >
                  <option v-for="a in specializedAgents" :key="a.id" :value="a.id">
                    {{ a.name }} · {{ formatSpecialties(a) }}
                  </option>
                </optgroup>
                <optgroup v-if="otherAgents.length" label="Autres agents IT">
                  <option v-for="a in otherAgents" :key="a.id" :value="a.id">
                    {{ a.name }} · {{ formatSpecialties(a) }}
                  </option>
                </optgroup>
                <option
                  v-if="currentAssigneeOutsideLists"
                  :value="ticket!.assignedTo!.id"
                >
                  {{ ticket!.assignedTo!.name }} (assigné actuellement)
                </option>
              </select>
              <ChevronDownIcon :size="13" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <p v-if="ticket && !specializedAgents.length" class="text-[11px] text-amber-600 mt-1.5">
              Aucun spécialiste dédié à cette catégorie — choisissez un autre agent IT.
            </p>
          </div>

          <button
            @click="saveAgentChanges"
            class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
            style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
          >
            Enregistrer les modifications
          </button>
        </div>

        <!-- Ticket meta -->
        <div class="bg-white rounded-xl border p-4 space-y-3" style="borderColor: var(--border)">
          <h3 class="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertCircleIcon :size="14" class="text-slate-400" />
            Informations
          </h3>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Statut</span>
            <Badge :status="ticket.status" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Priorité</span>
            <Badge :priority="ticket.priority" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Catégorie</span>
            <Badge :category="ticket.category" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Créé par</span>
            <span class="text-xs text-slate-700">{{ ticket.createdBy.name }}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Créé le</span>
            <span class="text-xs text-slate-600">{{ formatDate(ticket.createdAt) }}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Dernière MAJ</span>
            <span class="text-xs text-slate-600">{{ formatDate(ticket.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Satisfaction evaluation modal -->
    <SatisfactionModal
      v-if="showSatisfaction"
      :ticketId="ticket.id"
      :ticketTitle="ticket.title"
      @close="showSatisfaction = false"
      @submit="submitSatisfaction"
    />
  </div>
  <div v-else-if="accessDenied" class="p-8 text-center text-slate-500">
    <AlertCircleIcon class="mx-auto mb-2 text-rose-400" :size="28" />
    <p class="font-medium text-slate-700">Accès refusé</p>
    <p class="text-sm mt-1">Ce ticket n'existe pas ou vous n'avez pas l'autorisation de le consulter.</p>
    <button @click="router.push('/tickets')" class="mt-4 text-sm text-blue-600 hover:underline cursor-pointer">Retour aux tickets</button>
  </div>
  <div v-else class="p-8 text-center text-slate-400">
    <Loader2Icon class="animate-spin mx-auto mb-2 text-blue-500" />
    Chargement du ticket...
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTicketsStore } from '../stores/tickets';
import { apiService } from '../services/api';
import {
  agentSpecialties,
  categoryLabels,
  splitAgentsByCategory,
} from '../utils/agentCategories';
import type { TicketCategory, TicketStatus, User } from '../types';
import Badge from '../components/ui/Badge.vue';
import SatisfactionModal from '../components/SatisfactionModal.vue';
import {
  ChevronLeft as ChevronLeftIcon,
  Paperclip as PaperclipIcon,
  MessageSquare as MessageSquareIcon,
  Clock as ClockIcon,
  Sparkles as SparklesIcon,
  Send as SendIcon,
  Star as StarIcon,
  UserCheck as UserCheckIcon,
  FileText as FileTextIcon,
  Image as ImageIcon,
  Download as DownloadIcon,
  ChevronDown as ChevronDownIcon,
  AlertCircle as AlertCircleIcon,
  Loader2 as Loader2Icon
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const ticketsStore = useTicketsStore();

const activeTab = ref<'comments' | 'attachments' | 'history'>('comments');
const newComment = ref('');
const status = ref<TicketStatus>('open');
const assigneeId = ref('');
const showSatisfaction = ref(false);
const agentOptions = ref<User[]>([]);
const specializedAgents = ref<User[]>([]);
const otherAgents = ref<User[]>([]);
const accessDenied = ref(false);

const ticketId = computed(() => route.params.id as string);
const ticket = computed(() => ticketsStore.tickets.find(t => t.id === ticketId.value));
const currentUser = computed(() => authStore.user);
const isAgent = computed(() => currentUser.value?.role === 'agent' || currentUser.value?.role === 'admin');

const currentAssigneeOutsideLists = computed(() => {
  const id = ticket.value?.assignedTo?.id;
  if (!id) return false;
  return !specializedAgents.value.some(a => a.id === id)
    && !otherAgents.value.some(a => a.id === id);
});

const loadAgentsForTicket = async (category: TicketCategory) => {
  try {
    const grouped = await apiService.getAgentsForCategory(category);
    specializedAgents.value = grouped.specialized;
    otherAgents.value = grouped.others;
    agentOptions.value = grouped.all;
  } catch {
    const fallback: User[] = [
      {
        id: 'u2',
        name: 'Leila Mansour',
        email: 'leila.mansour@tritux.com',
        role: 'agent',
        joinDate: '2022-09-01',
        specialties: ['network', 'security', 'account'],
      },
      {
        id: 'u3',
        name: 'Karim Oueslati',
        email: 'karim.oueslati@tritux.com',
        role: 'agent',
        joinDate: '2022-11-10',
        specialties: ['software', 'email', 'hardware'],
      },
    ];
    const split = splitAgentsByCategory(fallback, category);
    specializedAgents.value = split.specialized;
    otherAgents.value = split.others;
    agentOptions.value = split.all;
  }
};

const formatSpecialties = (agent: User) => {
  return agentSpecialties(agent)
    .map(s => categoryLabels[s] || s)
    .join(', ');
};

const initializeFields = () => {
  if (ticket.value) {
    status.value = ticket.value.status;
    assigneeId.value = ticket.value.assignedTo?.id || '';
  }
};

watch(ticket, (newT) => {
  if (newT) {
    status.value = newT.status;
    assigneeId.value = newT.assignedTo?.id || '';
  }
});

onMounted(async () => {
  if (ticketsStore.tickets.length === 0) {
    await ticketsStore.fetchTickets();
  }
  try {
    const fresh = await apiService.getTicket(ticketId.value);
    const idx = ticketsStore.tickets.findIndex(t => t.id === fresh.id);
    if (idx !== -1) ticketsStore.tickets[idx] = fresh;
    else ticketsStore.tickets.unshift(fresh);
    accessDenied.value = false;
  } catch (err: any) {
    if (err?.response?.status === 403 || err?.response?.status === 404) {
      accessDenied.value = true;
    }
  }
  if (isAgent.value && ticket.value?.category) {
    await loadAgentsForTicket(ticket.value.category);
  }
  initializeFields();
});

watch(
  () => ticket.value?.category,
  async (cat) => {
    if (isAgent.value && cat) await loadAgentsForTicket(cat);
  }
);

const canRate = computed(() => {
  if (!ticket.value || !currentUser.value) return false;
  const isResolvedOrClosed = ticket.value.status === 'resolved' || ticket.value.status === 'closed';
  const hasNotRated = !ticket.value.satisfactionRating;
  const isOwner = ticket.value.createdBy.id === currentUser.value.id;
  return isResolvedOrClosed && hasNotRated && isOwner;
});

const tabs = computed(() => [
  { id: 'comments', label: 'Commentaires', icon: MessageSquareIcon, count: ticket.value?.comments.length || 0 },
  { id: 'attachments', label: 'Pièces jointes', icon: PaperclipIcon, count: ticket.value?.attachments.length || 0 },
  { id: 'history', label: 'Historique', icon: ClockIcon, count: ticket.value?.history.length || 0 }
]);

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Ouvert' },
  { value: 'inprogress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' }
];

const statusLabels: Record<string, string> = {
  open: 'Ouvert',
  inprogress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé'
};

const priorityLabel: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente'
};

const getUserInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 1) return `il y a ${d} jours`;
  if (d === 1) return "il y a 1 jour";
  if (h > 1) return `il y a ${h}h`;
  if (h === 1) return "il y a 1h";
  return "il y a quelques minutes";
};

const formatHistoryValue = (field: string, value: string) => {
  if (!value) return '—';
  if (field === 'status') return statusLabels[value] || value;
  return value;
};

const submitComment = async () => {
  if (!newComment.value.trim() || !ticket.value) return;
  await ticketsStore.addComment(ticket.value.id, newComment.value);
  newComment.value = '';
};

const saveAgentChanges = async () => {
  if (!ticket.value) return;

  if (status.value !== ticket.value.status) {
    await ticketsStore.updateTicketStatus(ticket.value.id, status.value);
  }

  const currentAssigneeId = ticket.value.assignedTo?.id || '';
  if (assigneeId.value !== currentAssigneeId) {
    if (!assigneeId.value) {
      await ticketsStore.assignTicket(ticket.value.id, {
        id: '', name: 'Non assigné', email: '', role: 'agent', joinDate: ''
      });
    } else {
      const agent = agentOptions.value.find(a => a.id === assigneeId.value);
      if (agent) {
        await ticketsStore.assignTicket(ticket.value.id, agent);
      }
    }
  }
};

const submitSatisfaction = async (score: number, comment: string) => {
  if (!ticket.value) return;
  await ticketsStore.submitEvaluation(ticket.value.id, score, comment);
  showSatisfaction.value = false;
};
</script>
