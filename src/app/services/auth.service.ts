import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { APP_CONFIG, AppConfig } from '../config/app-config';

export interface LoginResponse {
  token: string;
  tokenType?: string;
  username: string;
  role: string;
}

export interface UserResponse {
  id: string;
  username: string;
  role: string;
  enabled: boolean;
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  username: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly storageKey = 'homereno.auth';
  private readonly apiBaseUrl: string;
  private readonly sessionSubject: BehaviorSubject<AuthSession | null>;
  readonly session$: Observable<AuthSession | null>;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    this.apiBaseUrl = (appConfig?.apiBaseUrl ?? '').trim().replace(/\/+$/, '');
    this.sessionSubject = new BehaviorSubject<AuthSession | null>(this.loadSession());
    this.session$ = this.sessionSubject.asObservable();
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.buildUrl('/api/auth/login'), { username, password }).pipe(
      tap((response) => {
        if (!response?.token) {
          return;
        }
        this.setSession({
          token: response.token,
          username: response.username,
          role: response.role
        });
      })
    );
  }

  register(username: string, password: string): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.buildUrl('/api/auth/register'), { username, password });
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem(this.storageKey);
    this.sessionSubject.next(null);
  }

  getToken(): string | null {
    return this.sessionSubject.value?.token ?? null;
  }

  getRole(): string | null {
    return this.sessionSubject.value?.role ?? null;
  }

  isAuthenticated(): boolean {
    return Boolean(this.sessionSubject.value?.token);
  }

  isAdmin(): boolean {
    return this.sessionSubject.value?.role === 'ADMIN';
  }

  private setSession(session: AuthSession): void {
    this.sessionSubject.next(session);
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  private loadSession(): AuthSession | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return null;
      }
      const parsed = JSON.parse(stored) as Partial<AuthSession>;
      if (!parsed?.token || !parsed?.username || !parsed?.role) {
        return null;
      }
      return {
        token: parsed.token,
        username: parsed.username,
        role: parsed.role
      };
    } catch {
      return null;
    }
  }

  private buildUrl(path: string): string {
    if (!this.apiBaseUrl) {
      return path;
    }
    return `${this.apiBaseUrl}${path}`;
  }
}
