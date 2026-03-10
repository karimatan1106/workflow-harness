/**
 * N-45: Testcontainers config (scaffold).
 * Requires Docker daemon to execute.
 */

export interface ContainerConfig {
  image: string;
  port: number;
  env?: Record<string, string>;
  readyLog?: string;
  startupTimeout?: number;
}

/** Pre-configured database containers for integration testing */
export const DB_CONTAINERS = {
  postgres: {
    image: 'postgres:16-alpine',
    port: 5432,
    env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
    readyLog: 'database system is ready to accept connections',
    startupTimeout: 30_000,
  },
  redis: {
    image: 'redis:7-alpine',
    port: 6379,
    readyLog: 'Ready to accept connections',
    startupTimeout: 15_000,
  },
  mysql: {
    image: 'mysql:8-oracle',
    port: 3306,
    env: { MYSQL_ROOT_PASSWORD: 'test', MYSQL_DATABASE: 'testdb' },
    readyLog: 'ready for connections',
    startupTimeout: 60_000,
  },
} as const satisfies Record<string, ContainerConfig>;

/** Message broker containers */
export const BROKER_CONTAINERS = {
  rabbitmq: {
    image: 'rabbitmq:3-management-alpine',
    port: 5672,
    readyLog: 'Server startup complete',
    startupTimeout: 30_000,
  },
} as const satisfies Record<string, ContainerConfig>;
