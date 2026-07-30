<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="$emit('close')" />
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <!-- Header -->
      <div
        class="px-6 py-5 border-b"
        style="borderColor: var(--border); background: linear-gradient(135deg, #EFF6FF 0%, #FAF5FF 100%)"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-display text-base font-bold text-slate-900">Évaluer la résolution</h3>
            <p class="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{{ ticketTitle }}</p>
          </div>
          <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 transition-colors ml-3 mt-0.5 cursor-pointer">
            <XIcon :size="18" />
          </button>
        </div>
      </div>

      <div v-if="submitted" class="px-6 py-10 text-center">
        <div class="text-4xl mb-3">🎉</div>
        <h4 class="font-display text-lg font-bold text-slate-900 mb-1">Merci pour votre retour !</h4>
        <p class="text-sm text-slate-500 mb-5">Votre évaluation aide l'équipe à améliorer la qualité du support.</p>
        <button
          @click="$emit('close')"
          class="px-6 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer"
          style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
        >
          Fermer
        </button>
      </div>

      <div v-else class="px-6 py-6 space-y-5">
        <div>
          <p class="text-sm font-medium text-slate-700 mb-4 text-center">
            Comment évaluez-vous la résolution de ce ticket ?
          </p>
          <div class="flex justify-center gap-2">
            <button
              v-for="s in [1, 2, 3, 4, 5]"
              :key="s"
              type="button"
              @click="score = s"
              @mouseenter="hover = s"
              @mouseleave="hover = 0"
              class="p-1 transition-transform duration-100 hover:scale-110 cursor-pointer"
            >
              <StarIcon
                :size="32"
                :fill="(hover || score) >= s ? (colors[(hover || score)] || '#F59E0B') : 'none'"
                :stroke="(hover || score) >= s ? (colors[(hover || score)] || '#F59E0B') : '#CBD5E1'"
                :stroke-width="1.5"
              />
            </button>
          </div>
          <p
            v-if="(hover || score) > 0"
            class="text-center text-sm font-medium mt-2 transition-all"
            :style="{ color: colors[hover || score] }"
          >
            {{ labels[hover || score] }}
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">
            Commentaire <span class="text-slate-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            v-model="comment"
            placeholder="Partagez votre expérience avec le support IT…"
            rows="3"
            class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 transition-colors"
            style="borderColor: var(--border)"
          />
        </div>

        <div class="flex gap-3 pt-1">
          <button
            type="button"
            @click="$emit('close')"
            class="flex-1 py-2.5 rounded-lg text-sm font-medium border text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            style="borderColor: var(--border)"
          >
            Annuler
          </button>
          <button
            type="button"
            @click="handleSubmit"
            :disabled="score === 0"
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
          >
            Envoyer l'évaluation
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Star as StarIcon, X as XIcon } from 'lucide-vue-next';

const props = defineProps<{
  ticketId: string;
  ticketTitle: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', score: number, comment: string): void;
}>();

const score = ref(0);
const hover = ref(0);
const comment = ref('');
const submitted = ref(false);

const labels = ['', 'Très insatisfait', 'Insatisfait', 'Neutre', 'Satisfait', 'Très satisfait'];
const colors = ['', '#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#10B981'];

const handleSubmit = () => {
  if (score.value === 0) return;
  emit('submit', score.value, comment.value);
  submitted.value = true;
};
</script>
