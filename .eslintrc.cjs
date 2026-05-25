module.exports = {
    root: true,
    ignorePatterns: ["**/dist/**", "**/coverage/**", "node_modules"],
    env: {
        es2022: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
        },
    },
    plugins: ["@typescript-eslint", "react-hooks"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
    ],
    rules: {
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            },
        ],
    },
    overrides: [
        {
            files: ["packages/client/src/**/*.{ts,tsx}"],
            env: {
                browser: true,
            },
        },
        {
            files: ["packages/server/src/**/*.ts", "scripts/**/*.mjs"],
            env: {
                node: true,
            },
        },
        {
            files: ["**/*.test.ts", "**/*.test.tsx"],
            env: {
                node: true,
            },
        },
    ],
};