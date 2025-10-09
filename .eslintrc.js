/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "prettier"],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};
