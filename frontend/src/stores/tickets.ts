import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Ticket, TicketStatus, TicketPriority, TicketCategory, Comment, User, HistoryEntry } from '../types';
import { apiService } from '../services/api';
import { mockTickets } from '../data/mockData';
import { useAuthStore } from './auth';

export const useTicketsStore = defineStore('tickets', () => {
  const tickets = ref<Ticket[]>([]);
  const isLoading = ref<boolean>(false);
  const authStore = useAuthStore();

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('tickets');
    if (saved) {
      tickets.value = JSON.parse(saved);
      return true;
    }
    return false;
  };

  const saveToLocalStorage = () => {
    localStorage.setItem('tickets', JSON.stringify(tickets.value));
  };

  const visibleForUser = (list: Ticket[]) => {
    const u = authStore.user;
    if (!u) return [];
    if (u.role === 'admin') return list;
    if (u.role === 'agent') return list.filter(t => t.assignedTo?.id === u.id);
    return list.filter(t => t.createdBy.id === u.id);
  };

  const fetchTickets = async () => {
    isLoading.value = true;
    try {
      const data = await apiService.getTickets();
      tickets.value = visibleForUser(data);
      saveToLocalStorage();
    } catch (error) {
      console.warn('API getTickets failed, falling back to local storage/mock data', error);
      if (!loadFromLocalStorage()) {
        tickets.value = visibleForUser(JSON.parse(JSON.stringify(mockTickets)));
        saveToLocalStorage();
      } else {
        tickets.value = visibleForUser(tickets.value);
      }
    } finally {
      isLoading.value = false;
    }
  };

  const getTicketById = (id: string) => {
    return computed(() => tickets.value.find(t => t.id === id));
  };

  const createTicket = async (
    title: string,
    description: string,
    category: TicketCategory,
    priority: TicketPriority,
    attachments: { name: string; size: string; type: string }[],
    aiSuggestion?: Ticket['aiSuggestion']
  ) => {
    if (!authStore.user) return;
    
    const ticketPayload = {
      title,
      description,
      category,
      priority,
      status: 'open' as TicketStatus,
      createdBy: authStore.user,
      attachments: attachments.map(a => ({ ...a, url: '#', uploadedAt: new Date().toISOString(), uploadedBy: authStore.user!.name })),
      ...(aiSuggestion ? { aiSuggestion } : {})
    };

    try {
      const newTicket = await apiService.createTicket(ticketPayload);
      tickets.value.unshift(newTicket);
      saveToLocalStorage();
      return newTicket;
    } catch (error) {
      console.warn('API createTicket failed, creating ticket locally', error);
      
      // Local fallback
      const generatedId = `TRX-${Math.floor(1000 + Math.random() * 9000)}`;
      const newTicket: Ticket = {
        id: generatedId,
        title,
        description,
        category,
        priority,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: authStore.user,
        comments: [],
        attachments: attachments.map((a, index) => ({
          id: `a_new_${index}`,
          name: a.name,
          size: a.size,
          type: a.type,
          url: '#',
          uploadedAt: new Date().toISOString(),
          uploadedBy: authStore.user!.name
        })),
        history: [
          {
            id: `h_new_0`,
            ticketId: generatedId,
            field: 'status',
            oldValue: '',
            newValue: 'open',
            changedBy: authStore.user,
            changedAt: new Date().toISOString()
          }
        ]
      };
      
      tickets.value.unshift(newTicket);
      saveToLocalStorage();
      return newTicket;
    }
  };

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    if (!authStore.user) return;
    const ticket = tickets.value.find(t => t.id === ticketId);
    if (!ticket) return;

    const oldStatus = ticket.status;

    try {
      const updated = await apiService.updateTicketStatus(ticketId, status);
      const idx = tickets.value.findIndex(t => t.id === ticketId);
      if (idx !== -1) {
        tickets.value[idx] = updated;
        saveToLocalStorage();
      }
    } catch (error) {
      console.warn('API updateTicketStatus failed, updating locally', error);
      
      ticket.status = status;
      ticket.updatedAt = new Date().toISOString();
      
      const newHistory: HistoryEntry = {
        id: `h_local_${Date.now()}`,
        ticketId,
        field: 'status',
        oldValue: oldStatus,
        newValue: status,
        changedBy: authStore.user,
        changedAt: new Date().toISOString()
      };
      ticket.history.push(newHistory);
      saveToLocalStorage();
    }
  };

  const assignTicket = async (ticketId: string, assignedTo: User) => {
    if (!authStore.user) return;
    const ticket = tickets.value.find(t => t.id === ticketId);
    if (!ticket) return;

    const oldAssigned = ticket.assignedTo?.name || 'Non assigné';

    try {
      const updated = await apiService.assignTicket(ticketId, assignedTo.id);
      const idx = tickets.value.findIndex(t => t.id === ticketId);
      if (idx !== -1) {
        tickets.value[idx] = updated;
        saveToLocalStorage();
      }
    } catch (error) {
      console.warn('API assignTicket failed, assigning locally', error);
      
      ticket.assignedTo = assignedTo;
      ticket.updatedAt = new Date().toISOString();
      
      const newHistory: HistoryEntry = {
        id: `h_local_${Date.now()}`,
        ticketId,
        field: 'assignedTo',
        oldValue: oldAssigned,
        newValue: assignedTo.name,
        changedBy: authStore.user,
        changedAt: new Date().toISOString()
      };
      ticket.history.push(newHistory);
      saveToLocalStorage();
    }
  };

  const addComment = async (ticketId: string, content: string, isInternal = false) => {
    if (!authStore.user) return;
    const ticket = tickets.value.find(t => t.id === ticketId);
    if (!ticket) return;

    try {
      const newComment = await apiService.addComment(ticketId, content, isInternal);
      ticket.comments.push(newComment);
      ticket.updatedAt = new Date().toISOString();
      saveToLocalStorage();
    } catch (error) {
      console.warn('API addComment failed, adding comment locally', error);
      
      const newComment: Comment = {
        id: `c_local_${Date.now()}`,
        ticketId,
        author: authStore.user,
        content,
        createdAt: new Date().toISOString(),
        isInternal
      };
      ticket.comments.push(newComment);
      ticket.updatedAt = new Date().toISOString();
      saveToLocalStorage();
    }
  };

  const submitEvaluation = async (ticketId: string, score: number, comment: string) => {
    const ticket = tickets.value.find(t => t.id === ticketId);
    if (!ticket) return;

    try {
      await apiService.submitEvaluation(ticketId, score, comment);
      ticket.satisfactionRating = { score, comment };
      saveToLocalStorage();
    } catch (error) {
      console.warn('API submitEvaluation failed, saving evaluation locally', error);
      ticket.satisfactionRating = { score, comment };
      saveToLocalStorage();
    }
  };

  const getAISuggestion = async (title: string, description: string) => {
    try {
      return await apiService.getAISuggestions(title, description);
    } catch (error) {
      console.warn('AI suggestions API failed, generating smart mock suggestions', error);
      
      // Smart local fallback parser
      let category: TicketCategory = 'other';
      let priority: TicketPriority = 'low';
      let suggestedResponse = '';
      let selfHelpSteps: string[] = [];
      
      const text = `${title} ${description}`.toLowerCase();
      if (text.includes('vpn') || text.includes('réseau') || text.includes('connexion') || text.includes('internet')) {
        category = 'network';
        priority = 'high';
        suggestedResponse = "Bonjour, ce problème de réseau/VPN semble critique. Nous vous recommandons de vérifier vos pilotes réseau, votre mot de passe SSO et la configuration de votre DNS.";
        selfHelpSteps = ['Vérifier Internet', 'Redémarrer le client VPN', 'Vérifier date/heure Windows'];
      } else if (text.includes('phishing') || text.includes('sécurité') || text.includes('piratage') || text.includes('suspect')) {
        category = 'security';
        priority = 'urgent';
        suggestedResponse = "ATTENTION : Alerte sécurité. Ne cliquez sur aucun lien suspect et changez votre mot de passe si nécessaire.";
        selfHelpSteps = ['Ne pas cliquer', 'Signaler le mail', 'Changer le mot de passe si interaction'];
      } else if (text.includes('outlook') || text.includes('office') || text.includes('logiciel') || text.includes('word') || text.includes('excel')) {
        category = 'software';
        priority = 'medium';
        suggestedResponse = "Bonjour, pour les dysfonctionnements Office365 ou logiciels, essayez de redémarrer l'application ou d'effectuer une réparation rapide.";
        selfHelpSteps = ['Redémarrer l\'application', 'Réparer Office', 'Clear cache'];
      } else if (text.includes('imprimante') || text.includes('écran') || text.includes('ordinateur') || text.includes('clavier') || text.includes('matériel')) {
        category = 'hardware';
        priority = 'low';
        suggestedResponse = "Bonjour, votre demande concerne du matériel physique. Un technicien peut intervenir si le diagnostic de base échoue.";
        selfHelpSteps = ['Tester un autre câble/périphérique', 'Redémarrer le poste', 'Noter marque/modèle'];
      } else {
        category = 'other';
        priority = 'medium';
        suggestedResponse = "Bonjour, nous avons bien pris en compte votre ticket. Un agent du support IT Tritux va analyser votre demande.";
      }

      return {
        category,
        priority,
        suggestedResponse,
        confidence: 85,
        canSelfResolve: selfHelpSteps.length > 0,
        selfHelpSteps,
        model: 'local_fallback'
      };
    }
  };

  return {
    tickets,
    isLoading,
    fetchTickets,
    getTicketById,
    createTicket,
    updateTicketStatus,
    assignTicket,
    addComment,
    submitEvaluation,
    getAISuggestion
  };
});
