import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthServices, User } from '../../auth-services';
import { filter } from 'rxjs/operators';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-navbar.component.ts',
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.ts.html',
  styleUrl: './navbar.component.ts.css',
})
export class NavbarComponentTs implements OnInit {

 currentUser: User | null = null;
  currentRoute = '';
  showUserMenu = false;
  isMobileMenuOpen = false;

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      icon: 'home',
      route: '/dashboard'
    },
    {
      label: 'Facturas',
      icon: 'receipt',
      route: '/invoices',
      badge: 3
    },
    {
      label: 'Notas Crédito',
      icon: 'document',
      route: '/credit-notes'
    },
    {
      label: 'Clientes',
      icon: 'users',
      route: '/clients'
    },
    {
      label: 'Productos',
      icon: 'cube',
      route: '/products'
    },
    {
      label: 'Tienda',
      icon: 'shop',
      route: '/shop'
    },
    {
      label: 'Reportes',
      icon: 'chart',
      route: '/reports'
    },
    {
      label: 'Configuración',
      icon: 'settings',
      route: '/settings'
    }
  ];
    constructor(
    private authService: AuthServices,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Obtener usuario actual
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Trackear ruta actual
    this.currentRoute = this.router.url;
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.url;
        this.isMobileMenuOpen = false; // Cerrar menú móvil al navegar
      });

    // Cerrar menú al hacer click fuera
    document.addEventListener('click', this.closeMenus.bind(this));
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute.startsWith(route);
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMenus(): void {
    this.showUserMenu = false;
  }

  logout(): void {
    this.authService.logout();
  }

  getUserInitials(): string {
    if (!this.currentUser?.username) return 'U';
    return this.currentUser.username
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}



