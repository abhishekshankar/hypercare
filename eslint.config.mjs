import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/cdk.out/**",
      "apps/web/**",
    ],
  },

  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [
      "packages/*/src/**/*.ts",
      "packages/*/test/**/*.ts",
      "infra/bin/**/*.ts",
      "infra/lib/**/*.ts",
    ],
  })),

  {
    files: [
      "packages/*/src/**/*.ts",
      "packages/*/test/**/*.ts",
      "infra/bin/**/*.ts",
      "infra/lib/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);
