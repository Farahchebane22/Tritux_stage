<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="font-display text-2xl font-bold text-slate-900">Sociétés clientes</h1>
        <p class="text-slate-500 text-sm mt-0.5">
          {{ rows.length }} société{{ rows.length !== 1 ? 's' : '' }} · cliquez sur une société pour voir et assigner ses tickets
        </p>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-slate-400 py-12 text-center">Chargement…</div>

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="row in rows"
        :key="row.societe.id"
        @click="goToTickets(row.societe.id)"
        class="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
        style="borderColor: var(--border)"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-display font-bold text-slate-900">{{ row.societe.nom }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ row.societe.secteur_activite || 'Secteur non renseigné' }}</p>
          </div>
          <span
            v-if="row.contrat"
            class="text-[10px] font-semibold uppercase px-2 py-1 rounded-full"
            :class="row.contratActif ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
          >
            {{ row.contratActif ? 'Contrat actif' : 'Contrat expiré' }}
          </span>
          <span v-else class="text-[10px] font-semibold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">
            Sans contrat
          </span>
        </div>

        <div v-if="row.contrat" class="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span class="font-semibold text-slate-700">{{ row.contrat.type_contrat }}</span>
          <span>·</span>
          <span>Jusqu'au {{ formatDate(row.contrat.date_fin) }}</span>
        </div>

        <div class="mt-4 pt-4 border-t flex items-center justify-between" style="borderColor: var(--border)">
          <div class="flex items-center gap-3 text-xs">
            <span class="text-slate-500">
              <strong class="text-slate-800">{{ row.total }}</strong> tickets
            </span>
            <span v-if="row.ouverts" class="text-amber-600 font-semibold">{{ row.ouverts }} ouverts</span>
          </div>
          <ChevronRightIcon :size="14" class="text-slate-300" />
        </div>
      </div>

      <div v-if="!rows.length" class="col-span-full text-center py-12 text-slate-400 text-sm">
        Aucune société cliente pour le moment.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiService } from '../services/api';
import { useTicketsStore } from '../stores/tickets';
import { ChevronRight as ChevronRightIcon } from 'lucide-vue-next';

const router = useRouter();
const ticketsStore = useTicketsStore();
const loading = ref(true);
const rows = ref<any[]>([]);

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

const goToTickets = (societeId: string) => {
  router.push({ path: '/tickets', query: { societeId } });
};

onMounted(async () => {
  try {
    if (ticketsStore.tickets.length === 0) {
      await ticketsStore.fetchTickets();
    }
    const societes = await apiService.getSocietes();

    const built = await Promise.all(
      societes.map(async (societe: any) => {
        let contrat: any = null;
        try {
          const contrats = await apiService.getSocieteContrats(societe.id);
          const today = new Date().toISOString().slice(0, 10);
          contrat =
            contrats.find((c: any) => c.statut === 'actif' && c.date_fin >= today) ||
            contrats.sort((a: any, b: any) => (a.date_fin < b.date_fin ? 1 : -1))[0] ||
            null;
        } catch {
          contrat = null;
        }

        const societeTickets = ticketsStore.tickets.filter((t: any) => t.societeId === societe.id);
        const ouverts = societeTickets.filter((t: any) => t.status === 'open' || t.status === 'inprogress').length;

        return {
          societe,
          contrat,
          contratActif: contrat ? contrat.statut === 'actif' && contrat.date_fin >= new Date().toISOString().slice(0, 10) : false,
          total: societeTickets.length,
          ouverts,
        };
      })
    );

    rows.value = built;
  } finally {
    loading.value = false;
  }
});
</script>
