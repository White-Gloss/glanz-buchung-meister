import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    /**
     * Serverseitige Module protokollieren ausschliesslich ueber
     * `src/lib/serverLog.ts`.
     *
     * Ein direktes `console.error(text, fehler)` gibt aus, was der Fehler
     * mitbringt: PostgreSQL hängt den auslösenden Wert an, und Antworttexte
     * fremder Dienste — Resend, Telegram, Meta — können die
     * Empfängeradresse oder -nummer enthalten. So landen Kundendaten im
     * Prozessprotokoll. Ausserdem sieht der Betrieb solche Zeilen nicht im
     * Störungsprotokoll des Adminbereichs.
     *
     * `serverLog.ts` selbst ist ausgenommen: dort steht die einzige Stelle,
     * die tatsaechlich auf die Konsole schreibt.
     */
    files: ["src/lib/*.server.ts", "src/lib/*.functions.ts", "src/routes/api.*.ts"],
    ignores: ["src/lib/serverLog.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Deno: "readonly",
      },
    },
  },
  eslintPluginPrettier,
);
