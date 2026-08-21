<template>
  <div class="p-6 md:p-8 max-w-xl mx-auto">
    <button type="button" class="text-xs text-slate-400 hover:text-slate-600 mb-4 cursor-pointer" @click="router.push('/')">← Retour au dashboard</button>
    <h1 class="font-display text-2xl font-bold text-slate-900">Mon contrat de maintenance</h1>
    <p class="text-sm text-slate-500 mt-1">Modifiez le niveau de service de votre société. Les changements s'appliquent immédiatement.</p>

    <div v-if="loading" class="mt-8 text-sm text-slate-400">Chargement…</div>

    <form v-else-if="contrat" class="mt-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-4" @submit.prevent="save">
      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1.5">Type de contrat</label>
        <select v-model="form.type_contrat" class="w-full px-3.5 py-2.5 rounded-lg text-sm border border-slate-200">
          <option value="5/7">5/7 — lundi-vendredi, heures ouvrées</option>
          <option value="8/5">8/5 — lundi-vendredi étendu</option>
          <option value="24/7">24/7 — couverture continue</option>
        </select>
      </div>
      <div v-if="form.type_contrat !== '24/7'">
        <label class="block text-xs font-medium text-slate-700 mb-1.5">Heures ouvrées</label>
        <input v-model="form.heures_ouvrees" placeholder="08:00-18:00" class="w-full px-3.5 py-2.5 rounded-lg text-sm border border-slate-200" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1.5">Canal de notification d'urgence</label>
        <select v-model="form.canal_notification_urgence" class="w-full px-3.5 py-2.5 rounded-lg text-sm border border-slate-200">
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="telephone">Téléphone</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1.5">Date de fin</label>
        <input v-model="form.date_fin" type="date" class="w-full px-3.5 py-2.5 rounded-lg text-sm border border-slate-200" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1.5">Conditions (texte affiché à vos utilisateurs)</label>
        <textarea v-model="form.conditions_texte" rows="4" class="w-full px-3.5 py-2.5 rounded-lg text-sm border border-slate-200"></textarea>
      </div>

      <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>
      <p v-if="success" class="text-xs text-emerald-600">Contrat mis à jour avec succès.</p>

      <button
        type="submit"
        :disabled="saving"
        class="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
        style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
      >
        {{ saving ? 'Enregistrement…' : 'Enregistrer les modifications' }}
      </button>
    </form>

    <p v-else class="mt-8 text-sm text-slate-400">Aucun contrat trouvé.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useContractStore } from '../../stores/contract';
import { apiService } from '../../services/api';

const router = useRouter();
const contractStore = useContractStore();
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const success = ref(false);

const contrat = computed(() => contractStore.status?.contrat);

const form = reactive({
  type_contrat: '5/7',
  heures_ouvrees: '08:00-18:00',
  canal_notification_urgence: 'email',
  date_fin: '',
  conditions_texte: '',
});

onMounted(async () => {
  if (!contractStore.status) await contractStore.fetchStatus();
  if (contrat.value) {
    form.type_contrat = contrat.value.type_contrat;
    form.heures_ouvrees = contrat.value.heures_ouvrees;
    form.canal_notification_urgence = contrat.value.canal_notification_urgence;
    form.date_fin = (contrat.value.date_fin || '').slice(0, 10);
    form.conditions_texte = contrat.value.conditions_texte || '';
  }
  loading.value = false;
});

const save = async () => {
  if (!contrat.value?.id) return;
  saving.value = true;
  error.value = '';
  success.value = false;
  try {
    await apiService.updateContract(contrat.value.id, { ...form });
    contractStore.clear();
    await contractStore.fetchStatus();
    success.value = true;
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Impossible de mettre à jour le contrat.';
  } finally {
    saving.value = false;
  }
};
</script>
