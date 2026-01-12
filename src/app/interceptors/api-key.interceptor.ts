import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

export const apiKeyInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);
  const apiKey = config?.apiKey?.trim();
  const apiBaseUrl = config?.apiBaseUrl?.trim().replace(/\/+$/, '');

  if (!apiKey || !apiBaseUrl || !request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }

  if (request.headers.has('X-API-KEY')) {
    return next(request);
  }

  return next(
    request.clone({
      headers: request.headers.set('X-API-KEY', apiKey)
    })
  );
};
