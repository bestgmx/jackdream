module.exports = {
  extends: ['react-app'],
  rules: {
    'no-unused-vars': 'warn',
    'default-case': 'warn',
    'react-hooks/exhaustive-deps': 'warn'
  },
  env: {
    production: true
  }
}; 