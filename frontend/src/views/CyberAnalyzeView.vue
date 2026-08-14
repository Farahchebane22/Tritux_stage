<template>
  <div class="p-6 md:p-8 max-w-5xl mx-auto">
    <div class="mb-8">
      <h1 class="font-display text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
        <ShieldAlertIcon :size="22" class="text-rose-600" />
        Analyse cyber
      </h1>
      <p class="text-slate-500 text-sm mt-1 max-w-2xl">
        Collez un email, un message Teams ou une description d’incident. L’assistant évalue le risque
        et propose des actions immédiates. Ce n’est pas un antivirus : en cas de doute, créez un ticket Sécurité.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <section class="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label class="block text-xs font-semibold text-slate-600 mb-1.5">
          Contenu à analyser <span class="text-rose-500">*</span>
        </label>
        <textarea
          v-model="content"
          rows="12"
          placeholder="Exemple : J’ai reçu un mail « RH Tritux » me demandant de cliquer sur un lien pour ressaisir mon mot de passe SSO avant 17h…"
          class="w-full px-3.5 py-3 rounded-xl text-sm border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25 focus:border-rose-400 resize-y min-h-[220px]"
        />
        <div class="flex flex-wrap items-center justify-between gap-3 mt-3">
          <p class="text-[11px] text-slate-400">{{ content.length }} / 8000 caractères · min. 10</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              @click="useExample"
            >
              Exemple phishing
            </button>
            <button
              type="button"
              :disabled="loading || content.trim().length < 10"
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
              style="background: linear-gradient(135deg, #BE123C 0%, #9F1239 100%)"
              @click="runAnalysis"
            >
              <Loader2Icon v-if="loading" :size="13" class="animate-spin" />
              <SearchIcon v-else :size="13" />
              {{ loading ? 'Analyse…' : 'Analyser' }}
            </button>
          </div>
        </div>
        <p v-if="error" class="mt-3 text-sm text-rose-600">{{ error }}</p>
      </section>

      <aside class="lg:col-span-2 space-y-4">
        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-900">
          <p class="font-semibold text-xs uppercase tracking-wide text-amber-700 mb-1.5">Rappel sécurité</p>
          <ul class="space-y-1.5 text-xs leading-relaxed list-disc list-inside text-amber-800/90">
            <li>Ne saisissez jamais votre mot de passe ici.</li>
            <li>Ne cliquez pas sur les liens suspects pour « tester ».</li>
            <li>Conservez le message original pour le ticket IT.</li>
          </ul>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p class="text-xs font-semibold text-slate-600 mb-2">Que puis-je coller ?</p>
          <ul class="text-xs text-slate-500 space-y-1.5">
            <li>• Corps d’un email suspect</li>
            <li>• Message Teams / SMS</li>
            <li>• Description d’alerte antivirus</li>
            <li>• URL douteuse (sans l’ouvrir)</li>
          </ul>
        </div>
      </aside>
    </div>

    <section v-if="result" class="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <header class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
        <div class="flex items-center gap-3">
          <span
            class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide"
            :class="riskBadgeClass"
          >
            Risque {{ riskLabels[result.riskLevel] }} · {{ result.riskScore }}/100
          </span>
          <span class="text-sm font-semibold text-slate-800">{{ result.threatLabel }}</span>
        </div>
        <span class="text-[11px] text-slate-400">
          Confiance {{ result.confidence }}%
          <template v-if="result.provider"> · {{ result.provider }}</template>
        </span>
      </header>

      <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Diagnostic</h3>
          <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{{ result.summary }}</p>

          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-5 mb-2">Indicateurs</h3>
          <ul class="space-y-1.5">
            <li
              v-for="(ind, i) in result.indicators"
              :key="i"
              class="text-sm text-slate-600 flex gap-2"
            >
              <span class="text-rose-500 mt-0.5">•</span>
              {{ ind }}
            </li>
          </ul>

          <div v-if="result.urls?.length" class="mt-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">URLs détectées</h3>
            <ul class="space-y-1">
              <li
                v-for="(u, i) in result.urls"
                :key="i"
                class="text-xs font-mono break-all text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100"
              >
                {{ u }}
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Actions immédiates</h3>
          <ol class="space-y-2 list-decimal list-inside text-sm text-slate-700">
            <li v-for="(step, i) in result.immediateActions" :key="i" class="leading-relaxed">
              {{ step }}
            </li>
          </ol>

          <div class="mt-6 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
              @click="createSecurityTicket"
            >
              <TicketIcon :size="15" />
              Créer un ticket Sécurité
            </button>
            <button
              type="button"
              class="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              @click="reset"
            >
              Nouvelle analyse
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mt-2">
            Le ticket sera prérempli (catégorie Sécurité, priorité {{ priorityLabels[result.priority] || result.priority }}).
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiService } from '../services/api';
import type { CyberAnalysis } from '../types';
import {
  ShieldAlert as ShieldAlertIcon,
  Search as SearchIcon,
  Loader2 as Loader2Icon,
  Ticket as TicketIcon,
} from 'lucide-vue-next';

