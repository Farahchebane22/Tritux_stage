import type { TicketCategory, User } from '../types';

export const categoryLabels: Record<TicketCategory, string> = {
  hardware: 'Matériel',
  software: 'Logiciel',
  network: 'Réseau',
  account: 'Compte & accès',
  email: 'Email',
  security: 'Sécurité',
  other: 'Autre',
};

/** Default specialties when API does not return them (fallback demo). */
export const defaultAgentSpecialties: Record<string, TicketCategory[]> = {
  u2: ['network', 'security', 'account'],
  u3: ['software', 'email', 'hardware'],
};

export function agentSpecialties(agent: User): TicketCategory[] {
  if (agent.specialties?.length) return agent.specialties;
  return defaultAgentSpecialties[agent.id] || ['other'];
}

export function agentMatchesCategory(agent: User, category: TicketCategory): boolean {
  const specs = agentSpecialties(agent);
  if (category === 'other') return specs.includes('other') || specs.length > 0;
  return specs.includes(category);
}

export function splitAgentsByCategory(agents: User[], category: TicketCategory) {
  const assignable = agents.filter(a => a.role === 'agent');
  const specialized = assignable.filter(a => agentMatchesCategory(a, category));
  const others = assignable.filter(a => !agentMatchesCategory(a, category));
  return { specialized, others, all: assignable };
}
