import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useContractStore } from '../stores/contract';
import { isKeycloakEnabled } from '../auth/keycloak';

import LoginView from '../views/LoginView.vue';
import WelcomeLandingView from '../views/WelcomeLandingView.vue';
import DashboardView from '../views/DashboardView.vue';
import TicketListView from '../views/TicketListView.vue';
import CreateTicketView from '../views/CreateTicketView.vue';
import TicketDetailView from '../views/TicketDetailView.vue';
import NotificationsView from '../views/NotificationsView.vue';
import ProfileView from '../views/ProfileView.vue';
import CyberAnalyzeView from '../views/CyberAnalyzeView.vue';
import ReportsView from '../views/ReportsView.vue';
import NoContractView from '../views/contract-gate/NoContractView.vue';
import ContractRecapView from '../views/contract-gate/ContractRecapView.vue';

const routes = [
  {
    path: '/welcome',
    name: 'welcome',
    component: WelcomeLandingView,
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false, public: true }
  },
  {
    path: '/contract/none',
    name: 'no-contract',
    component: NoContractView,
    meta: { requiresAuth: true, contractGate: true }
  },
  {
    path: '/contract/recap',
    name: 'contract-recap',
    component: ContractRecapView,
    meta: { requiresAuth: true, contractGate: true }
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
    path: '/reports',
    name: 'reports',
    component: ReportsView,
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
    redirect: '/welcome'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  if (isKeycloakEnabled() && !authStore.isLoggedIn) {
    await authStore.bootstrapKeycloak();
  }

  if (to.meta.public) {
    if (authStore.isLoggedIn && (to.name === 'login' || to.name === 'welcome')) {
      return next({ name: 'dashboard' });
    }
    return next();
  }

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return next({ name: isKeycloakEnabled() ? 'welcome' : 'login' });
  }

  // Contract gate (clients only) — every new session
  if (authStore.isLoggedIn && !to.meta.contractGate && !to.meta.public) {
    const contractStore = useContractStore();
    try {
      if (!contractStore.status) await contractStore.fetchStatus();
      const st = contractStore.status;
      if (st && !st.allowed) {
        return next({ name: 'no-contract' });
      }
      if (st?.requiresContractAck && !contractStore.acknowledged) {
        return next({ name: 'contract-recap' });
      }
    } catch (e) {
      console.warn('Contract gate check failed', e);
    }
  }

  next();
});

export default router;
