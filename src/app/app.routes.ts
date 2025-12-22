import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard/auth.guard';

export const routes: Routes = [
  // Redirigir raíz
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  // Login (público)
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then(m => m.Login)
  },

  // Dashboard (protegido)
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./navbar/navbar.component.ts/navbar.component.ts').then(m => m.NavbarComponentTs)
  },

  // 404
  {
    path: '**',
    redirectTo: 'login'
  }
];