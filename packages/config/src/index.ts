/**
 * @servora/config
 * Foundational runtime configuration tokens and constants.
 */

export const APP_CONFIG = {
  name: 'SERVORA',
  tagline: 'Turn enquiries into customers.',
  defaultPort: 4000,
  defaultWebPort: 3000,
  apiPrefix: '/api/v1',
  supportedLocales: ['en'],
} as const;

export type AppConfig = typeof APP_CONFIG;
