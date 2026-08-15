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
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useNotificationsStore } from './stores/notifications';
import Sidebar from './components/Sidebar.vue';
import AiChatbot from './components/AiChatbot.vue';

const route = useRoute();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

const showAppShell = computed(() => {
  if (!authStore.isLoggedIn) return false;
  if (route.meta.public || route.meta.contractGate) return false;
  return true;
});

const loadNotifications = () => {
  if (authStore.isLoggedIn) {
    notificationsStore.fetchNotifications();
  }
};

onMounted(loadNotifications);
watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) loadNotifications();
});
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
