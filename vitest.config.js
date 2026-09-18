import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    exclude: ["_backups/**", "node_modules/**", "android/**", "www/**"]
  }
});
