/// <reference types="vite/client" />
import axios from 'axios';
import type { Ticket, TicketStatus, TicketPriority, TicketCategory, Comment, Notification, User, CyberAnalysis, EscalationTicket } from '../types';
import { splitAgentsByCategory } from '../utils/agentCategories';
import { decodeJwtPayload, keycloakRefreshToken, isKeycloakEnabled } from '../auth/keycloak';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Évite les rafraîchissements concurrents si plusieurs requêtes partent en même temps
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Vérifie l'expiration du token AVANT chaque requête (pas seulement via un
 * minuteur en tâche de fond, qui peut arriver trop tard si l'onglet était
 * inactif ou rechargement récent). Rafraîchit proactivement si expiré ou
 * expire dans moins de 20s, en utilisant le refresh_token Keycloak.
 */
async function ensureFreshToken(): Promise<string | null> {
  const token = localStorage.getItem('token');
  if (!token || !isKeycloakEnabled()) return token;

  let exp: number | undefined;
  try {
    exp = decodeJwtPayload(token)?.exp;
  } catch {
    return token;
  }
  if (!exp) return token;

  const expiresInMs = exp * 1000 - Date.now();
  if (expiresInMs > 45_000) return token;

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return token;

  if (!refreshInFlight) {
    refreshInFlight = keycloakRefreshToken(refreshToken)
      .then((tokens) => {
        localStorage.setItem('token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        return tokens.access_token;
      })
      .catch((e) => {
        console.warn('[api] Rafraîchissement du token échoué :', e);
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.request.use(async (config) => {
  const token = await ensureFreshToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Filet de sécurité : si malgré la vérification préalable une requête
 * échoue quand même en 401 (décalage d'horloge, marge trop courte, token
 * expiré entre la vérification et l'envoi…), on rafraîchit le token UNE
 * fois et on rejoue la requête originale avant d'abandonner.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      isKeycloakEnabled() &&
      !original._retried
    ) {
      original._retried = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          if (!refreshInFlight) {
            refreshInFlight = keycloakRefreshToken(refreshToken)
              .then((tokens) => {
                localStorage.setItem('token', tokens.access_token);
                localStorage.setItem('refresh_token', tokens.refresh_token);
                return tokens.access_token;
              })
              .finally(() => {
                refreshInFlight = null;
              });
          }
          const newToken = await refreshInFlight;
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
            return api.request(original);
          }
        } catch (e) {
          console.warn('[api] Rejeu après 401 impossible, session expirée:', e);
        }
      }
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Authentication
  async login(email: string, role: 'user' | 'agent' | 'admin', password?: string): Promise<{ user: User; token?: string }> {
    const response = await api.post('/users/login', { email, role, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return {
      user: response.data.user || response.data,
      token: response.data.token,
    };
  },

  async register(name: string, email: string, department: string, password: string): Promise<{ user: User; token?: string }> {
    const response = await api.post('/users/register', { name, email, department, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return {
      user: response.data.user || response.data,
      token: response.data.token,
    };
  },

  async registerSociete(payload: {
    societeName: string;
    secteurActivite?: string;
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<{ user: User; token?: string; societe: any }> {
    const response = await api.post('/users/register-societe', payload);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return {
      user: response.data.user,
      token: response.data.token,
      societe: response.data.societe,
    };
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/users/me');
    return response.data.user || response.data;
  },

  async updateProfile(payload: { name: string; email: string; department?: string; phone?: string }): Promise<{ user: User; token?: string }> {
    const response = await api.put('/users/profile', payload);
    // IMPORTANT : ne jamais stocker ce token "pont" (legacy) dans
    // localStorage ici — en session Keycloak, il écraserait le vrai
    // access_token RS256 actif (c'est ce qui causait le bug "rôle perdu
    // après sync" observé précédemment). Le store décide, pas ce service.
    return {
      user: response.data.user || response.data,
      token: response.data.token,
    };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/users/profile/password', { currentPassword, newPassword });
  },

  // Tickets
  async getTickets(): Promise<Ticket[]> {
    const response = await api.get('/tickets');
    return response.data;
  },

  async getUrgentEscalation(): Promise<EscalationTicket[]> {
    const response = await api.get('/tickets/urgent-escalation');
    return response.data;
  },

  async getTicket(id: string): Promise<Ticket> {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  },

  async createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'attachments' | 'history'> & { attachments?: { name: string; size: string; type: string }[]; aiSuggestion?: Ticket['aiSuggestion'] }): Promise<Ticket> {
    const response = await api.post('/tickets', ticket);
    return response.data;
  },

  async uploadAttachment(ticketId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getAgents(category?: TicketCategory): Promise<User[]> {
    const response = await api.get('/users/agents', {
      params: category ? { category } : undefined,
    });
    const data = response.data;
    if (Array.isArray(data)) return data;
    return data.all || [...(data.specialized || []), ...(data.others || [])];
  },

  async getAgentsForCategory(category: TicketCategory): Promise<{
    category: TicketCategory;
    specialized: User[];
    others: User[];
    all: User[];
  }> {
    const response = await api.get('/users/agents', { params: { category } });
    const data = response.data;
    if (Array.isArray(data)) {
      return { category, ...splitAgentsByCategory(data, category) };
    }
    return data;
  },

  async updateTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
    const response = await api.patch(`/tickets/${id}/status`, { status });
    return response.data;
  },

  async assignTicket(id: string, assignedToId: string): Promise<Ticket> {
    const response = await api.patch(`/tickets/${id}/assign`, { assignedToId });
    return response.data;
  },

  async addComment(ticketId: string, content: string, isInternal = false): Promise<Comment> {
    const response = await api.post(`/tickets/${ticketId}/comments`, { content, isInternal });
    return response.data;
  },

  async submitEvaluation(ticketId: string, rating: number, comment: string): Promise<any> {
    const response = await api.post(`/tickets/${ticketId}/evaluate`, { rating, comment });
    return response.data;
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const response = await api.get('/notifications');
    return response.data;
  },

  async markNotificationRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllNotificationsRead(): Promise<void> {
    await api.post('/notifications/read-all');
  },

  // AI Service suggestion directly from gateway
  async getAISuggestions(title: string, description: string): Promise<{
    category: TicketCategory;
    priority: TicketPriority;
    suggestedResponse: string;
    confidence: number;
    canSelfResolve?: boolean;
    selfHelpSteps?: string[];
    model?: string;
  }> {
    const response = await api.post('/ai/analyze', { title, description }, { timeout: 30000 });
    return response.data;
  },

  async getAiHealth(): Promise<{
    status?: string;
    llmReady?: boolean;
    llmProvider?: string | null;
    modelReady?: boolean;
  }> {
    const response = await api.get('/ai/health', { timeout: 8000 });
    return response.data;
  },

  async chatWithAI(
    message: string,
    history: { role: string; content: string }[] = []
  ): Promise<{
    reply: string;
    canSelfResolve: boolean;
    steps: string[];
    suggestTicket: boolean;
    category?: string | null;
    priority?: string | null;
    confidence: number;
    intent?: string | null;
    provider?: string | null;
  }> {
    const response = await api.post(
      '/ai/chat',
      { message, history },
      { timeout: 90000 }
    );
    return response.data;
  },

  async analyzeCyber(content: string): Promise<CyberAnalysis> {
    const response = await api.post(
      '/ai/cyber/analyze',
      { content },
      { timeout: 60000 }
    );
    return response.data;
  },

  async syncKeycloakUser(payload: {
    email: string;
    name: string;
    role?: string;
    societeId?: string | null;
    keycloakId?: string;
  }): Promise<{ user: User; token?: string }> {
    const response = await api.post('/users/auth/keycloak-sync', payload);
    // IMPORTANT : ne PAS stocker ce token "pont" (legacy HS256) ici — c'était
    // la vraie cause du bug où le rôle/l'ID d'un utilisateur était perdu après
    // synchronisation : ce token écrasait le vrai access_token Keycloak RS256
    // déjà en place, cassant toutes les requêtes suivantes.
    return {
      user: response.data.user || response.data,
      token: response.data.token,
    };
  },

  async getContractAccessStatus(sessionId: string) {
    const response = await api.get('/contracts/access/status', {
      params: { sessionId },
      headers: { 'x-session-id': sessionId },
    });
    return response.data;
  },

  async acknowledgeContract(contratId: string, sessionId: string) {
    const response = await api.post('/contracts/access/acknowledge', {
      contratId,
      sessionId,
    });
    return response.data;
  },

  async generateReport(societeId: string, periodeDebut: string, periodeFin: string) {
    const response = await api.post('/reports/generate', {
      societeId,
      periodeDebut,
      periodeFin,
    });
    return response.data;
  },

  async listReports(societeId?: string) {
    const response = await api.get('/reports', {
      params: societeId ? { societeId } : undefined,
    });
    return response.data;
  },

  async getSocietes(): Promise<any[]> {
    const response = await api.get('/contracts/societes');
    return response.data;
  },

  async getSocieteContrats(societeId: string): Promise<any[]> {
    const response = await api.get(`/contracts/societes/${societeId}/contrats`);
    return response.data;
  },

  async getContractById(contratId: string): Promise<any> {
    const response = await api.get(`/contracts/contrats/${contratId}`);
    return response.data;
  },

  async createContract(payload: {
    type_contrat: string;
    canal_notification_urgence: string;
    jours_ouvres?: string;
    heures_ouvrees: string;
    date_fin?: string;
    conditions_texte?: string;
  }) {
    const response = await api.post('/contracts/contrats', payload);
    return response.data;
  },
  async updateContract(contratId: string, payload: Partial<{
    type_contrat: string;
    canal_notification_urgence: string;
    jours_ouvres: string;
    heures_ouvrees: string;
    date_fin: string;
    conditions_texte: string;
  }>) {
    const response = await api.put(`/contracts/contrats/${contratId}`, payload);
    return response.data;
  },

  async logChatMessage(role: string, content: string) {
    try {
      await api.post('/reports/chat-log', { role, content });
    } catch {
      // best-effort, ne bloque jamais l'expérience du chat
    }
  },

  async downloadReport(reportId: string, fileName?: string) {
    const response = await api.get(`/reports/${reportId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `${reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
