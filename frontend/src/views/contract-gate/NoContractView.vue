<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-slate-50">
    <div class="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
      <div class="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">!</div>
      <h1 class="font-display text-xl font-bold text-slate-900 mb-2">Aucun contrat de maintenance actif</h1>
      <p class="text-sm text-slate-500 leading-relaxed mb-6">
        {{ status?.message || 'Votre société ne dispose pas d’un contrat Tritux actif. Contactez le commercial pour souscrire.' }}
      </p>
      <div class="rounded-xl bg-slate-50 border border-slate-100 p-4 text-left text-sm mb-6">
        <p class="font-semibold text-slate-800 mb-1">{{ status?.contact?.label || 'Contact commercial Tritux' }}</p>
        <p class="text-slate-600">{{ status?.contact?.email || 'commercial@tritux.com' }}</p>
        <p class="text-slate-600">{{ status?.contact?.phone || '+216 71 000 111' }}</p>
      </div>
      <a
        :href="`mailto:${status?.contact?.email || 'commercial@tritux.com'}`"
        class="inline-flex px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
        style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
      >
        Nous contacter
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useContractStore } from '../../stores/contract';

const contractStore = useContractStore();
const status = computed(() => contractStore.status);
</script>
