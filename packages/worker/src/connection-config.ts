/**
 * Connection Configuration
 *
 * A configuration system that reads connection details from environment variables
 * or accepts them as a config object. Provides a single source of truth for all
 * external service connections used by FlowForge workers.
 */

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface ConnectionConfig {
  /** PostgreSQL connection settings */
  postgres?: {
    connectionString: string;
    poolSize?: number;
  };

  /** Redis connection settings */
  redis?: {
    host: string;
    port: number;
    password?: string;
  };

  // AI providers
  /** OpenAI API configuration */
  openai?: { apiKey: string };
  /** Anthropic API configuration */
  anthropic?: { apiKey: string };

  // Integrations
  /** Slack bot/app token */
  slack?: { token: string };
  /** GitHub personal access token or app token */
  github?: { token: string };
}

// ────────────────────────────────────────────────────────────────
// Loader
// ────────────────────────────────────────────────────────────────

/**
 * Load connection configuration from environment variables.
 *
 * Reads from:
 * - POSTGRES_URL                -> postgres.connectionString
 * - POSTGRES_POOL_SIZE          -> postgres.poolSize
 * - REDIS_HOST                  -> redis.host
 * - REDIS_PORT                  -> redis.port
 * - REDIS_PASSWORD              -> redis.password
 * - OPENAI_API_KEY              -> openai.apiKey
 * - ANTHROPIC_API_KEY           -> anthropic.apiKey
 * - SLACK_TOKEN                 -> slack.token
 * - GITHUB_TOKEN                -> github.token
 *
 * Only sections with their required env vars set will be included in the result.
 * Missing optional fields are omitted rather than set to undefined.
 *
 * @param overrides  Optional partial config to merge on top of env-derived values.
 *                   Overrides take precedence over environment variables.
 */
export function loadConnectionConfig(overrides?: Partial<ConnectionConfig>): ConnectionConfig {
  const config: ConnectionConfig = {};

  // ── PostgreSQL ──────────────────────────────────────────────
  const postgresUrl = process.env['POSTGRES_URL'];
  if (postgresUrl) {
    const poolSizeStr = process.env['POSTGRES_POOL_SIZE'];
    config.postgres = {
      connectionString: postgresUrl,
      ...(poolSizeStr ? { poolSize: parseInt(poolSizeStr, 10) } : {}),
    };
  }

  // ── Redis ───────────────────────────────────────────────────
  const redisHost = process.env['REDIS_HOST'];
  if (redisHost) {
    const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
    const redisPassword = process.env['REDIS_PASSWORD'];
    config.redis = {
      host: redisHost,
      port: redisPort,
      ...(redisPassword ? { password: redisPassword } : {}),
    };
  }

  // ── OpenAI ──────────────────────────────────────────────────
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (openaiKey) {
    config.openai = { apiKey: openaiKey };
  }

  // ── Anthropic ───────────────────────────────────────────────
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (anthropicKey) {
    config.anthropic = { apiKey: anthropicKey };
  }

  // ── Slack ───────────────────────────────────────────────────
  const slackToken = process.env['SLACK_TOKEN'];
  if (slackToken) {
    config.slack = { token: slackToken };
  }

  // ── GitHub ──────────────────────────────────────────────────
  const githubToken = process.env['GITHUB_TOKEN'];
  if (githubToken) {
    config.github = { token: githubToken };
  }

  // ── Merge overrides ─────────────────────────────────────────
  if (overrides) {
    return mergeConfig(config, overrides);
  }

  return config;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function mergeConfig(
  base: ConnectionConfig,
  overrides: Partial<ConnectionConfig>,
): ConnectionConfig {
  const result: ConnectionConfig = { ...base };

  if (overrides.postgres) {
    result.postgres = { ...base.postgres, ...overrides.postgres } as ConnectionConfig['postgres'];
  }
  if (overrides.redis) {
    result.redis = { ...base.redis, ...overrides.redis } as ConnectionConfig['redis'];
  }
  if (overrides.openai) {
    result.openai = overrides.openai;
  }
  if (overrides.anthropic) {
    result.anthropic = overrides.anthropic;
  }
  if (overrides.slack) {
    result.slack = overrides.slack;
  }
  if (overrides.github) {
    result.github = overrides.github;
  }

  return result;
}
