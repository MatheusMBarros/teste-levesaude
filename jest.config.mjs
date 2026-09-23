// @ts-check

/** @type {import('ts-jest').TsJestTransformerOptions} */
const tsJestOptions = { tsconfig: '<rootDir>/tsconfig.json' };

/** @type {import('jest').Config['transform']} */
const transform = { '^.+\\.ts$': ['ts-jest', tsJestOptions] };

/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.spec.ts'],
      transform,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/integration'],
      testMatch: ['**/*.spec.ts'],
      transform,
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/e2e'],
      testMatch: ['**/*.spec.ts'],
      transform,
    },
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageThreshold: {
    './src/domain/': { lines: 90, branches: 90, functions: 90, statements: 90 },
    './src/application/': { lines: 90, branches: 90, functions: 90, statements: 90 },
  },
};

export default config;
