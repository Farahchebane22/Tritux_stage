import type { Ticket } from '../types';

/** Ticket urgent non assigné, couvert par le contrat (pas différé SLA). */
export function isUrgentUnassigned(ticket: Pick<Ticket, 'priority' | 'assignedTo' | 'slaDeferred'>): boolean {
  return ticket.priority === 'urgent' && !ticket.assignedTo && !ticket.slaDeferred;
}

export function waitingMinutesSince(createdAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
}

export function urgentEscalationLabel(ticket: Pick<Ticket, 'createdAt' | 'priority' | 'assignedTo' | 'slaDeferred'>): string {
  const mins = waitingMinutesSince(ticket.createdAt);
  return `Urgent — non assigné depuis ${mins} min`;
}
