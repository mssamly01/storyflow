
export interface AppConfig {
  geminiApiKey: string;
  geminiModel: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  geminiApiKey: '',
  geminiModel: '',
};

let currentConfig: AppConfig = { ...DEFAULT_CONFIG };

export const initConfig = async (): Promise<AppConfig> => {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      currentConfig = { ...DEFAULT_CONFIG, ...data };
    }
  } catch (e) {
    console.error('Failed to load config from server', e);
  }
  return currentConfig;
};

export const getConfig = (): AppConfig => {
  return currentConfig;
};

export const saveConfig = async (config: AppConfig) => {
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (response.ok) {
      currentConfig = config;
    } else {
      throw new Error('Failed to save config to server');
    }
  } catch (e) {
    console.error('Failed to save config', e);
    throw e;
  }
};
