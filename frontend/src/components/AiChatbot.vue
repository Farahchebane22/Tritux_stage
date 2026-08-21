<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
    <transition name="chat-pop">
      <div
        v-if="open"
        class="w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        <header class="px-4 py-3 bg-slate-900 text-white flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold flex items-center gap-2">
              <span class="relative flex h-2 w-2">
                <span
                  class="absolute inline-flex h-full w-full rounded-full opacity-75"
                  :class="provider === 'gemini' || provider === 'openai' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'"
                />
                <span
                  class="relative inline-flex h-2 w-2 rounded-full"
                  :class="provider === 'gemini' || provider === 'openai' ? 'bg-emerald-400' : 'bg-amber-400'"
                />
              </span>
              <BotIcon :size="16" />
              Assistant IT Tritux
            </p>
            <p class="text-[11px] text-slate-300 mt-0.5 truncate">
              {{ providerLabel }}
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="p-1.5 rounded-md hover:bg-white/10 cursor-pointer text-slate-300 hover:text-white"
              title="Nouvelle conversation"
              @click="resetChat"
            >
              <RotateCcwIcon :size="14" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded-md hover:bg-white/10 cursor-pointer"
              @click="close"
            >
              <XIcon :size="16" />
            </button>
          </div>
        </header>

        <div ref="listEl" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="flex"
            :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
              :class="m.role === 'user'
                ? 'bg-slate-900 text-white rounded-br-md whitespace-pre-wrap'
                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'"
            >
              <div
                v-if="m.role === 'assistant'"
                class="chat-md"
                v-html="renderChatMarkdown(m.content)"
              />
              <p v-else>{{ m.content }}</p>

              <ol
                v-if="m.steps?.length && !m.hideSteps"
                class="mt-2 space-y-1.5 list-decimal list-inside text-xs"
                :class="m.role === 'user' ? 'text-slate-200' : 'text-slate-600'"
              >
                <li v-for="(s, si) in m.steps" :key="si">{{ s }}</li>
              </ol>

              <div v-if="m.quickReplies?.length && i === messages.length - 1 && !loading" class="mt-3 flex flex-wrap gap-1.5">
                <button
                  v-for="(q, qi) in m.quickReplies"
                  :key="qi"
                  type="button"
                  class="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-700 cursor-pointer transition-colors"
                  @click="ask(q)"
                >
                  {{ q }}
                </button>
              </div>

              <div v-if="m.meta" class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-if="m.meta.category"
                  class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
                >
                  {{ m.meta.category }}
                </span>
                <span
                  v-if="m.meta.priority"
                  class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700"
                >
                  {{ m.meta.priority }}
                </span>
                <span
                  v-if="m.meta.canSelfResolve"
                  class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"
                >
                  Auto-réparable
                </span>
              </div>

              <button
                v-if="m.meta?.suggestTicket"
                type="button"
                class="mt-2 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                @click="goCreateTicket(m)"
              >
                Créer un ticket avec ce contexte →
              </button>
            </div>
          </div>

          <div v-if="loading" class="flex justify-start">
            <div class="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span class="typing-dot" />
              <span class="typing-dot" style="animation-delay: 0.15s" />
              <span class="typing-dot" style="animation-delay: 0.3s" />
            </div>
          </div>
        </div>

        <form class="p-3 border-t border-slate-200 bg-white flex gap-2" @submit.prevent="send">
          <textarea
            ref="inputEl"
            v-model="draft"
            rows="1"
            placeholder=" (Entrée pour envoyer)"
            class="flex-1 px-3 py-2.5 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none max-h-28"
            :disabled="loading"
            @keydown.enter.exact.prevent="send"
          />
          <button
            type="submit"
            :disabled="loading || !draft.trim()"
            class="px-3 py-2.5 rounded-xl bg-slate-900 text-white disabled:opacity-50 cursor-pointer self-end"
          >
            <SendIcon :size="15" />
          </button>
        </form>
      </div>
    </transition>

    <button
      type="button"
      class="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer"
      :title="open ? 'Fermer' : 'Assistant IA'"
      @click="toggle"
    >
      <XIcon v-if="open" :size="22" />
      <BotIcon v-else :size="22" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { apiService } from '../services/api';
import { useAiChatStore } from '../stores/aiChat';
import { hasInlineList, renderChatMarkdown } from '../utils/chatMarkdown';
import {
  Bot as BotIcon,
  X as XIcon,
  Send as SendIcon,
  RotateCcw as RotateCcwIcon,
} from 'lucide-vue-next';

type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  steps?: string[];
  hideSteps?: boolean;
  quickReplies?: string[];
  meta?: {
    category?: string | null;
    priority?: string | null;
    canSelfResolve?: boolean;
    suggestTicket?: boolean;
    confidence?: number;
  };
};

const router = useRouter();
const aiChat = useAiChatStore();
const { open, seedToken } = storeToRefs(aiChat);

const draft = ref('');
const loading = ref(false);
const listEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const provider = ref<string | null>(null);

const providerLabel = computed(() => {
  if (provider.value === 'gemini') return 'Propulsé par Google Gemini · dialogue naturel';
  if (provider.value === 'openai') return 'Propulsé par OpenAI · dialogue naturel';
  return 'Mode local · ajoutez GEMINI_API_KEY pour un chat type Gemini';
});

const defaultWelcome: ChatMsg = {
  role: 'assistant',
  content:
    "Bonjour ! Je suis l'assistant IT Tritux.Décrivez votre problème, je pose des questions et je vous guide étape par étape.",
  quickReplies: [
    'Mon VPN ne se connecte plus',
    'Mot de passe expiré',
    "J'ai reçu un mail suspect",
    'Outlook plante',
  ],
};

