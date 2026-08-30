<template>
  <div class="p-6 md:p-8 max-w-6xl mx-auto">
    <div class="mb-8">
      <h1 class="font-display text-2xl font-bold text-slate-900 tracking-tight">Mon profil</h1>
      <p class="text-slate-500 text-sm mt-1">
        Gérez vos informations personnelles. Les modifications sont enregistrées en base de données.
      </p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-24 text-slate-400 gap-2">
      <Loader2Icon class="animate-spin" :size="20" />
      Chargement du profil…
    </div>

    <div v-else-if="currentUser" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Identity card -->
      <aside class="lg:col-span-4">
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="h-28 bg-slate-900 relative">
            <div
              class="absolute inset-0 opacity-[0.12]"
              style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 18px 18px;"
            />
            <div class="absolute inset-0 bg-gradient-to-br from-blue-700/40 to-transparent" />
          </div>

          <div class="px-6 pb-6 -mt-10 relative">
            <div
              class="w-[4.5rem] h-[4.5rem] rounded-2xl border-[3px] border-white bg-slate-800 flex items-center justify-center text-xl font-bold text-white shadow-md"
            >
              {{ initials }}
            </div>

            <div class="mt-4">
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide"
                :class="roleBadgeClass"
              >
                <ShieldIcon :size="11" />
                {{ roleLabels[currentUser.role] }}
              </span>
              <h2 class="font-display text-xl font-bold text-slate-900 mt-2 leading-tight">
                {{ currentUser.name }}
              </h2>
              <p class="text-sm text-slate-500 mt-0.5 break-all">{{ currentUser.email }}</p>
              <p v-if="currentUser.department" class="text-xs text-slate-400 mt-1">
                {{ currentUser.department }}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-6">
              <div class="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                <p class="font-display text-2xl font-bold text-slate-900">{{ currentUser.ticketsCreated || 0 }}</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Tickets créés</p>
              </div>
              <div class="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                <p class="font-display text-2xl font-bold text-slate-900">{{ currentUser.ticketsResolved || 0 }}</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Résolus</p>
              </div>
            </div>

            <p class="flex items-center gap-1.5 mt-5 text-xs text-slate-400">
              <CalendarIcon :size="12" />
              Membre depuis {{ memberSince }}
            </p>
          </div>
        </div>
      </aside>

      <!-- Forms -->
      <div class="lg:col-span-8 space-y-6">
        <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h3 class="font-display font-bold text-slate-900">Informations du compte</h3>
              <p class="text-xs text-slate-500 mt-0.5">Nom et email (le département est géré par l’IT)</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="editing"
                type="button"
                @click="cancelEdit"
                class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                @click="toggleEdit"
                :disabled="saving"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                :class="editing ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'"
              >
                <Loader2Icon v-if="saving" :size="12" class="animate-spin" />
                <SaveIcon v-else-if="editing" :size="12" />
                <Edit2Icon v-else :size="12" />
                {{ saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Modifier' }}
              </button>
            </div>
          </div>

          <div
            v-if="profileMessage"
            class="mb-4 rounded-lg px-3 py-2 text-sm"
            :class="profileError ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'"
          >
            {{ profileMessage }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Nom complet</label>
              <div class="relative">
                <UserIcon :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  v-model="form.name"
                  type="text"
                  :disabled="!editing"
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Adresse email</label>
              <div class="relative">
                <MailIcon :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  v-model="form.email"
                  type="email"
                  :disabled="!editing"
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Téléphone</label>
              <div class="relative">
                <PhoneIcon :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  v-model="form.phone"
                  type="tel"
                  placeholder="+216 XX XXX XXX"
                  :disabled="!editing"
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5">Utilisé pour les alertes urgentes (SMS/appel) selon le contrat de votre société.</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Département</label>
              <div class="relative">
                <Building2Icon :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  :value="form.department || '—'"
                  disabled
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5">Le département ne peut pas être modifié depuis le profil.</p>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Rôle</label>
              <div class="relative">
                <ShieldIcon :size="14" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  :value="roleLabels[currentUser.role]"
                  disabled
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5">Le rôle est attribué par l’administration IT.</p>
            </div>
          </div>
        </section>

        <section class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div class="mb-5">
            <h3 class="font-display font-bold text-slate-900 flex items-center gap-2">
              <LockIcon :size="15" class="text-slate-400" />
              Sécurité
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Définissez un mot de passe pour sécuriser votre compte. Une fois défini, il sera exigé à la connexion.
            </p>
          </div>

          <div
            v-if="passwordMessage"
            class="mb-4 rounded-lg px-3 py-2 text-sm"
            :class="passwordError ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'"
          >
            {{ passwordMessage }}
          </div>

          <form class="space-y-4 max-w-md" @submit.prevent="submitPassword">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe actuel</label>
              <input
                v-model="passwordForm.current"
                type="password"
                autocomplete="current-password"
                placeholder="Laisser vide si premier mot de passe"
                class="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Nouveau mot de passe</label>
              <input
                v-model="passwordForm.next"
                type="password"
                autocomplete="new-password"
                required
                minlength="6"
                placeholder="Minimum 6 caractères"
                class="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5">Confirmer</label>
              <input
                v-model="passwordForm.confirm"
                type="password"
                autocomplete="new-password"
                required
                minlength="6"
                class="w-full px-3.5 py-2.5 rounded-xl text-sm border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              :disabled="passwordSaving"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              <Loader2Icon v-if="passwordSaving" :size="14" class="animate-spin" />
              Mettre à jour le mot de passe
            </button>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  User as UserIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Building2 as Building2Icon,
  Calendar as CalendarIcon,
  Shield as ShieldIcon,
  Edit2 as Edit2Icon,
  Save as SaveIcon,
  Lock as LockIcon,
  Loader2 as Loader2Icon
} from 'lucide-vue-next';

const authStore = useAuthStore();
const currentUser = computed(() => authStore.user);

const loading = ref(true);
const editing = ref(false);
const saving = ref(false);
const profileMessage = ref('');
const profileError = ref(false);

const passwordSaving = ref(false);
const passwordMessage = ref('');
const passwordError = ref(false);

const form = reactive({
  name: '',
  email: '',
  department: '',
  phone: ''
});

const passwordForm = reactive({
  current: '',
  next: '',
  confirm: ''
});

const roleLabels: Record<string, string> = {
  user: 'Utilisateur standard',
  agent: 'Agent IT',
  admin: 'Administrateur'
};

const roleBadgeClass = computed(() => {
  const map: Record<string, string> = {
    user: 'bg-blue-50 text-blue-700',
    agent: 'bg-indigo-50 text-indigo-700',
    admin: 'bg-rose-50 text-rose-700'
  };
  return map[currentUser.value?.role || 'user'];
});

const initials = computed(() => {
  const n = currentUser.value?.name || '';
  return n
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
});

const memberSince = computed(() => {
  if (!currentUser.value?.joinDate) return '—';
  return new Date(currentUser.value.joinDate).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });
});

