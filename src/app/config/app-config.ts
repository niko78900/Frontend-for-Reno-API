import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  apiKey: string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: 'http://localhost:8080',
  apiKey: 'dev-local-key'
};

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

type PartialAppConfig = Partial<AppConfig>;

const loadConfigFile = async (path: string): Promise<PartialAppConfig | null> => {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PartialAppConfig;
  } catch {
    return null;
  }
};

export const loadAppConfig = async (): Promise<AppConfig> => {
  const localConfig = await loadConfigFile('/config.local.json');
  if (localConfig) {
    return { ...DEFAULT_APP_CONFIG, ...localConfig };
  }

  const config = await loadConfigFile('/config.json');
  if (config) {
    return { ...DEFAULT_APP_CONFIG, ...config };
  }

  return DEFAULT_APP_CONFIG;
};
