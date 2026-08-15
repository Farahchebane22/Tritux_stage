<template>
  <div class="min-h-screen bg-slate-50">
    <header class="flex items-center justify-between px-6 md:px-12 py-5 max-w-5xl mx-auto">
      <div class="font-display font-bold text-lg text-slate-900">Tritux <span class="text-blue-700">Helpdesk</span></div>
      <div class="flex gap-3 text-sm">
        <a href="mailto:commercial@tritux.com" class="text-slate-500 hover:text-slate-800">Nous contacter</a>
        <router-link
          to="/login"
          class="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium"
        >
          Se connecter
        </router-link>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 md:px-12 py-16">
      <h1 class="font-display text-4xl md:text-5xl font-bold text-slate-900 leading-tight max-w-xl">
        Maintenance IT sous contrat, avec SLA mesurable
      </h1>
      <p class="mt-4 text-slate-500 max-w-lg leading-relaxed">
        Plateforme SaaS B2B Tritux : vos sociétés et applications soumettent des tickets IT
        traités selon le niveau de service de votre contrat (8/5, 5/7, 24/7).
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <router-link
          to="/login"
          class="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style="background: linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)"
        >
          Se connecter
        </router-link>
        <a
          href="mailto:commercial@tritux.com?subject=Demande%20contrat%20maintenance"
          class="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-800"
        >
          Nous contacter
        </a>
      </div>

      <div class="mt-14 grid sm:grid-cols-3 gap-4">
        <article v-for="p in plans" :key="p.title" class="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 class="font-display font-bold text-lg">{{ p.title }}</h3>
          <p class="text-sm text-slate-500 mt-1">{{ p.desc }}</p>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const plans = [
  { title: '8/5', desc: 'Jours ouvrés, fenêtre horaire standard, portail + IA.' },
  { title: '5/7', desc: 'Semaine complète, escalade urgente, rapports SLA.' },
  { title: '24/7', desc: 'Couverture continue, SMS/téléphone, cyber analyse.' },
];
</script>
