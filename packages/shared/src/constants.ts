// Timeouts
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_WORKFLOW_TIMEOUT_MS = 300_000;
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

// Retries
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 1_000;

// Worker
export const DEFAULT_CONCURRENCY = 10;
export const DEFAULT_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_WORKER_PORT = 4000;

// Integration Service
export const DEFAULT_INTEGRATION_PORT = 4001;
export const DEFAULT_GRPC_PORT = 50051;

// Dashboard
export const DEFAULT_DASHBOARD_PORT = 3000;

// Limits
export const MAX_PAYLOAD_SIZE_BYTES = 1_048_576; // 1MB
export const MAX_AGENT_ITERATIONS = 20;
export const MAX_PARALLEL_CONCURRENCY = 100;
export const MAX_FOREACH_ITEMS = 10_000;
export const MAX_WHILE_ITERATIONS = 1_000;

// Queue names
export const QUEUE_PREFIX = 'flowforge';
export const WORKFLOW_QUEUE = 'flowforge:workflows';
export const CHECKPOINT_QUEUE = 'flowforge:checkpoints';
export const EVENT_QUEUE = 'flowforge:events';
export const DLQ_QUEUE = 'flowforge:dlq';

// Circuit breaker
export const CIRCUIT_BREAKER_THRESHOLD = 5;
export const CIRCUIT_BREAKER_TIMEOUT_MS = 60_000;
export const CIRCUIT_BREAKER_RESET_MS = 30_000;

// Rate limiting
export const DEFAULT_RATE_LIMIT_MAX = 100;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
