// Core
export { AdaptorRegistry } from './adaptor-registry.js';
export { RateLimiter } from './rate-limiter.js';
export { CircuitBreaker, CircuitState } from './circuit-breaker.js';
export { createApp } from './server.js';
export type { ServerDeps } from './server.js';

// Adaptors
export { SlackAdaptor } from './adaptors/slack.js';
export type { SlackClient } from './adaptors/slack.js';

export { EmailAdaptor } from './adaptors/email.js';
export type { EmailClient, EmailMessage, EmailAttachment } from './adaptors/email.js';

export { DiscordAdaptor } from './adaptors/discord.js';
export type { DiscordClient } from './adaptors/discord.js';

export { GitHubAdaptor } from './adaptors/github.js';
export type { GitHubClient } from './adaptors/github.js';

export { NotionAdaptor } from './adaptors/notion.js';
export type { NotionClient } from './adaptors/notion.js';

export { TelegramAdaptor } from './adaptors/telegram.js';
export type { TelegramClient } from './adaptors/telegram.js';

export { WebhookAdaptor } from './adaptors/webhook.js';
export type { WebhookClient, WebhookRequestOptions } from './adaptors/webhook.js';

export { StripeAdaptor } from './adaptors/stripe.js';
export type { StripeClient } from './adaptors/stripe.js';
