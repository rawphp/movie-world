import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from './views/LibraryView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    { path: '/movie/:id', name: 'movie', component: () => import('./views/MovieDetailView.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') }
  ]
})
