import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { AuthService } from '../services/auth.service';
import { AppMessageService } from '../services/app-message.service';

const isRequestFor = (url: string, root: string): boolean => {
  if (!root) {
    return false;
  }
  return url === root || url.startsWith(`${root}/`) || url.startsWith(`${root}?`);
};

const isAbsoluteUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export const apiKeyJwtInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);
  const router = inject(Router);
  const authService = inject(AuthService);
  const messageService = inject(AppMessageService);
  const apiKey = config?.apiKey?.trim();
  const apiBaseUrl = config?.apiBaseUrl?.trim().replace(/\/+$/, '');
  const apiRoot = apiBaseUrl ? `${apiBaseUrl}/api` : '';
  const uploadsRoot = apiBaseUrl ? `${apiBaseUrl}/uploads` : '';
  const isSameOrigin = !isAbsoluteUrl(request.url) || Boolean(apiBaseUrl && request.url.startsWith(apiBaseUrl));
  const isApiRequest = isRequestFor(request.url, apiRoot) || isRequestFor(request.url, '/api');
  const isUploadsRequest = isRequestFor(request.url, uploadsRoot) || isRequestFor(request.url, '/uploads');
  const isAuthRequest = isRequestFor(request.url, `${apiRoot}/auth`) || isRequestFor(request.url, '/api/auth');
  const isLoginRequest = isRequestFor(request.url, `${apiRoot}/auth/login`) || isRequestFor(request.url, '/api/auth/login');
  const shouldAttachApiKey = Boolean(apiKey) && isSameOrigin;

  let headers = request.headers;

  if (shouldAttachApiKey && !headers.has('X-API-KEY')) {
    headers = headers.set('X-API-KEY', apiKey!);
  }

  const token = authService.getToken();
  const shouldAttachAuth = Boolean(token) && isSameOrigin && !isAuthRequest && !isUploadsRequest;
  if (shouldAttachAuth && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  const nextRequest = headers === request.headers ? request : request.clone({ headers });

  return next(nextRequest).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!isSameOrigin && !isApiRequest && !isUploadsRequest) {
        return throwError(() => err);
      }

      if (err.status === 401) {
        authService.clearSession();
        router.navigate(['/login']);
      } else if (err.status === 403 && !isLoginRequest) {
        messageService.show('Access denied', 'error');
      }

      return throwError(() => err);
    })
  );
};

export const apiKeyInterceptor = apiKeyJwtInterceptor;
