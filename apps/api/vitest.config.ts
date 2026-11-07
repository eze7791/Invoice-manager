import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Los tests de base de datos comparten la misma base de pruebas.
    fileParallelism: false,
  },
});
