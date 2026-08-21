<template>
  <div class="min-h-screen flex bg-slate-100">
    <!-- Left panel -->
    <div
      class="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-10 relative overflow-hidden"
      style="background: linear-gradient(145deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)"
    >
      <!-- Background pattern -->
      <div
        class="absolute inset-0 opacity-5"
        style="background-image: radial-gradient(circle at center, rgba(255,255,255,0.6) 1px, transparent 1px); background-size: 28px 28px;"
      />
      <!-- Gradient orbs -->
      <div class="absolute top-24 -left-16 w-64 h-64 rounded-full opacity-20 blur-3xl" style="background: #1D4ED8" />
      <div class="absolute bottom-32 right-8 w-48 h-48 rounded-full opacity-15 blur-3xl" style="background: #7C3AED" />

      <!-- Logo -->
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-12">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 via-violet-500 to-rose-500">
            <span class="text-white font-display font-bold text-base">T</span>
          </div>
          <div>
            <div class="text-white font-display font-bold text-lg leading-tight">Tritux Groupe</div>
            <div class="text-slate-400 text-xs">IT Helpdesk Platform</div>
          </div>
        </div>

        <h1 class="font-display text-white text-3xl font-bold leading-tight mb-4">
          Gestion intelligente<br />
          <span style="background: linear-gradient(90deg, #60A5FA, #A78BFA); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            de vos tickets IT
          </span>
        </h1>
        <p class="text-slate-400 text-sm leading-relaxed">
          Centralisez vos demandes d'assistance, suivez leur traitement en temps réel et bénéficiez de suggestions intelligentes par IA.
        </p>
      </div>

      <!-- Feature pills -->
      <div class="relative z-10 space-y-3">
        <div
          v-for="pill in features"
          :key="pill.label"
          class="flex items-start gap-3 p-3 rounded-xl"
          style="background: rgba(255,255,255,0.05)"
        >
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" :style="{ background: `${pill.color}20` }">
            <component :is="pill.icon" :size="15" :style="{ color: pill.color }" />
          </div>
          <div>
            <div class="text-white text-xs font-medium">{{ pill.label }}</div>
            <div class="text-slate-500 text-xs">{{ pill.sub }}</div>
          </div>
        </div>
      </div>

      <p class="relative z-10 text-slate-600 text-xs">
        © 2026 Tritux Groupe — Projet de stage IT Helpdesk
      </p>
    </div>

    <!-- Right panel — form -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-md">
        <!-- Mobile logo -->
        <div class="flex lg:hidden items-center gap-2 mb-8">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 via-violet-500 to-rose-500">
            <span class="text-white font-display font-bold text-sm">T</span>
          </div>
          <span class="font-display font-bold text-slate-900">Tritux Helpdesk</span>
        </div>

        <div class="bg-white rounded-2xl p-8 shadow-sm" style="border: 1px solid var(--border)">
          <!-- Tabs -->
          <div class="flex gap-1 p-1 rounded-lg mb-6" style="background: var(--background)">
            <button
              v-for="tab in (['login', 'register'] as const)"
              :key="tab"
              @click="mode = tab"
              :class="[
                'flex-1 py-2 rounded-md text-sm font-medium transition-all duration-150 cursor-pointer',
                mode === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              ]"
            >
              {{ tab === 'login' ? 'Connexion' : 'Inscription' }}
            </button>
          </div>

          <div v-if="mode === 'register'" class="flex gap-1 p-1 rounded-lg mb-4" style="background: var(--background)">
            <button
              type="button"
              @click="registerAs = 'internal'"
              :class="[
                'flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                registerAs === 'internal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              ]"
            >
              Compte interne Tritux
            </button>
            <button
              type="button"
              @click="registerAs = 'societe'"
              :class="[
                'flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                registerAs === 'societe' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              ]"
            >
              Nouvelle société cliente
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div v-if="mode === 'register' && registerAs === 'societe'">
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Nom de la société</label>
              <input
                type="text"
                v-model="societeName"
                placeholder="Ma Société SARL"
                required
                class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style="borderColor: var(--border)"
              />
            </div>
            <div v-if="mode === 'register' && registerAs === 'societe'">
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Secteur d'activité</label>
              <input
                type="text"
                v-model="secteurActivite"
                placeholder="Industrie, Télécom, Retail…"
                class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style="borderColor: var(--border)"
              />
            </div>
            <div v-if="mode === 'register' && registerAs === 'internal'">
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Nom complet</label>
              <input
                type="text"
                v-model="name"
                placeholder="Sami Belhadj"
                required
                class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style="borderColor: var(--border)"
              />
            </div>

            <div v-if="mode === 'register' && registerAs === 'internal'">
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Département</label>
              <select
                v-model="dept"
                required
                class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style="borderColor: var(--border)"
              >
                <option value="">Sélectionner…</option>
                <option>Finance</option>
                <option>Marketing</option>
                <option>RH</option>
                <option>Commercial</option>
                <option>IT Support</option>
                <option>Direction</option>
              </select>
            </div>

            <div v-if="mode === 'register' && registerAs === 'societe'">
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Votre nom complet (administrateur société)</label>
              <input
                type="text"
                v-model="name"
                placeholder="Nom Prénom"
                required
                class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style="borderColor: var(--border)"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Adresse email</label>
              <input
                type="email"
                v-model="email"
                placeholder="prenom.nom@tritux.com"
                required
                class="w-full px-3.5 py-2.5 rounded-lg text-sm border text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                style="borderColor: var(--border)"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div class="relative">
                <input
                  :type="showPw ? 'text' : 'password'"
                  v-model="password"
                  placeholder="••••••••"
                  required
                  class="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm border text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style="borderColor: var(--border)"
                />
                <button
                  type="button"
                  @click="showPw = !showPw"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <EyeOffIcon v-if="showPw" :size="15" />
                  <EyeIcon v-else :size="15" />
                </button>
              </div>
            </div>

            <div v-if="mode === 'login'" class="flex justify-end">
              <button type="button" class="text-xs font-medium hover:underline cursor-pointer" style="color: var(--primary)">
                Mot de passe oublié ?
              </button>
            </div>

            <button
              type="submit"
              class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] mt-2 cursor-pointer"
              style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
            >
              {{ mode === 'login' ? 'Se connecter' : "Créer mon compte" }}
            </button>

            <button
              v-if="keycloakOn && mode === 'login'"
              type="button"
              class="w-full py-2.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-800 hover:bg-slate-50 mt-2 cursor-pointer"
              @click="loginKeycloak"
            >
              Connexion via Keycloak (SSO)
            </button>

            <p v-if="errorMsg" class="text-xs text-red-600 text-center mt-2">{{ errorMsg }}</p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { apiService } from '../services/api';
