<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-slate-100">
    <div v-if="loading" class="text-slate-400 text-sm">Vérification du contrat…</div>
    <div v-else-if="contrat" class="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <header class="px-6 py-5 bg-slate-900 text-white">
        <p class="text-xs uppercase tracking-wide text-slate-300 mb-1">Récapitulatif contrat</p>
        <h1 class="font-display text-xl font-bold">{{ societe?.nom || 'Votre société' }}</h1>
        <p class="text-sm text-slate-300 mt-1">Type {{ contrat.type_contrat }} · valable jusqu’au {{ formatDate(contrat.date_fin) }}</p>
      </header>

      <div class="p-6 space-y-5">
        <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{{ contrat.conditions_texte }}</p>

        <div class="grid sm:grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p class="text-[11px] uppercase text-slate-400 font-semibold">Couverture</p>
            <p class="font-medium text-slate-800 mt-1">{{ contrat.jours_ouvres }}</p>
            <p class="text-slate-600">{{ contrat.heures_ouvrees }}</p>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p class="text-[11px] uppercase text-slate-400 font-semibold">Urgences</p>
            <p class="font-medium text-slate-800 mt-1">Canal {{ contrat.canal_notification_urgence }}</p>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">SLA par priorité</p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400 border-b border-slate-100">
                <th class="py-2">Priorité</th>
                <th>Délai réponse</th>
                <th>Notif. immédiate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in contrat.slaRegles || []" :key="r.priorite" class="border-b border-slate-50">
                <td class="py-2 font-medium capitalize">{{ r.priorite }}</td>
                <td>{{ r.delai_reponse_minutes }} min</td>
                <td>{{ r.notification_immediate ? `Oui (${r.canal})` : 'Non' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          type="button"
          class="w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
          @click="accept"
        >
          J’ai compris, accéder à la plateforme
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContractStore } from '../../stores/contract';

const router = useRouter();
const contractStore = useContractStore();
const loading = computed(() => contractStore.loading);
const contrat = computed(() => contractStore.status?.contrat);
const societe = computed(() => contractStore.status?.societe);

onMounted(async () => {
  if (!contractStore.status) await contractStore.fetchStatus();
});

const formatDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

const accept = async () => {
  await contractStore.acknowledge();
  router.push('/');
};
</script>
