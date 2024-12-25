// src/app/core/services/auth.service.ts
import { Injectable } from '@angular/core';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _user: User | null = null;
  private _session: Session | null = null;

  constructor(private supabase: SupabaseService) {    this.initSession(); // Load session from localStorage on service creation

    // Listen for auth state changes
    this.supabase.client.auth.onAuthStateChange((event, session) => {
      this._session = session;
      this._user = session?.user ?? null;
    });
  }

  public async initSession() {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (!error && data.session) {
      this._session = data.session;
      this._user = data.session.user;
    }
  }
  /**
   * Sign up with email/password
   * Returns the newly created user or throws error
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Sign in with email/password
   * Returns session/user data or throws error
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get the current Supabase session
   */
  get session(): Session | null {
    return this._session;
  }

  /**
   * Get the current authenticated user (or null if not logged in)
   */
  get user(): User | null {
    return this._user;
  }

  /**
   * Check if a user is currently logged in
   */
  isLoggedIn(): boolean {
    return !!this._user;
  }
}
