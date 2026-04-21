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
    files: ["packages/*/src/**/*.ts", "infra/bin/**/*.ts"],
  })),
);
