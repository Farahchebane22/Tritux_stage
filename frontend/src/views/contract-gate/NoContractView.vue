<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-slate-50">
    <div v-if="!showCreateForm" class="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
      <div class="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">!</div>
      <h1 class="font-display text-xl font-bold text-slate-900 mb-2">Aucun contrat de maintenance actif</h1>
      <p class="text-sm text-slate-500 leading-relaxed mb-6">
        {{ status?.message || 'Votre société ne dispose pas d’un contrat Tritux actif.' }}
      </p>

      <button
        v-if="isClientAdmin"
        type="button"
        @click="showCreateForm = true"
        class="w-full mb-3 inline-flex justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
        style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
      >
        Créer mon contrat de maintenance
      </button>

      <div class="rounded-xl bg-slate-50 border border-slate-100 p-4 text-left text-sm mb-6">
        <p class="font-semibold text-slate-800 mb-1">{{ status?.contact?.label || 'Contact commercial Tritux' }}</p>
        <p class="text-slate-600">{{ status?.contact?.email || 'commercial@tritux.com' }}</p>
        <p class="text-slate-600">{{ status?.contact?.phone || '+216 71 000 111' }}</p>
      </div>
      <a
        :href="`mailto:${status?.contact?.email || 'commercial@tritux.com'}`"
        class="inline-flex px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200"
      >
        Nous contacter
      </a>
    </div>

    <div v-else class="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <button type="button" class="text-xs text-slate-400 hover:text-slate-600 mb-4 cursor-pointer" @click="showCreateForm = false">← Retour</button>
      <h1 class="font-display text-lg font-bold text-slate-900 mb-1">Créer votre contrat de maintenance</h1>
      <p class="text-sm text-slate-500 mb-5">Définissez le niveau de service souhaité. Vous pourrez le modifier ensuite depuis la barre latérale.</p>

      <form class="space-y-4" @submit.prevent="submitContract">
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

        <p v-if="error" class="text-xs text-rose-600">{{ error }}</p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
          style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
        >
          {{ submitting ? 'Création…' : 'Créer le contrat et accéder à la plateforme' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useContractStore } from '../../stores/contract';
import { useAuthStore } from '../../stores/auth';
import { apiService } from '../../services/api';

const router = useRouter();
const contractStore = useContractStore();
const authStore = useAuthStore();
const status = computed(() => contractStore.status);
const isClientAdmin = computed(() => authStore.user?.role === 'CLIENT_ADMIN');

const showCreateForm = ref(false);
const submitting = ref(false);
const error = ref('');

const form = reactive({
  type_contrat: '5/7',
  heures_ouvrees: '08:00-18:00',
  canal_notification_urgence: 'email',
  date_fin: '',
});

const submitContract = async () => {
  submitting.value = true;
  error.value = '';
  try {
    await apiService.createContract({
      type_contrat: form.type_contrat,
      canal_notification_urgence: form.canal_notification_urgence,
      heures_ouvrees: form.heures_ouvrees,
      date_fin: form.date_fin || undefined,
    });
    contractStore.clear();
    await contractStore.fetchStatus();
    router.push('/contract/recap');
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Impossible de créer le contrat.';
  } finally {
    submitting.value = false;
  }
};
</script>
