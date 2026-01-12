import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

export const apiKeyInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);
  const apiKey = config?.apiKey?.trim();
  const apiBaseUrl = config?.apiBaseUrl?.trim().replace(/\/+$/, '');
  const apiRoot = apiBaseUrl ? `${apiBaseUrl}/api` : '';
  const isAbsoluteApiRequest = apiRoot
    ? request.url === apiRoot
      || request.url.startsWith(`${apiRoot}/`)
      || request.url.startsWith(`${apiRoot}?`)
    : false;
  const isRelativeApiRequest = request.url === '/api'
    || request.url.startsWith('/api/')
    || request.url.startsWith('/api?');
  const isApiRequest = isAbsoluteApiRequest || isRelativeApiRequest;

  if (!apiKey || !isApiRequest) {
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
