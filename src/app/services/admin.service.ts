import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { APP_CONFIG, AppConfig } from '../config/app-config';

export interface PendingUser {
  id: string;
  username: string;
  role: string;
  enabled: boolean;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiBaseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    this.apiBaseUrl = (appConfig?.apiBaseUrl ?? '').trim().replace(/\/+$/, '');
  }

  getPendingUsers(): Observable<PendingUser[]> {
    return this.http.get<unknown>(this.buildUrl('/api/admin/users/pending')).pipe(
      map((response) => this.normalizeUsers(response))
    );
  }

  approveUser(id: string): Observable<PendingUser> {
    return this.http.post<PendingUser>(this.buildUrl(`/api/admin/users/${id}/approve`), {});
  }

  private buildUrl(path: string): string {
    if (!this.apiBaseUrl) {
      return path;
    }
    return `${this.apiBaseUrl}${path}`;
  }

  private normalizeUsers(raw: unknown): PendingUser[] {
    if (Array.isArray(raw)) {
      return raw as PendingUser[];
    }
    if (raw && typeof raw === 'object') {
      const candidate = raw as { users?: unknown; data?: unknown };
      if (Array.isArray(candidate.users)) {
        return candidate.users as PendingUser[];
      }
      if (Array.isArray(candidate.data)) {
        return candidate.data as PendingUser[];
      }
    }
    return [];
  }
}
