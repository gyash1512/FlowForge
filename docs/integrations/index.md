# Integrations

FlowForge integrates with 38+ external services through a unified integration layer. The integration service acts as a gateway: it receives requests from workflow nodes via `ctx.integrate(service, action, params)` and routes them to the appropriate adaptor.

## Architecture

```
Workflow Node
    |
    v
ctx.integrate('slack', 'sendMessage', params)
    |
    v
IntegrationManager (engine)
    |
    v
IntegrationAdaptor (e.g. ComposioAdaptor)
    |
    v
External Service (Slack API, GitHub API, etc.)
```

In development, adaptors run in-process. In production, the integration service can run as a separate microservice with gRPC transport, rate limiting, and circuit breaking.

## Supported Integrations

### Messaging

| Service         | Actions                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| Slack           | `sendMessage`, `updateMessage`, `addReaction`, `createChannel`, `listUsers`, `uploadFile` |
| Discord         | `sendMessage`, `createChannel`, `addRole`                                                 |
| Telegram        | `sendMessage`, `sendPhoto`, `sendDocument`                                                |
| Microsoft Teams | `sendMessage`, `addChatMember`, `addTeamMember`, `archiveTeam`                            |
| WhatsApp        | `sendMessage`, `sendTemplate`, `sendMedia`, `getProfile`, `markRead`                      |

### Email & SMS

| Service         | Actions                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| SendGrid        | `sendEmail`, `addContact`, `createList`, `addToList`, `getStats`          |
| Twilio          | `sendSms`, `makeCall`, `sendWhatsapp`, `lookupNumber`, `getCallLog`       |
| Mailchimp       | `addMember`, `createCampaign`, `sendCampaign`, `getListMembers`, `addTag` |
| SMTP (direct)   | `send`                                                                    |
| Resend (direct) | `send`                                                                    |

### Meetings & Scheduling

| Service  | Actions                                                                          |
| -------- | -------------------------------------------------------------------------------- |
| Zoom     | `createMeeting`, `listMeetings`, `getMeeting`, `deleteMeeting`, `listRecordings` |
| Calendly | `listEvents`, `getEvent`, `listEventTypes`, `cancelEvent`, `getInvitee`          |

### Developer Tools

| Service   | Actions                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| GitHub    | `createIssue`, `createPR`, `addComment`, `createRelease`, `listRepos`               |
| GitLab    | `createIssue`, `createBranch`, `getMergeRequest`, `createProject`, `createGroup`    |
| Bitbucket | `createPR`, `createIssue`, `createBranch`, `approvePR`, `createRepo`                |
| Vercel    | `createDeployment`, `addEnvVariable`, `addDomain`, `checkDomain`                    |
| CircleCI  | `triggerPipeline`, `getJobDetails`, `getArtifacts`, `listPipelines`, `createEnvVar` |

### Project Management

| Service    | Actions                                                                     |
| ---------- | --------------------------------------------------------------------------- |
| Jira       | `createIssue`, `editIssue`, `addComment`, `assignIssue`, `getIssue`         |
| Linear     | `createIssue`, `updateIssue`, `searchIssues`, `createProject`, `listIssues` |
| Asana      | `createTask`, `createProject`, `addComment`, `getTask`, `createSubtask`     |
| Trello     | `addCard`, `addBoard`, `addComment`, `addList`, `createWebhook`             |
| Monday.com | `createItem`, `createBoard`, `createUpdate`, `listItems`, `moveItem`        |
| ClickUp    | `createTimeEntry`, `createDoc`, `createChecklist`, `addTask`, `addTag`      |

### Productivity

| Service         | Actions                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Notion          | `createPage`, `updatePage`, `queryDatabase`                                  |
| Google Sheets   | `createRow`, `lookupRow`, `getValues`, `updateValues`, `createSheet`         |
| Google Drive    | `createFile`, `downloadFile`, `findFile`, `createFolder`, `createPermission` |
| Google Calendar | `createEvent`, `findEvent`, `deleteEvent`, `findFreeSlots`, `listEvents`     |
| Airtable        | `createRecord`, `listRecords`, `updateRecord`, `deleteRecord`, `createTable` |
| Dropbox         | `addFileMember`, `addFolderMember`, `addTags`, `archiveFolder`               |

### CRM

| Service    | Actions                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| Salesforce | `createLead`, `createOpportunity`, `createContact`, `query`, `createAccount`   |
| HubSpot    | `archiveContact`, `archiveDeal`, `createTicket`, `readCompanies`, `cloneEmail` |
| Pipedrive  | `addDeal`, `addPerson`, `addOrganization`, `addNote`, `addActivity`            |

### Payments & Finance

| Service    | Actions                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| Stripe     | `createCharge`, `createCustomer`, `createSubscription`, `listPayments`, `createRefund`    |
| Shopify    | `createProducts`, `cancelOrder`, `closeOrder`, `adjustInventory`, `addToCollection`       |
| QuickBooks | `createInvoice`, `createCustomer`, `createBill`, `createPayment`, `createEstimate`        |
| Xero       | `createInvoice`, `createContact`, `createPayment`, `getBalanceSheet`, `createTransaction` |

### Social Media

| Service   | Actions                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| Twitter/X | `createPost`, `search`, `followUser`, `getUser`, `createDM`                               |
| LinkedIn  | `createPost`, `addComment`, `getMyInfo`, `getCompanyInfo`, `deletePost`                   |
| Instagram | `createPost`, `getUserMedia`, `replyToComment`, `createCarousel`, `getPostInsights`       |
| YouTube   | `addToPlaylist`, `createPlaylist`, `getChannelStats`, `getVideoDetails`, `replyToComment` |

### Support

| Service   | Actions                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| Zendesk   | `createTicket`, `updateTicket`, `replyTicket`, `listTickets`, `search`                |
| Freshdesk | `addNote`, `createAgent`, `addWatcher`, `bulkUpdateTickets`, `createCannedResponse`   |
| Intercom  | `createContact`, `assignConversation`, `closeConversation`, `createArticle`, `addTag` |

### Analytics

| Service          | Actions                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| Google Analytics | `runReport`, `runRealtimeReport`, `runFunnelReport`, `batchRunReports` |
| Segment          | `track`, `identify`, `group`, `page`, `alias`                          |

## How It Works

Most integrations are backed by [Composio](https://composio.dev), an MIT-licensed integration framework. See the [Composio integration guide](composio.md) for details.

Direct adaptors exist for a handful of services that benefit from first-party implementations (SMTP email, webhooks). These bypass Composio entirely.

## Self-hosting Composio

FlowForge supports self-hosted Composio instances. Set `composioBaseUrl` in your integration service configuration:

```typescript
const config: IntegrationConfig = {
  composioBaseUrl: 'https://composio.internal.example.com',
  port: 4001,
  grpcPort: 50051,
};
```

When self-hosted, no external API key is required. All authentication is handled through your own Composio instance's connection management.
