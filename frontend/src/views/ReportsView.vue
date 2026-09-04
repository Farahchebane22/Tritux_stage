<template>
  <div class="p-6 md:p-8 max-w-4xl mx-auto">
    <h1 class="font-display text-2xl font-bold text-slate-900">Rapports société</h1>
    <p class="text-sm text-slate-500 mt-1">
      Historique tickets, taux de respect SLA, export archivé.
    </p>

    <form class="mt-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-4" @submit.prevent="generate">
      <div class="grid sm:grid-cols-3 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600">Société ID</label>
          <input
            v-model="societeId"
            required
            class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            placeholder="soc_demo"
          />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600">Début</label>
          <input v-model="debut" type="date" required class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600">Fin</label>
          <input v-model="fin" type="date" required class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        </div>
      </div>
      <button
        type="submit"
        :disabled="loading"
        class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
      >
        {{ loading ? 'Génération…' : 'Générer le rapport' }}
      </button>
      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
    </form>

    <div v-if="last" class="mt-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div class="px-5 py-4 flex items-center justify-between" style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%)">
        <div>
          <p class="text-white font-semibold text-sm">Dernier rapport généré</p>
          <p class="text-slate-400 text-xs mt-0.5">{{ debut }} → {{ fin }} · {{ societeId }}</p>
        </div>
        <button
          v-if="last.downloadPath"
          type="button"
          :disabled="downloading"
          @click="download"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
        >
          ⬇ {{ downloading ? 'Téléchargement…' : 'Télécharger le PDF' }}
        </button>
      </div>

      <div class="p-5">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
            <p class="text-2xl font-bold text-slate-900">{{ last.resume.ticketsTotal }}</p>
            <p class="text-[11px] text-slate-500 mt-0.5">Tickets total</p>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
            <p class="text-2xl font-bold text-emerald-600">{{ last.resume.ticketsResolus }}</p>
            <p class="text-[11px] text-slate-500 mt-0.5">Résolus</p>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
            <p class="text-2xl font-bold text-amber-600">{{ last.resume.ticketsOuverts }}</p>
            <p class="text-[11px] text-slate-500 mt-0.5">Ouverts</p>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
            <p class="text-2xl font-bold text-blue-600">
              {{ last.resume.tauxRespectSla != null ? Math.round(last.resume.tauxRespectSla * 100) + '%' : 'N/A' }}
            </p>
            <p class="text-[11px] text-slate-500 mt-0.5">Respect SLA</p>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 mt-5">
          <div>
            <p class="text-xs font-semibold text-slate-600 mb-2">Répartition par priorité</p>
            <div class="space-y-1.5">
              <div v-for="(count, key) in last.resume.parPriorite" :key="key" class="flex items-center gap-2 text-xs">
                <span class="w-14 text-slate-500 capitalize">{{ priorityLabels[key] || key }}</span>
                <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :style="{ width: barWidth(count, last.resume.parPriorite), background: priorityColors[key] || '#94A3B8' }"
                  ></div>
                </div>
                <span class="w-5 text-right font-semibold text-slate-700">{{ count }}</span>
              </div>
            </div>
          </div>
          <div>
            <p class="text-xs font-semibold text-slate-600 mb-2">Répartition par statut</p>
            <div class="space-y-1.5">
              <div v-for="(count, key) in last.resume.parStatut" :key="key" class="flex items-center gap-2 text-xs">
                <span class="w-16 text-slate-500 capitalize">{{ statusLabels[key] || key }}</span>
                <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-indigo-400"
                    :style="{ width: barWidth(count, last.resume.parStatut) }"
                  ></div>
                </div>
                <span class="w-5 text-right font-semibold text-slate-700">{{ count }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Temps moyen de résolution : <strong class="text-slate-700">{{ last.resume.tempsMoyenResolutionHeures ?? 'N/A' }} h</strong></span>
          <span>Interactions chatbot : <strong class="text-slate-700">{{ last.resume.chatbotInteractions }}</strong></span>
        </div>
      </div>
    </div>

    <ul class="mt-6 space-y-2">
      <li
        v-for="r in archives"
        :key="r.id"
        class="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm flex justify-between gap-3"
      >
        <span>{{ r.periode_debut }} → {{ r.periode_fin }} · {{ r.date_generation?.slice(0, 10) }}</span>
        <span class="text-slate-400 font-mono text-xs">{{ r.id }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const societeId = ref(auth.user?.societeId || 'soc_demo');
const debut = ref(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
const fin = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);
const error = ref('');
const last = ref<any>(null);
const archives = ref<any[]>([]);

const apiBase =
  (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__?.VITE_API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';
const downloadUrl = computed(() =>
  last.value?.id ? `${apiBase}/reports/${last.value.id}/download` : '#'
);

const priorityLabels: Record<string, string> = { urgent: 'Urgente', high: 'Haute', medium: 'Moyenne', low: 'Basse' };
const priorityColors: Record<string, string> = { urgent: '#DC2626', high: '#EA580C', medium: '#D97706', low: '#65A30D' };
const statusLabels: Record<string, string> = { open: 'Ouvert', inprogress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };

const downloading = ref(false);
const download = async () => {
  if (!last.value?.id) return;
  downloading.value = true;
  try {
    await apiService.downloadReport(last.value.id, `rapport-${societeId.value}-${last.value.id}.pdf`);
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Téléchargement impossible.';
  } finally {
    downloading.value = false;
  }
};

const barWidth = (count: number, all: Record<string, number>) => {
  const max = Math.max(1, ...Object.values(all));
  return `${Math.max(4, Math.round((count / max) * 100))}%`;
};

onMounted(async () => {
  try {
    archives.value = await apiService.listReports(societeId.value);
  } catch {
    archives.value = [];
  }
});

const generate = async () => {
  loading.value = true;
  error.value = '';
  try {
    last.value = await apiService.generateReport(societeId.value, debut.value, fin.value);
    archives.value = await apiService.listReports(societeId.value);
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Échec génération';
  } finally {
    loading.value = false;
  }
};
</script>
