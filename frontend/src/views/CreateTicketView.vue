<template>
  <div class="p-8">
    <button
      @click="$router.push('/tickets')"
      class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors cursor-pointer"
    >
      <ChevronLeftIcon :size="15" />
      Retour aux tickets
    </button>

    <div v-if="submitted" class="p-8 flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div class="text-center max-w-sm">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-100">
          <span class="text-3xl">✅</span>
        </div>
        <h2 class="font-display text-xl font-bold text-slate-900 mb-2">Ticket créé avec succès !</h2>
        <p class="text-slate-500 text-sm mb-1">Votre ticket a été soumis.</p>
        <p class="text-slate-400 text-sm mb-6">Un agent IT va traiter votre demande dans les meilleurs délais.</p>
        <div class="flex gap-3 justify-center">
          <button
            @click="viewNewTicket"
            class="px-4 py-2.5 rounded-lg text-sm font-medium border text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            style="borderColor: var(--border)"
          >
            Voir le ticket
          </button>
          <button
            @click="$router.push('/tickets')"
            class="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
            style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
          >
            Mes tickets
          </button>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="mb-6">
        <h1 class="font-display text-2xl font-bold text-slate-900">Créer un ticket</h1>
        <p class="text-slate-500 text-sm mt-0.5">Décrivez votre problème, l'IA suggère automatiquement la catégorie et la priorité.</p>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <!-- Main form — 2/3 -->
          <div class="xl:col-span-2 space-y-5">
            <div class="bg-white rounded-xl p-6 border space-y-5" style="borderColor: var(--border)">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">
                  Titre du ticket <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  v-model="title"
                  placeholder="Ex: Impossible de se connecter au VPN depuis hier matin"
                  class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  style="borderColor: var(--border)"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description détaillée <span class="text-red-500">*</span>
                </label>
                <textarea
                  required
                  v-model="description"
                  placeholder="Décrivez le problème en détail : depuis quand, ce que vous avez essayé, les messages d'erreur éventuels..."
                  rows="5"
                  class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors"
                  style="borderColor: var(--border)"
                />
                <div class="flex justify-end mt-1">
                  <span class="text-xs text-slate-400">{{ description.length }} caractères</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5">Catégorie</label>
                  <select
                    v-model="category"
                    class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white cursor-pointer"
                    style="borderColor: var(--border)"
                  >
                    <option value="">Sélectionner (ou laisser à l'IA)</option>
                    <option v-for="o in categoryOptions" :key="o.value" :value="o.value">
                      {{ o.emoji }} {{ o.label }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1.5">
                    Priorité <span class="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <select
                    v-model="priority"
                    class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white cursor-pointer"
                    style="borderColor: var(--border)"
                  >
                    <option value="">Laisser à l'IA</option>
                    <option v-for="o in priorityOptions" :key="o.value" :value="o.value">
                      {{ o.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- File upload -->
            <div class="bg-white rounded-xl p-6 border" style="borderColor: var(--border)">
              <label class="block text-xs font-semibold text-slate-700 mb-3">Pièces jointes</label>
              <div
                :class="[
                  'border-2 border-dashed rounded-xl p-6 text-center transition-all duration-150 cursor-pointer',
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                ]"
                @dragover.prevent="dragOver = true"
                @dragleave="dragOver = false"
                @drop.prevent="onDrop"
                @click="triggerFileSelect"
              >
                <UploadIcon :size="20" class="mx-auto mb-2 text-slate-400" />
                <p class="text-sm text-slate-500 font-medium">Glisser-déposer ou cliquer pour sélectionner</p>
                <p class="text-xs text-slate-400 mt-0.5">PNG, JPG, PDF, TXT, LOG — max 10 MB par fichier</p>
                <input ref="fileInput" type="file" multiple class="hidden" @change="onFileChange" />
              </div>

              <div v-if="files.length > 0" class="mt-3 space-y-2">
                <div v-for="(f, i) in files" :key="i" class="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                  <ImageIcon v-if="f.type.startsWith('image/')" :size="14" class="text-blue-500 flex-shrink-0" />
                  <FileTextIcon v-else :size="14" class="text-slate-400 flex-shrink-0" />
                  <span class="text-xs text-slate-700 flex-1 truncate">{{ f.name }}</span>
                  <span class="text-xs text-slate-400">{{ f.size }}</span>
                  <button
                    type="button"
                    @click="removeFile(i)"
                    class="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <XIcon :size="13" />
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-3 justify-end">
              <button
                type="button"
                @click="$router.push('/tickets')"
                class="px-5 py-2.5 rounded-lg text-sm font-medium border text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                style="borderColor: var(--border)"
              >
                Annuler
              </button>
              <button
                type="submit"
                class="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
                style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
              >
                Soumettre le ticket
              </button>
            </div>
          </div>

          <!-- AI panel — 1/3 -->
          <div class="xl:col-span-1">
            <div
              class="rounded-xl border sticky top-6 overflow-hidden"
              :style="{
                borderColor: aiSuggestion ? '#7C3AED40' : 'var(--border)',
                background: aiSuggestion ? 'linear-gradient(145deg, #FAF5FF, #EFF6FF)' : 'white'
              }"
            >
              <div
                class="px-4 py-3.5 border-b flex items-center gap-2"
                :style="{
                  borderColor: aiSuggestion ? '#7C3AED30' : 'var(--border)',
                  background: aiSuggestion ? 'linear-gradient(90deg, #7C3AED, #1D4ED8)' : 'var(--muted)'
                }"
              >
                <SparklesIcon :size="14" :class="aiSuggestion ? 'text-white' : 'text-violet-500'" />
                <span :class="['text-xs font-semibold', aiSuggestion ? 'text-white' : 'text-slate-700']">
                  Suggestion IA
                </span>
                <span v-if="aiSuggestion" class="ml-auto text-[10px] font-mono text-white/70">
                  {{ aiSuggestion.confidence }}% confiance
                </span>
              </div>

              <div class="p-4">
                <div v-if="aiLoading" class="flex flex-col items-center py-6 gap-3">
                  <Loader2Icon :size="20" class="animate-spin text-violet-500" />
                  <p class="text-xs text-slate-500 text-center">Analyse en cours…</p>
                </div>

                <div v-else-if="aiSuggestion" class="space-y-4">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="p-3 rounded-lg bg-white border" style="borderColor: #E9D5FF">
                      <p class="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-1">Catégorie</p>
                      <p class="text-sm font-semibold text-slate-900">
                        {{ catLabel[aiSuggestion.category] }}
                      </p>
                    </div>
                    <div class="p-3 rounded-lg bg-white border" style="borderColor: #E9D5FF">
                      <p class="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-1">Priorité</p>
                      <p class="text-sm font-semibold" :style="{ color: priorityOptions.find(p => p.value === aiSuggestion!.priority)?.color }">
                        {{ priorityLabel[aiSuggestion.priority] }}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p class="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-2">Réponse suggérée</p>
                    <div class="p-3 rounded-lg bg-white border text-xs text-slate-600 leading-relaxed" style="borderColor: #E9D5FF">
                      {{ aiSuggestion.suggestedResponse }}
                    </div>
                  </div>

                  <div
                    v-if="aiSuggestion.selfHelpSteps?.length"
                    class="p-3 rounded-lg border bg-emerald-50/60"
                    style="borderColor: #A7F3D0"
                  >
                    <p class="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                      {{ aiSuggestion.canSelfResolve ? 'Auto-assistance possible' : 'Étapes recommandées' }}
                    </p>
                    <ol class="space-y-1.5 list-decimal list-inside text-xs text-slate-700">
                      <li v-for="(step, i) in aiSuggestion.selfHelpSteps" :key="i">{{ step }}</li>
                    </ol>
                  </div>

                  <div
                    v-if="applied"
                    class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium"
                  >
                    Suggestions appliquées au formulaire. Continuez la discussion avec l’assistant.
                  </div>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      @click="applyAISuggestions"
                      class="w-full py-2.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                      style="background: linear-gradient(90deg, #7C3AED, #1D4ED8)"
                    >
                      Appliquer les suggestions
                    </button>
                    <button
                      type="button"
                      @click="openSuggestionChat"
                      class="w-full py-2.5 rounded-lg text-xs font-semibold border border-violet-200 text-violet-700 bg-white hover:bg-violet-50 transition-all cursor-pointer"
                    >
                      Discuter avec le chatbot
                    </button>
                  </div>
                </div>

                <div v-else class="flex flex-col items-center py-6 gap-2 text-center">
                  <AlertCircleIcon :size="20" class="text-slate-300" />
                  <p class="text-xs text-slate-400 leading-relaxed">
                    Commencez à saisir le titre et la description pour obtenir des suggestions automatiques.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTicketsStore } from '../stores/tickets';
import { useAiChatStore } from '../stores/aiChat';
import {
  Upload as UploadIcon,
  Sparkles as SparklesIcon,
  X as XIcon,
  FileText as FileTextIcon,
  Image as ImageIcon,
  AlertCircle as AlertCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  Loader2 as Loader2Icon
} from 'lucide-vue-next';
import type { TicketCategory, TicketPriority } from '../types';

const router = useRouter();
const route = useRoute();
const ticketsStore = useTicketsStore();
const aiChat = useAiChatStore();

const title = ref('');
const description = ref('');
const category = ref<TicketCategory | ''>('');
const priority = ref<TicketPriority | ''>('');
const files = ref<{ name: string; size: string; type: string }[]>([]);
const aiSuggestion = ref<any>(null);
const aiLoading = ref(false);
const submitted = ref(false);
const dragOver = ref(false);
const createdTicketId = ref('');
const applied = ref(false);

const fileInput = ref<HTMLInputElement | null>(null);
let aiTimeout: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  const prefill = route.query.prefill;
  const qTitle = route.query.title;
  if (typeof prefill === 'string' && prefill.trim()) {
    description.value = prefill.trim();
  }
  if (typeof qTitle === 'string' && qTitle.trim()) {
    title.value = qTitle.trim().slice(0, 120);
  } else if (typeof prefill === 'string' && prefill.trim()) {
    title.value = prefill.trim().slice(0, 80);
  }
  const cat = route.query.category;
  if (typeof cat === 'string') category.value = cat as TicketCategory;
  const prio = route.query.priority;
  if (typeof prio === 'string') priority.value = prio as TicketPriority;
});

