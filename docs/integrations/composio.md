# Composio Integration

[Composio](https://composio.dev) is an MIT-licensed, self-hostable integration framework that FlowForge uses to connect with 250+ external services. Instead of maintaining individual API clients for each service, FlowForge maps its integration actions to Composio tool slugs and delegates execution.

## How ComposioAdaptor Works

The `ComposioAdaptor` class implements the `IntegrationAdaptor` interface. It translates FlowForge `(service, action)` pairs to Composio tool slugs using an internal `TOOL_MAP`:

```
ctx.integrate('slack', 'sendMessage', { channel, text })
        |
        v
ComposioAdaptor.execute('sendMessage', params, connectionId)
        |
        v
TOOL_MAP['slack']['sendMessage'] => 'SLACK_SEND_A_MESSAGE'
        |
        v
composioClient.tools.execute('SLACK_SEND_A_MESSAGE', {
  userId: connectionId,
  arguments: { channel, text }
})
```

Key details:

- The `connectionId` from FlowForge maps to Composio's `userId` parameter, which routes to the correct OAuth connection.
- The adaptor strips `connectionId` from the arguments before passing them to Composio.
- Errors from Composio are wrapped in `IntegrationError` with the integration name for clear debugging.

## TOOL_MAP Reference

The `TOOL_MAP` is a `Record<string, Record<string, string>>` that maps each integration and action to a Composio tool slug. The convention is `<TOOLKIT>_<ACTION>` in `UPPER_SNAKE_CASE`.

Example entries:

```typescript
const TOOL_MAP = {
  slack: {
    sendMessage: 'SLACK_SEND_A_MESSAGE',
    updateMessage: 'SLACK_UPDATE_A_MESSAGE',
    addReaction: 'SLACK_ADD_A_REACTION',
    createChannel: 'SLACK_CREATE_A_CHANNEL',
    listUsers: 'SLACK_LIST_USERS',
    uploadFile: 'SLACK_UPLOAD_A_FILE',
  },
  github: {
    createIssue: 'GITHUB_CREATE_AN_ISSUE',
    createPR: 'GITHUB_CREATE_A_PULL_REQUEST',
    addComment: 'GITHUB_CREATE_AN_ISSUE_COMMENT',
    createRelease: 'GITHUB_CREATE_A_RELEASE',
    listRepos: 'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
  },
  stripe: {
    createCharge: 'STRIPE_CREATE_A_CHARGE',
    createCustomer: 'STRIPE_CREATE_A_CUSTOMER',
    createSubscription: 'STRIPE_CREATE_A_SUBSCRIPTION',
    listPayments: 'STRIPE_LIST_ALL_CHARGES',
    createRefund: 'STRIPE_CREATE_A_REFUND',
  },
  // ... 35+ more integrations
};
```

The full map covers all 38+ integrations. See the source at `packages/integration-service/src/adaptors/composio.ts` for the complete reference.

## createComposioAdaptors()

The factory function creates a `ComposioAdaptor` instance for every entry in `TOOL_MAP`:

```typescript
import { Composio } from 'composio-core';
import { createComposioAdaptors } from '@flowforge/integration-service';

const composioClient = new Composio({ apiKey: 'your-key' });
const adaptors = createComposioAdaptors(composioClient);

// Register all adaptors with the engine
for (const adaptor of adaptors) {
  engine.registerIntegration(adaptor);
}
```

This registers one adaptor per integration (slack, github, stripe, etc.), each with the correct action list derived from its `TOOL_MAP` entry.

## Adding New Integrations

To add a new integration, extend the `TOOL_MAP` in `packages/integration-service/src/adaptors/composio.ts`:

```typescript
// 1. Add the mapping
const TOOL_MAP = {
  // existing entries...
  myService: {
    doThing: 'MY_SERVICE_DO_THING',
    doOtherThing: 'MY_SERVICE_DO_OTHER_THING',
  },
};
```

Then create the corresponding node in `packages/nodes/src/communication/`:

```typescript
// 2. Create the node (packages/nodes/src/communication/my-service.ts)
import { z } from 'zod';
import { defineNode } from '@flowforge/sdk';

const inputSchema = z.object({
  action: z.enum(['doThing', 'doOtherThing']),
  // action-specific fields...
});

const outputSchema = z.object({
  result: z.unknown(),
});

const configSchema = z.object({
  connectionId: z.string(),
});

export const myServiceNode = defineNode({
  name: 'communication/my-service',
  version: '0.1.0',
  description: 'Interact with My Service',
  category: 'communication',
  inputSchema,
  outputSchema,
  configSchema,
  tags: ['my-service'],

  handler: async (ctx) => {
    const { action, ...params } = ctx.input as z.infer<typeof inputSchema>;
    const { connectionId } = ctx.config as z.infer<typeof configSchema>;
    const result = await ctx.integrate('myService', action, {
      connectionId,
      ...params,
    });
    return { result };
  },
});
```

!!! tip "Finding tool slugs"
Browse the [Composio tool catalog](https://docs.composio.dev) to find the correct tool slugs for new integrations.

## Authentication Flow

1. A user authenticates with a service through Composio's connection management (OAuth, API key, etc.).
2. Composio stores the connection and returns a `connectionId`.
3. The `connectionId` is stored in FlowForge and passed as the `userId` to Composio when executing tools.
4. Composio uses the stored credentials to make authenticated API calls on behalf of the user.

```
User -> Composio OAuth -> connectionId stored
Workflow -> ctx.integrate('slack', 'sendMessage', { connectionId }) -> ComposioAdaptor -> Composio SDK -> Slack API
```

## ComposioClient Interface

The adaptor depends on a minimal interface rather than the full Composio SDK, making it easy to mock in tests:

```typescript
interface ComposioClient {
  tools: {
    execute(
      toolSlug: string,
      options: { userId: string; arguments: Record<string, unknown> },
    ): Promise<unknown>;
  };
}
```

## Self-Hosting

Composio is MIT-licensed and can be self-hosted. When running your own instance:

1. Deploy Composio according to its documentation.
2. Set `composioBaseUrl` in your FlowForge integration config to point at your instance.
3. No external API key is needed -- authentication is handled by your own instance.

```typescript
const config: IntegrationConfig = {
  composioBaseUrl: 'https://composio.internal.example.com',
};
```

!!! note "Direct adaptors"
For services where you need full control over the API client (e.g., custom SMTP configuration, webhook signing), FlowForge also supports direct adaptors that bypass Composio entirely. These implement the `IntegrationAdaptor` interface directly.
