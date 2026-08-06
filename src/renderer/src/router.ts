import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from './views/LibraryView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView, meta: { title: 'Library' } },
    {
      path: '/movie/:id',
      name: 'movie',
      component: () => import('./views/MovieDetailView.vue'),
      meta: { title: 'Movie' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
      meta: { title: 'Settings' }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./views/NotFoundView.vue'),
      meta: { title: 'Not found' }
    }
  ]
})

router.afterEach((to) => {
  const page = typeof to.meta.title === 'string' ? to.meta.title : null
  document.title = page && page !== 'Library' ? `${page} · Movie World` : 'Movie World'
})
