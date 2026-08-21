/// <reference types="vite/client" />
import axios from 'axios';
import type { Ticket, TicketStatus, TicketPriority, TicketCategory, Comment, Notification, User, CyberAnalysis } from '../types';
import { splitAgentsByCategory } from '../utils/agentCategories';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

  async updateProfile(payload: { name: string; email: string; department?: string }): Promise<{ user: User; token?: string }> {
    const response = await api.put('/users/profile', payload);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
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
    if (response.data.token) localStorage.setItem('token', response.data.token);
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
};
