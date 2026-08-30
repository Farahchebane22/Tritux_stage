<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="escalation-modal-title"
  >
    <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full border-2 border-rose-500 overflow-hidden">
      <div class="bg-rose-600 px-6 py-4">
        <h2 id="escalation-modal-title" class="font-display text-lg font-bold text-white flex items-center gap-2">
          <AlertTriangleIcon :size="22" />
          Escalade critique — action requise
        </h2>
        <p class="text-rose-100 text-sm mt-1">
          {{ tickets.length }} ticket{{ tickets.length > 1 ? 's' : '' }} urgent{{ tickets.length > 1 ? 's' : '' }} non assigné{{ tickets.length > 1 ? 's' : '' }} depuis plus de 15 minutes
        </p>
      </div>

      <ul class="max-h-64 overflow-y-auto divide-y divide-slate-100 px-6 py-2">
        <li v-for="t in tickets" :key="t.id" class="py-3">
          <p class="font-mono text-xs text-slate-400">{{ t.id }}</p>
          <p class="text-sm font-semibold text-slate-900 mt-0.5">{{ t.title }}</p>
          <p class="text-xs text-slate-500 mt-1">
            {{ t.societeName || t.societeId }} · {{ t.waitingMinutes }} min · palier {{ t.palier }}
          </p>
        </li>
      </ul>

      <div class="px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button
          type="button"
          class="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
          style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
          @click="assignNow"
        >
          Assigner maintenant
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-vue-next';
import type { EscalationTicket } from '../types';

defineProps<{
  open: boolean;
  tickets: EscalationTicket[];
}>();

const emit = defineEmits<{ acknowledged: [] }>();
const router = useRouter();

const assignNow = () => {
  emit('acknowledged');
  router.push({ path: '/tickets', query: { priority: 'urgent', unassigned: '1' } });
};
</script>
