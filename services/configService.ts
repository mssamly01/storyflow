export interface AppConfig {
  geminiApiKey?: string;
  geminiModel?: string;
}

const STORAGE_KEY = 'storyflow_user_config';

let currentConfig: AppConfig = {};

const readLocalConfig = (): AppConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeLocalConfig = (config: AppConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const initConfig = async (): Promise<AppConfig> => {
  const localConfig = readLocalConfig();
  currentConfig = localConfig;

  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const serverConfig = await response.json();
      currentConfig = { ...localConfig, ...serverConfig };
      writeLocalConfig(currentConfig);
    }
  } catch {
    currentConfig = localConfig;
  }

  return currentConfig;
};

export const getConfig = (): AppConfig => currentConfig;

export const saveConfig = async (config: AppConfig): Promise<{ savedToServer: boolean }> => {
  currentConfig = { ...currentConfig, ...config };
  writeLocalConfig(currentConfig);

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentConfig)
    });

    if (!response.ok) {
      throw new Error('Config API returned an error.');
    }

    return { savedToServer: true };
  } catch {
    return { savedToServer: false };
  }
};
