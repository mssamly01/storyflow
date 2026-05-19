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
  currentConfig = readLocalConfig();
  return currentConfig;
};

export const getConfig = (): AppConfig => currentConfig;

export const saveConfig = async (config: AppConfig): Promise<void> => {
  currentConfig = { ...currentConfig, ...config };
  writeLocalConfig(currentConfig);
};