const syncForm = () => {
  form.name = currentUser.value?.name || '';
  form.email = currentUser.value?.email || '';
  form.department = currentUser.value?.department || '';
  form.phone = currentUser.value?.phone || '';
};

onMounted(async () => {
  loading.value = true;
  try {
    await authStore.refreshProfile();
  } finally {
    syncForm();
    loading.value = false;
  }
});

const cancelEdit = () => {
  syncForm();
  editing.value = false;
  profileMessage.value = '';
};

const toggleEdit = async () => {
  if (!editing.value) {
    profileMessage.value = '';
    editing.value = true;
    return;
  }

  if (!form.name.trim() || !form.email.trim()) {
    profileError.value = true;
    profileMessage.value = 'Le nom et l’email sont obligatoires.';
    return;
  }

  saving.value = true;
  profileMessage.value = '';
  try {
    await authStore.updateProfile(
      form.name.trim(),
      form.email.trim(),
      currentUser.value?.department || '',
      form.phone.trim()
    );
    profileError.value = false;
    profileMessage.value = 'Profil enregistré. Les changements resteront après déconnexion.';
    editing.value = false;
    syncForm();
  } catch (err: any) {
    profileError.value = true;
    profileMessage.value =
      err?.response?.data?.message || 'Impossible d’enregistrer le profil. Réessayez.';
  } finally {
    saving.value = false;
  }
};

const submitPassword = async () => {
  passwordMessage.value = '';
  if (passwordForm.next !== passwordForm.confirm) {
    passwordError.value = true;
    passwordMessage.value = 'La confirmation ne correspond pas.';
    return;
  }
  if (passwordForm.next.length < 6) {
    passwordError.value = true;
    passwordMessage.value = 'Minimum 6 caractères.';
    return;
  }

  passwordSaving.value = true;
  try {
    await authStore.changePassword(passwordForm.current, passwordForm.next);
    passwordError.value = false;
    passwordMessage.value = 'Mot de passe mis à jour avec succès.';
    passwordForm.current = '';
    passwordForm.next = '';
    passwordForm.confirm = '';
  } catch (err: any) {
    passwordError.value = true;
    passwordMessage.value =
      err?.response?.data?.message || 'Impossible de mettre à jour le mot de passe.';
  } finally {
    passwordSaving.value = false;
  }
};
</script>