const router = useRouter();
const content = ref('');
const loading = ref(false);
const error = ref('');
const result = ref<CyberAnalysis | null>(null);

const EXAMPLE = `Bonjour,

Votre compte Tritux sera suspendu dans 2 heures. Cliquez ici pour vérifier vos identifiants :
https://tritux-sso-secure.login-check.xyz/auth

Merci de saisir votre mot de passe SSO immédiatement.

Service RH Tritux`;

const riskLabels: Record<string, string> = {
  low: 'faible',
  medium: 'moyen',
  high: 'élevé',
  critical: 'critique',
};

const priorityLabels: Record<string, string> = {
  low: 'basse',
  medium: 'moyenne',
  high: 'haute',
  urgent: 'urgente',
};

const riskBadgeClass = computed(() => {
  const map: Record<string, string> = {
    low: 'bg-emerald-50 text-emerald-700',
    medium: 'bg-amber-50 text-amber-800',
    high: 'bg-orange-50 text-orange-800',
    critical: 'bg-rose-100 text-rose-800',
  };
  return map[result.value?.riskLevel || 'low'];
});

const useExample = () => {
  content.value = EXAMPLE;
  result.value = null;
  error.value = '';
};

const reset = () => {
  content.value = '';
  result.value = null;
  error.value = '';
};

const runAnalysis = async () => {
  error.value = '';
  result.value = null;
  const text = content.value.trim();
  if (text.length < 10) {
    error.value = 'Saisissez au moins 10 caractères.';
    return;
  }
  loading.value = true;
  try {
    result.value = await apiService.analyzeCyber(text);
  } catch (e: any) {
    error.value =
      e?.response?.data?.detail?.[0]?.msg ||
      e?.response?.data?.message ||
      "Impossible d'analyser. Vérifiez que le service IA (port 8000) tourne.";
  } finally {
    loading.value = false;
  }
};

const createSecurityTicket = () => {
  if (!result.value) return;
  const title =
    result.value.threatLabel.length > 70
      ? result.value.threatLabel.slice(0, 70)
      : `Alerte cyber : ${result.value.threatLabel}`;
  const body = [
    content.value.trim(),
    '',
    '--- Analyse cyber Tritux ---',
    `Risque: ${result.value.riskLevel} (${result.value.riskScore}/100)`,
    `Type: ${result.value.threatLabel}`,
    `Diagnostic: ${result.value.summary}`,
    result.value.indicators.length
      ? `Indicateurs: ${result.value.indicators.join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const q = new URLSearchParams({
    title,
    prefill: body.slice(0, 4000),
    category: 'security',
    priority: result.value.priority || 'high',
  });
  router.push(`/tickets/create?${q.toString()}`);
};
</script>
