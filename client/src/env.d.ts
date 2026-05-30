/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_SIMULATION_MODE?: "remote" | "local";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
