import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard/auth.guard';

export const routes: Routes = [
  // Redirigir raíz a dashboard
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

  // Dashboard (protegido con layout)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then(m => m.Layout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./invoices/invoice-list/invoice-list.component').then(m => m.InvoiceListComponent)
      },
      // Facturas
      {
        path: 'invoices',
        loadComponent: () => import('./invoices/invoice-list/invoice-list.component').then(m => m.InvoiceListComponent)
      },
      {
        path: 'invoices/create',
        loadComponent: () => import('./invoices/invoice.component.ts/invoice.component.ts').then(m => m.CreateInvoiceComponent)
      },
      {
        path: 'invoices/:id',
        loadComponent: () => import('./invoices/invoice.component.ts/invoice.component.ts').then(m => m.CreateInvoiceComponent)
      },
      // Notas Crédito
      {
        path: 'credit-notes',
        loadComponent: () => import('./credit-notes/credit-note-list/credit-note-list.component').then(m => m.CreditNoteListComponent)
      },
      {
        path: 'credit-notes/create',
        loadComponent: () => import('./credit-notes/credit-note-form/credit-note-form.component').then(m => m.CreditNoteFormComponent)
      },
      {
        path: 'credit-notes/:id',
        loadComponent: () => import('./credit-notes/credit-note-form/credit-note-form.component').then(m => m.CreditNoteFormComponent)
      },
      // Clientes
      {
        path: 'clients',
        loadComponent: () => import('./clients/clients').then(m => m.CreateClientComponent)
      },
      // Productos
      {
        path: 'products',
        loadComponent: () => import('./products/product-list/product-list').then(m => m.ProductListComponent)
      },
      {
        path: 'products/create',
        loadComponent: () => import('./products/create-product/create-product').then(m => m.CreateProductComponent)
      },
      {
        path: 'products/edit/:id',
        loadComponent: () => import('./products/create-product/create-product').then(m => m.CreateProductComponent)
      }
    ]
  },

  // 404 - Redirigir a login
  {
    path: '**',
    redirectTo: 'login'
  }
];