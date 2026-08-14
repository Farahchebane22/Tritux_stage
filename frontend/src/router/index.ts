import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import TicketListView from '../views/TicketListView.vue';
import CreateTicketView from '../views/CreateTicketView.vue';
import TicketDetailView from '../views/TicketDetailView.vue';
import NotificationsView from '../views/NotificationsView.vue';
import ProfileView from '../views/ProfileView.vue';
import CyberAnalyzeView from '../views/CyberAnalyzeView.vue';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/tickets',
    name: 'tickets',
    component: TicketListView,
    meta: { requiresAuth: true }
  },
  {
    path: '/tickets/create',
    name: 'create-ticket',
    component: CreateTicketView,
    meta: { requiresAuth: true }
  },
  {
    path: '/tickets/:id',
    name: 'ticket-detail',
    component: TicketDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/security',
    name: 'security',
    component: CyberAnalyzeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: NotificationsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({ name: 'login' });
  } else if (to.name === 'login' && authStore.isLoggedIn) {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