import {
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Wifi as WifiIcon,
  Shield as ShieldIcon,
  Zap as ZapIcon
} from 'lucide-vue-next';

import { isKeycloakEnabled } from '../auth/keycloak';

const router = useRouter();
const authStore = useAuthStore();
const keycloakOn = isKeycloakEnabled();

const mode = ref<'login' | 'register'>('login');
const registerAs = ref<'internal' | 'societe'>('societe');
const showPw = ref(false);
const email = ref('');
const password = ref('');
const name = ref('');
const dept = ref('');
const societeName = ref('');
const secteurActivite = ref('');
const errorMsg = ref('');

const features = [
  { icon: ZapIcon, color: '#60A5FA', label: 'Suggestions IA automatiques', sub: 'Catégorie, priorité et réponse suggérées' },
  { icon: WifiIcon, color: '#A78BFA', label: 'Suivi en temps réel', sub: 'Notifications instantanées à chaque mise à jour' },
  { icon: ShieldIcon, color: '#34D399', label: 'Sécurisé & traçable', sub: 'Historique complet de chaque demande' },
];

const loginKeycloak = async () => {
  errorMsg.value = '';
  try {
    await authStore.loginWithKeycloak();
  } catch {
    errorMsg.value = 'Impossible de joindre Keycloak.';
  }
};

const handleSubmit = async () => {
  errorMsg.value = '';
  try {
    if (mode.value === 'register') {
      if (registerAs.value === 'societe') {
        await apiService.registerSociete({
          societeName: societeName.value,
          secteurActivite: secteurActivite.value || undefined,
          name: name.value,
          email: email.value,
          password: password.value,
        });
        await authStore.login(email.value, 'user', password.value);
        router.push('/');
        return;
      }
      await apiService.register(name.value, email.value, dept.value, password.value);
      await authStore.login(email.value, 'user', password.value || undefined);
      router.push('/');
      return;
    }

    // Note : le SSO Keycloak reste disponible via son propre bouton dédié
    // ("Connexion via Keycloak"). Le bouton principal utilise toujours le
    // compte local, indispensable pour les sociétés créées en self-service.
    await authStore.login(email.value, 'user', password.value || undefined);
    router.push('/');
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message || 'Connexion impossible. Vérifiez vos identifiants.';
  }
};
</script>
