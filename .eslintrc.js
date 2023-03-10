module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: 'plugin:node/recommended',
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'node/no-unpublished-require': 'off',
    'node/no-extraneous-require': 'off',
    'import/no-extraneous-dependencies': 'off',
    'node/no-deprecated-api': 'error',
  },
}
