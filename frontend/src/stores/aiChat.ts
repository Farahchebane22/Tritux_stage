import { defineStore } from 'pinia';
import { ref } from 'vue';

export type AiChatSeed = {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  suggestedResponse?: string;
  selfHelpSteps?: string[];
  confidence?: number;
};

export const useAiChatStore = defineStore('aiChat', () => {
  const open = ref(false);
  const seed = ref<AiChatSeed | null>(null);
  const seedToken = ref(0);

  const openChat = (payload?: AiChatSeed) => {
    if (payload) {
      seed.value = payload;
      seedToken.value += 1;
    }
    open.value = true;
  };

  const closeChat = () => {
    open.value = false;
  };

  const consumeSeed = () => {
    const current = seed.value;
    seed.value = null;
    return current;
  };

  return {
    open,
    seed,
    seedToken,
    openChat,
    closeChat,
    consumeSeed,
  };
});
