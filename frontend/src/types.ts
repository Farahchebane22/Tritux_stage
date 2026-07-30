export type TicketStatus = 'open' | 'inprogress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'hardware' | 'software' | 'network' | 'account' | 'email' | 'security' | 'other';
export type UserRole = 'user' | 'agent' | 'admin';
export type NotificationType = 'new_ticket' | 'status_change' | 'new_comment' | 'assignment';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  /** Domaines / catégories IT dont l'agent est spécialiste */
  specialties?: TicketCategory[];
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
