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

    <div v-if="last" class="mt-6 bg-white border border-slate-200 rounded-2xl p-5">
      <h2 class="font-semibold text-slate-900">Dernier rapport</h2>
      <pre class="mt-3 text-xs bg-slate-50 p-3 rounded-lg overflow-auto">{{ JSON.stringify(last.resume, null, 2) }}</pre>
      <a
        v-if="last.downloadPath"
        :href="downloadUrl"
        class="inline-block mt-3 text-sm text-blue-700 font-semibold hover:underline"
        target="_blank"
      >
        Télécharger l’export
      </a>
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

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const downloadUrl = computed(() =>
  last.value?.id ? `${apiBase}/reports/${last.value.id}/download` : '#'
);

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