const categoryOptions: { value: TicketCategory; label: string; emoji: string }[] = [
  { value: 'hardware', label: 'Matériel', emoji: '🖥' },
  { value: 'software', label: 'Logiciel', emoji: '💻' },
  { value: 'network', label: 'Réseau', emoji: '🌐' },
  { value: 'account', label: 'Compte & accès', emoji: '🔑' },
  { value: 'email', label: 'Email', emoji: '✉️' },
  { value: 'security', label: 'Sécurité', emoji: '🛡' },
  { value: 'other', label: 'Autre', emoji: '📋' },
];

const priorityOptions: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Basse', color: '#10B981' },
  { value: 'medium', label: 'Moyenne', color: '#F59E0B' },
  { value: 'high', label: 'Haute', color: '#F97316' },
  { value: 'urgent', label: 'Urgente', color: '#EF4444' },
];

const priorityLabel = { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' };
const catLabel: Record<TicketCategory, string> = {
  hardware: 'Matériel',
  software: 'Logiciel',
  network: 'Réseau',
  account: 'Compte & accès',
  email: 'Email',
  security: 'Sécurité',
  other: 'Autre',
};

// Watch for inputs to trigger AI Suggestion
watch([title, description], () => {
  if (aiTimeout) clearTimeout(aiTimeout);
  applied.value = false;
  const text = `${title.value} ${description.value}`.trim();
  if (text.length > 20) {
    aiLoading.value = true;
    aiTimeout = setTimeout(async () => {
      const sug = await ticketsStore.getAISuggestion(title.value, description.value);
      aiSuggestion.value = sug;
      aiLoading.value = false;
    }, 800);
  } else {
    aiSuggestion.value = null;
    aiLoading.value = false;
  }
});

onUnmounted(() => {
  if (aiTimeout) clearTimeout(aiTimeout);
});

const triggerFileSelect = () => {
  fileInput.value?.click();
};

const handleFiles = (fileList: FileList | null) => {
  if (!fileList) return;
  const maxBytes = 10 * 1024 * 1024;
  const newFiles = Array.from(fileList)
    .filter(f => {
      if (f.size > maxBytes) {
        alert(`Le fichier "${f.name}" dépasse 10 Mo et a été ignoré.`);
        return false;
      }
      return true;
    })
    .map(f => ({
      name: f.name,
      size: f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
      type: f.type
    }));
  files.value.push(...newFiles);
};

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  handleFiles(input.files);
};

