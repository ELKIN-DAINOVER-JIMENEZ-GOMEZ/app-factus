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
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then(m => m.Layout),
    children: [
  {
    path: 'invoices',
    canActivate: [authGuard],
    loadComponent: () => import('./invoices/invoice.component.ts/invoice.component.ts').then(m => m.CreateInvoiceComponent)
  },
  {
    path: 'clients',
    canActivate: [authGuard],
    loadComponent: () => import('./clients/clients').then(m => m.CreateClientComponent)
  },

  // 404
  {
    path: '**',
    redirectTo: 'login'
  }
]
  }
];