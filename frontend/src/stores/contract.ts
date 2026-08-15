import { defineStore } from 'pinia';
import { ref } from 'vue';

const SESSION_KEY = 'tritux_session_id';
const ACK_KEY = 'tritux_contract_ack';

function ensureSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export const useContractStore = defineStore('contract', () => {
  const loading = ref(false);
  const status = ref<any>(null);
  const acknowledged = ref(false);
  const sessionId = ref(ensureSessionId());

  const fetchStatus = async () => {
    loading.value = true;
    try {
      const { apiService } = await import('../services/api');
      const data = await apiService.getContractAccessStatus(sessionId.value);
      status.value = data;
      if (data.requiresContractAck === false && data.allowed) {
        acknowledged.value = true;
      } else {
        acknowledged.value = sessionStorage.getItem(ACK_KEY) === data?.contrat?.id;
      }
      return data;
    } finally {
      loading.value = false;
    }
  };

  const acknowledge = async () => {
    if (!status.value?.contrat?.id) return;
    const { apiService } = await import('../services/api');
    await apiService.acknowledgeContract(status.value.contrat.id, sessionId.value);
    sessionStorage.setItem(ACK_KEY, status.value.contrat.id);
    acknowledged.value = true;
  };

  const clear = () => {
    status.value = null;
    acknowledged.value = false;
    sessionStorage.removeItem(ACK_KEY);
  };

  const needsGate = () => {
    if (!status.value) return false;
    if (!status.value.allowed) return true;
    if (status.value.requiresContractAck && !acknowledged.value) return true;
    return false;
  };

  return {
    loading,
    status,
    acknowledged,
    sessionId,
    fetchStatus,
    acknowledge,
    clear,
    needsGate,
  };
});