const onDrop = (e: DragEvent) => {
  dragOver.value = false;
  handleFiles(e.dataTransfer?.files || null);
};

const removeFile = (index: number) => {
  files.value.splice(index, 1);
};

const applyAISuggestions = async () => {
  if (!aiSuggestion.value) return;

  const nextCategory = aiSuggestion.value.category as TicketCategory;
  const nextPriority = aiSuggestion.value.priority as TicketPriority;

  // Force update selects (ensure reactive assignment)
  category.value = '' as any;
  priority.value = '' as any;
  await nextTick();
  category.value = nextCategory;
  priority.value = nextPriority;
  applied.value = true;

  // Open chatbot discussion with ticket context
  aiChat.openChat({
    title: title.value,
    description: description.value,
    category: nextCategory,
    priority: nextPriority,
    suggestedResponse: aiSuggestion.value.suggestedResponse,
    selfHelpSteps: aiSuggestion.value.selfHelpSteps || [],
    confidence: aiSuggestion.value.confidence,
  });
};

const openSuggestionChat = () => {
  if (!aiSuggestion.value) {
    aiChat.openChat({
      title: title.value,
      description: description.value,
    });
    return;
  }
  applyAISuggestions();
};

const handleSubmit = async () => {
  const finalCategory = category.value || aiSuggestion.value?.category || 'other';
  const finalPriority = priority.value || aiSuggestion.value?.priority || 'medium';
  
  const newTicket = await ticketsStore.createTicket(
    title.value,
    description.value,
    finalCategory,
    finalPriority,
    files.value,
    aiSuggestion.value || undefined
  );
  
  if (newTicket) {
    createdTicketId.value = newTicket.id;
  }
  
  submitted.value = true;
};

const viewNewTicket = () => {
  router.push(`/tickets/${createdTicketId.value}`);
};
</script>
