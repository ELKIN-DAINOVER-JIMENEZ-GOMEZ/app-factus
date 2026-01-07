import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard/auth.guard';
import { ProductListComponent } from './products/product-list/product-list';
import { CreateProductComponent } from './products/create-product/create-product';

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
  path: 'invoices/:id',
  canActivate: [authGuard],
  loadComponent: () => import('./invoices/invoice.component.ts/invoice.component.ts').then(m => m.CreateInvoiceComponent)
},
  {
    path: 'clients',
    canActivate: [authGuard],
    loadComponent: () => import('./clients/clients').then(m => m.CreateClientComponent)
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () => import('./products/product-list/product-list').then(m => m.ProductListComponent)
  },
  {
    path: 'products/create',
    canActivate: [authGuard],
    loadComponent: () => import('./products/create-product/create-product').then(m => m.CreateProductComponent)
    
  },
  {
    path: 'products/edit/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./products/create-product/create-product').then(m => m.CreateProductComponent)
  },

  // 404
  {
    path: '**',
    redirectTo: 'login'
  }
]
  }
];