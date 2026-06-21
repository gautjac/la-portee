import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts on purpose: importing `vitest/config`
// and `vite` in the same file triggers a UserConfig type clash (a sibling app
// hit this). The music engine tests don't need the React plugin.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
