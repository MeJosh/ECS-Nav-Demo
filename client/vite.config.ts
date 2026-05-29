import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

function githubPagesBasePath() {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  return process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : "/";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverUrl = env.VITE_SERVER_URL || "http://localhost:3001";
  const websocketUrl = serverUrl.replace(/^http/, "ws");

  return {
    base: env.VITE_BASE_PATH || githubPagesBasePath(),
    plugins: [vue()],
    server: {
      port: 3000,
      proxy: {
        "/api": serverUrl,
        "/ws": {
          target: websocketUrl,
          ws: true
        }
      }
    }
  };
});
