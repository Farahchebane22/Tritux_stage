<template>
  <div class="min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
    <!-- Authenticated app shell (not on contract-gate / public pages) -->
    <div v-if="showAppShell" class="flex">
      <Sidebar />
      <main class="flex-1 min-h-screen pl-64 transition-all duration-300">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Public / gate layouts -->
    <div v-else>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <AiChatbot v-if="showAppShell" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useNotificationsStore } from './stores/notifications';
import { useEscalationStore } from './stores/escalation';
import Sidebar from './components/Sidebar.vue';
import AiChatbot from './components/AiChatbot.vue';

const route = useRoute();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const escalationStore = useEscalationStore();

const showAppShell = computed(() => {
  if (!authStore.isLoggedIn) return false;
  if (route.meta.public || route.meta.contractGate) return false;
  return true;
});

const isInternalStaff = computed(() => {
  const r = authStore.user?.role;
  return r === 'agent' || r === 'admin' || r === 'AGENT_IT' || r === 'SUPER_ADMIN';
});

const syncEscalationPolling = () => {
  if (authStore.isLoggedIn && isInternalStaff.value && showAppShell.value) {
    escalationStore.startPolling();
  } else {
    escalationStore.stopPolling();
  }
};

const loadNotifications = () => {
  if (authStore.isLoggedIn) {
    notificationsStore.fetchNotifications();
  }
};

onMounted(() => {
  loadNotifications();
  syncEscalationPolling();
});

onUnmounted(() => {
  escalationStore.stopPolling();
});

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) loadNotifications();
  syncEscalationPolling();
});

watch(showAppShell, syncEscalationPolling);
watch(isInternalStaff, syncEscalationPolling);
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
