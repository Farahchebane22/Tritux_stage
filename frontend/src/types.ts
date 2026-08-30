export type TicketStatus = 'open' | 'inprogress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'hardware' | 'software' | 'network' | 'account' | 'email' | 'security' | 'other';
export type UserRole = 'user' | 'agent' | 'admin' | 'SUPER_ADMIN' | 'AGENT_IT' | 'CLIENT_ADMIN' | 'CLIENT_USER';
export type NotificationType = 'new_ticket' | 'status_change' | 'new_comment' | 'assignment' | 'urgent_escalation';

export type CyberRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CyberAnalysis {
  riskLevel: CyberRiskLevel;
  riskScore: number;
  threatType: string;
  threatLabel: string;
  priority: TicketPriority;
  confidence: number;
  summary: string;
  indicators: string[];
  immediateActions: string[];
  suggestTicket: boolean;
  urls: string[];
  provider?: string | null;
  category: 'security';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  /** Domaines / catégories IT dont l'agent est spécialiste */
  specialties?: TicketCategory[];
  societeId?: string | null;
  keycloakId?: string | null;
  phone?: string | null;
  joinDate: string;
  ticketsCreated?: number;
  ticketsResolved?: number;
}

export interface Comment {
  id: string;
  ticketId: string;
  author: User;
  content: string;
  createdAt: string;
  isInternal?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface HistoryEntry {
  id: string;
  ticketId: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: User;
  changedAt: string;
}

export interface AISuggestion {
  category: TicketCategory;
  priority: TicketPriority;
  suggestedResponse: string;
  confidence: number;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  assignedTo?: User;
  comments: Comment[];
  attachments: Attachment[];
  history: HistoryEntry[];
  aiSuggestion?: AISuggestion;
  satisfactionRating?: { score: number; comment: string };
  societeId?: string | null;
  applicationId?: string | null;
  contratId?: string | null;
  slaDeadline?: string | null;
  slaDeferred?: boolean;
  slaResumeAt?: string | null;
}

export interface EscalationTicket {
  id: string;
  title: string;
  category: TicketCategory;
  societeId?: string | null;
  societeName?: string | null;
  createdAt: string;
  waitingMinutes: number;
  palier: number;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  ticketId?: string;
  ticketTitle?: string;
  read: boolean;
  createdAt: string;
}

export type Screen =
  | 'login'
  | 'dashboard'
  | 'tickets'
  | 'create-ticket'
  | 'ticket-detail'
  | 'notifications'
  | 'profile';
