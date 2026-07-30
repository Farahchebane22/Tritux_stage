<template>
  <div class="min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
    <!-- Authenticated layout -->
    <div v-if="isAuthenticated" class="flex">
      <!-- Sidebar -->
      <Sidebar />

      <!-- Main Panel -->
      <main class="flex-1 min-h-screen pl-64 transition-all duration-300">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Guest layout (login) -->
    <div v-else>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <AiChatbot v-if="isAuthenticated" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { useNotificationsStore } from './stores/notifications';
import Sidebar from './components/Sidebar.vue';
import AiChatbot from './components/AiChatbot.vue';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const isAuthenticated = computed(() => authStore.isLoggedIn);

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