const messages = ref<ChatMsg[]>([{ ...defaultWelcome }]);

onMounted(async () => {
  try {
    const info = await apiService.getAiHealth();
    if (info?.llmProvider) provider.value = info.llmProvider;
  } catch {
    /* ignore — label stays local until first reply */
  }
});

const scrollBottom = async () => {
  await nextTick();
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
};

const focusInput = async () => {
  await nextTick();
  inputEl.value?.focus();
};

const close = () => aiChat.closeChat();
const toggle = () => {
  if (open.value) close();
  else aiChat.openChat();
};

const resetChat = () => {
  messages.value = [{ ...defaultWelcome }];
  draft.value = '';
  scrollBottom();
  focusInput();
};

const buildSeedConversation = (seed: NonNullable<ReturnType<typeof aiChat.consumeSeed>>) => {
  const title = seed.title?.trim() || '';
  const description = seed.description?.trim() || '';
  const userText = [title, description].filter(Boolean).join('\n');

  const steps = seed.selfHelpSteps || [];
  const assistantParts = [
    'J’ai analysé votre demande et appliqué les suggestions au formulaire.',
    seed.category ? `Catégorie proposée : ${seed.category}.` : '',
    seed.priority ? `Priorité proposée : ${seed.priority}.` : '',
    seed.confidence != null ? `Confiance : ${seed.confidence}%.` : '',
    seed.suggestedResponse || '',
    steps.length
      ? 'Voici les premières étapes. Posez-moi une question pour affiner le diagnostic.'
      : 'Posez-moi une question pour affiner le diagnostic (ex: message d’erreur exact, depuis quand, déjà testé…).',
  ].filter(Boolean);

  messages.value = [
    {
      role: 'user',
      content: userText || 'Aide-moi avec mon problème IT',
    },
    {
      role: 'assistant',
      content: assistantParts.join('\n\n'),
      steps,
      quickReplies: [
        'Quelles étapes essayer en premier ?',
        'Le problème continue, que faire ?',
        'Quelles infos mettre dans le ticket ?',
        'Est-ce urgent ?',
      ],
      meta: {
        category: seed.category,
        priority: seed.priority,
        canSelfResolve: !!steps.length,
        suggestTicket: !steps.length,
        confidence: seed.confidence,
      },
    },
  ];
};

watch(
  () => [open.value, seedToken.value] as const,
  async ([isOpen]) => {
    if (!isOpen) return;
    if (aiChat.seed) {
      const payload = aiChat.consumeSeed();
      if (payload) buildSeedConversation(payload);
    } else if (messages.value.length === 0) {
      messages.value = [{ ...defaultWelcome }];
    }
    await scrollBottom();
    await focusInput();
  }
);

const ask = async (text: string) => {
  draft.value = text;
  await send();
};

const send = async () => {
  const text = draft.value.trim();
  if (!text || loading.value) return;
  messages.value.push({ role: 'user', content: text });
  draft.value = '';
  loading.value = true;
  apiService.logChatMessage('user', text);
  await scrollBottom();
  try {
    // Historique SANS le message courant (déjà envoyé dans `message`)
    const history = messages.value
      .slice(0, -1)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await apiService.chatWithAI(text, history);
    if (res.provider) provider.value = res.provider;
    apiService.logChatMessage('assistant', res.reply);
    const hideSteps = hasInlineList(res.reply);
    messages.value.push({
      role: 'assistant',
      content: res.reply,
      steps: res.steps,
      hideSteps,
      quickReplies: res.canSelfResolve
        ? ['Ça a marché', 'Toujours bloqué', 'Comment créer le ticket ?']
        : ['Quelles infos ajouter ?', 'Quelle priorité ?', 'Créer le ticket'],
      meta: {
        category: res.category,
        priority: res.priority,
        canSelfResolve: res.canSelfResolve,
        suggestTicket: res.suggestTicket,
        confidence: res.confidence,
      },
    });
  } catch {
    messages.value.push({
      role: 'assistant',
      content:
        "Je n'arrive pas à joindre le service IA. Vérifiez qu'il tourne sur le port 8000, ou créez un ticket manuellement.",
      meta: { suggestTicket: true },
    });
  } finally {
    loading.value = false;
    await scrollBottom();
    await focusInput();
  }
};

const goCreateTicket = (m: ChatMsg) => {
  const lastUser = [...messages.value].reverse().find((x) => x.role === 'user');
  const q = new URLSearchParams();
  if (lastUser?.content) q.set('prefill', lastUser.content);
  if (m.meta?.category) q.set('category', String(m.meta.category));
  if (m.meta?.priority) q.set('priority', String(m.meta.priority));
  close();
  router.push(`/tickets/create?${q.toString()}`);
};
</script>

<style scoped>
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: all 0.18s ease;
}
.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #94a3b8;
  animation: typing-bounce 1s infinite ease-in-out;
}
@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.chat-md :deep(.chat-p) {
  margin: 0 0 0.45rem;
}
.chat-md :deep(.chat-p:last-child) {
  margin-bottom: 0;
}
.chat-md :deep(.chat-ol),
.chat-md :deep(.chat-ul) {
  margin: 0.35rem 0 0.5rem;
  padding-left: 1.15rem;
}
.chat-md :deep(.chat-ol) {
  list-style: decimal;
}
.chat-md :deep(.chat-ul) {
  list-style: disc;
}
.chat-md :deep(li) {
  margin: 0.2rem 0;
}
.chat-md :deep(strong) {
  font-weight: 600;
  color: #0f172a;
}
.chat-md :deep(.chat-code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8em;
  background: #f1f5f9;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
}
</style>
