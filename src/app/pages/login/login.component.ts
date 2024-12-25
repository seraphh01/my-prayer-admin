// src/app/pages/auth/login.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [CommonModule, FormsModule],
})
export class LoginComponent {
  email = '';
  password = '';
  errorMsg = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // If user is already logged in, redirect to the prayers page (or whatever route you want)
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/prayer-types']);
    }
  }

  async onLogin() {
    this.errorMsg = '';
    try {
      await this.authService.signIn(this.email, this.password);
      // Navigate to a protected route, e.g. /prayer-types
      this.router.navigate(['/prayers']);
    } catch (error: any) {
      this.errorMsg = error.message || 'Login failed';
      console.error('Login error:', error);
    }
  }
}
