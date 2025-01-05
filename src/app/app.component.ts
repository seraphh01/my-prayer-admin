import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  selector: 'app-root',
  template: `
  <ng-container *ngIf="auth.isLoggedIn()">
  <nav>
      <a style="display: inline; color: black">CONGREGAȚIA SURORILOR MAICII DOMNULUI - PANOU ADMINISTRARE</a>
      <a routerLink="/prayers">Toate Rugăciunile</a>
      <a routerLink="/prayerTypes">Tipuri de Rugăciuni</a>
      <a routerLink="/sections">Secțiuni</a>
      <a routerLink="/liturgicalTexts">Texte</a>
      <div style="display: flex; float:right; width: min-content; gap: 1rem">
        <span >{{auth.user?.email}}</span>
        <button (click)="onLogout()">Delogare</button>
      </div>
    </nav>
    <hr />
  </ng-container>

    <router-outlet></router-outlet>
  `,
  styles: [`
    nav {
      margin: 1rem;
    }
    a {
      margin-right: 1rem;
      text-decoration: none;
      color: #0056b3;
    }
  `]
})
export class AppComponent {
  title = 'my-prayer-admin';

  constructor(protected auth: AuthService, protected router: Router) {}

  async onLogout() {
    try {
      await this.auth.signOut();
      this.router.navigate(['/login']);
    } catch (e) {
      console.error('Error logging out:', e);
    }
  }
}
