import config from '@ctrl/eslint-config-biome';

export default [
  {
    ignores: ['dist', 'coverage', 'build'],
  },
  ...config,
  {
    rules: {
      'max-params': 'off',
    },
  },
];
