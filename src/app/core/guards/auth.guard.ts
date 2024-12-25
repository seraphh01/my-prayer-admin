// src/app/core/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.isLoggedIn()) {
      return true;
    }
    // If not logged in, redirect to a /login page (or wherever you want)
    this.router.navigate(['/login']);
    return false;
  }
}
