import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '../services/api';
import type { EscalationTicket } from '../types';

const POLL_INTERVAL_MS = 30_000;

export const useEscalationStore = defineStore('escalation', () => {
  const tickets = ref<EscalationTicket[]>([]);
  const loading = ref(false);
  const lastFetchedAt = ref<string | null>(null);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const count = computed(() => tickets.value.length);
  const palier3Tickets = computed(() => tickets.value.filter((t) => t.palier >= 3));
  const hasPalier3 = computed(() => palier3Tickets.value.length > 0);

  async function fetchEscalation() {
    loading.value = true;
    try {
      tickets.value = await apiService.getUrgentEscalation();
      lastFetchedAt.value = new Date().toISOString();
    } catch (e) {
      console.warn('[escalation] fetch failed:', e);
    } finally {
      loading.value = false;
    }
  }

  function startPolling() {
    if (intervalId) return;
    void fetchEscalation();
    intervalId = setInterval(() => {
      void fetchEscalation();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    tickets.value = [];
    lastFetchedAt.value = null;
  }

  return {
    tickets,
    loading,
    lastFetchedAt,
    count,
    palier3Tickets,
    hasPalier3,
    fetchEscalation,
    startPolling,
    stopPolling,
  };
});
