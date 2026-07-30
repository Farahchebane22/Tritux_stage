<template>
  <!-- Status Badge -->
  <span
    v-if="status"
    :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', statusConfig[status].bg, statusConfig[status].text]"
  >
    <span :class="['w-1.5 h-1.5 rounded-full', statusConfig[status].dot]" />
    {{ statusConfig[status].label }}
  </span>

  <!-- Priority Badge -->
  <span
    v-else-if="priority"
    :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', priorityConfig[priority].bg, priorityConfig[priority].text]"
  >
    <span class="flex items-end gap-0.5 h-3">
      <span
        v-for="i in [1, 2, 3, 4]"
        :key="i"
        :class="['w-0.5 rounded-sm transition-all', i <= priorityBars[priority] ? priorityConfig[priority].text.replace('text-', 'bg-') : 'bg-current opacity-20']"
        :style="{ height: `${i * 3}px` }"
      />
    </span>
    {{ priorityConfig[priority].label }}
  </span>

  <!-- Category Badge -->
  <span
    v-else-if="category"
    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700"
  >
    {{ categoryLabels[category] ?? category }}
  </span>
</template>

<script setup lang="ts">
import type { TicketStatus, TicketPriority } from '../../types';

defineProps<{
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
}>();

const statusConfig: Record<TicketStatus, { label: string; bg: string; text: string; dot: string }> = {
  open:       { label: 'Ouvert',    bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400' },
  inprogress: { label: 'En cours',  bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500' },
  resolved:   { label: 'Résolu',    bg: 'bg-emerald-50',  text: 'text-emerald-700',dot: 'bg-emerald-500' },
  closed:     { label: 'Fermé',     bg: 'bg-slate-200',   text: 'text-slate-700',  dot: 'bg-slate-500' },
};

const priorityConfig: Record<TicketPriority, { label: string; bg: string; text: string }> = {
  low:    { label: 'Basse',   bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  medium: { label: 'Moyenne', bg: 'bg-amber-50',    text: 'text-amber-700' },
  high:   { label: 'Haute',   bg: 'bg-orange-50',   text: 'text-orange-700' },
  urgent: { label: 'Urgente', bg: 'bg-red-50',      text: 'text-red-700' },
};

const priorityBars: Record<TicketPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

const categoryLabels: Record<string, string> = {
  hardware: 'Matériel',
  software: 'Logiciel',
  network: 'Réseau',
  account: 'Compte',
  email: 'Email',
  security: 'Sécurité',
  other: 'Autre',
};
</script>
