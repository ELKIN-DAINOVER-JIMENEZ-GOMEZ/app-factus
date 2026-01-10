import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthServices, User } from '../../services/auth-services';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  currentRoute = '';
  showUserMenu = false;
  isMobileMenuOpen = false;

  navItems: NavItem[] = [
    { label: 'Facturas', icon: 'receipt', route: '/invoices' },
    { label: 'Notas Crédito', icon: 'document', route: '/credit-notes' },
    { label: 'Clientes', icon: 'users', route: '/clients' },
    { label: 'Productos', icon: 'cube', route: '/products' }
  ];

  constructor(
    private authService: AuthServices,
    private router: Router
  ) {}

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') {
      document.body.classList.add('dark-theme');
    }

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => this.currentUser = user);

    this.currentRoute = this.router.url;
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.currentRoute = event.url;
        this.isMobileMenuOpen = false;
      });

    document.addEventListener('click', this.closeMenus.bind(this));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.closeMenus.bind(this));
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

  toggleDarkTheme(): void {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('darkTheme', isDark ? 'true' : 'false');
  }

  isDarkTheme(): boolean {
    return document.body.classList.contains('dark-theme');
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



