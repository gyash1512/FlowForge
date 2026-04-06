# Communication & Integration Nodes

FlowForge includes 47 communication nodes covering messaging, email, developer tools, project management, CRM, payments, social media, support, and analytics. All communication nodes follow a unified pattern backed by [Composio](https://composio.dev) (MIT-licensed, self-hostable).

## Pattern

Every communication node uses `ctx.integrate(service, action, params)`:

```typescript
// Inside a node handler:
const result = await ctx.integrate('slack', 'sendMessage', {
  connectionId,
  channel: '#general',
  text: 'Hello from FlowForge',
});
```

The engine routes these calls through registered `IntegrationAdaptor` instances. In production, FlowForge uses the `ComposioAdaptor` which maps each `(service, action)` pair to a Composio tool slug.

---

## All Communication Nodes

### Messaging

| Node                            | Actions                                                                                   | Description                 |
| ------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| `communication/slack`           | `sendMessage`, `updateMessage`, `addReaction`, `createChannel`, `listUsers`, `uploadFile` | Slack workspace integration |
| `communication/discord`         | `sendMessage`, `createChannel`, `addRole`                                                 | Discord server operations   |
| `communication/telegram`        | `sendMessage`, `sendPhoto`, `sendDocument`                                                | Telegram bot messaging      |
| `communication/microsoft-teams` | `sendMessage`, `addChatMember`, `addTeamMember`, `archiveTeam`                            | Microsoft Teams integration |
| `communication/whatsapp`        | `sendMessage`, `sendTemplate`, `sendMedia`, `getProfile`, `markRead`                      | WhatsApp Business API       |

### Email & SMS

| Node                         | Actions                                                                   | Description                     |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------- |
| `communication/email-smtp`   | `send`                                                                    | Send email via SMTP             |
| `communication/email-resend` | `send`                                                                    | Send email via Resend API       |
| `communication/sendgrid`     | `sendEmail`, `addContact`, `createList`, `addToList`, `getStats`          | SendGrid email and contacts     |
| `communication/twilio`       | `sendSms`, `makeCall`, `sendWhatsapp`, `lookupNumber`, `getCallLog`       | Twilio SMS, voice, and WhatsApp |
| `communication/mailchimp`    | `addMember`, `createCampaign`, `sendCampaign`, `getListMembers`, `addTag` | Mailchimp email marketing       |

### Meetings & Scheduling

| Node                     | Actions                                                                          | Description             |
| ------------------------ | -------------------------------------------------------------------------------- | ----------------------- |
| `communication/zoom`     | `createMeeting`, `listMeetings`, `getMeeting`, `deleteMeeting`, `listRecordings` | Zoom meeting management |
| `communication/calendly` | `listEvents`, `getEvent`, `listEventTypes`, `cancelEvent`, `getInvitee`          | Calendly scheduling     |

### Developer Tools

| Node                      | Actions                                                                             | Description                     |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------- |
| `communication/github`    | `createIssue`, `createPR`, `addComment`, `createRelease`, `listRepos`               | GitHub repository operations    |
| `communication/gitlab`    | `createIssue`, `createBranch`, `getMergeRequest`, `createProject`, `createGroup`    | GitLab project operations       |
| `communication/bitbucket` | `createPR`, `createIssue`, `createBranch`, `approvePR`, `createRepo`                | Bitbucket repository operations |
| `communication/vercel`    | `createDeployment`, `addEnvVariable`, `addDomain`, `checkDomain`                    | Vercel deployment management    |
| `communication/circleci`  | `triggerPipeline`, `getJobDetails`, `getArtifacts`, `listPipelines`, `createEnvVar` | CircleCI CI/CD integration      |

### Project Management

| Node                    | Actions                                                                     | Description                |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------- |
| `communication/jira`    | `createIssue`, `editIssue`, `addComment`, `assignIssue`, `getIssue`         | Jira issue tracking        |
| `communication/linear`  | `createIssue`, `updateIssue`, `searchIssues`, `createProject`, `listIssues` | Linear project management  |
| `communication/asana`   | `createTask`, `createProject`, `addComment`, `getTask`, `createSubtask`     | Asana task management      |
| `communication/trello`  | `addCard`, `addBoard`, `addComment`, `addList`, `createWebhook`             | Trello board management    |
| `communication/monday`  | `createItem`, `createBoard`, `createUpdate`, `listItems`, `moveItem`        | Monday.com work management |
| `communication/clickup` | `createTimeEntry`, `createDoc`, `createChecklist`, `addTask`, `addTag`      | ClickUp task management    |

### Productivity

| Node                            | Actions                                                                      | Description                  |
| ------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `communication/notion`          | `createPage`, `updatePage`, `queryDatabase`                                  | Notion pages and databases   |
| `communication/google-sheets`   | `createRow`, `lookupRow`, `getValues`, `updateValues`, `createSheet`         | Google Sheets spreadsheets   |
| `communication/google-drive`    | `createFile`, `downloadFile`, `findFile`, `createFolder`, `createPermission` | Google Drive file management |
| `communication/google-calendar` | `createEvent`, `findEvent`, `deleteEvent`, `findFreeSlots`, `listEvents`     | Google Calendar events       |
| `communication/airtable`        | `createRecord`, `listRecords`, `updateRecord`, `deleteRecord`, `createTable` | Airtable bases and records   |
| `communication/dropbox`         | `addFileMember`, `addFolderMember`, `addTags`, `archiveFolder`               | Dropbox file sharing         |

### CRM

| Node                       | Actions                                                                        | Description               |
| -------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| `communication/salesforce` | `createLead`, `createOpportunity`, `createContact`, `query`, `createAccount`   | Salesforce CRM operations |
| `communication/hubspot`    | `archiveContact`, `archiveDeal`, `createTicket`, `readCompanies`, `cloneEmail` | HubSpot CRM and marketing |
| `communication/pipedrive`  | `addDeal`, `addPerson`, `addOrganization`, `addNote`, `addActivity`            | Pipedrive sales CRM       |

### Payments & Finance

| Node                       | Actions                                                                                   | Description               |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| `communication/stripe`     | `createCharge`, `createCustomer`, `createSubscription`, `listPayments`, `createRefund`    | Stripe payment processing |
| `communication/shopify`    | `createProducts`, `cancelOrder`, `closeOrder`, `adjustInventory`, `addToCollection`       | Shopify e-commerce        |
| `communication/quickbooks` | `createInvoice`, `createCustomer`, `createBill`, `createPayment`, `createEstimate`        | QuickBooks accounting     |
| `communication/xero`       | `createInvoice`, `createContact`, `createPayment`, `getBalanceSheet`, `createTransaction` | Xero accounting           |

### Social Media

| Node                      | Actions                                                                                   | Description                   |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| `communication/twitter`   | `createPost`, `search`, `followUser`, `getUser`, `createDM`                               | Twitter/X social operations   |
| `communication/linkedin`  | `createPost`, `addComment`, `getMyInfo`, `getCompanyInfo`, `deletePost`                   | LinkedIn professional network |
| `communication/instagram` | `createPost`, `getUserMedia`, `replyToComment`, `createCarousel`, `getPostInsights`       | Instagram content management  |
| `communication/youtube`   | `addToPlaylist`, `createPlaylist`, `getChannelStats`, `getVideoDetails`, `replyToComment` | YouTube channel management    |

### Support

| Node                      | Actions                                                                               | Description                 |
| ------------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| `communication/zendesk`   | `createTicket`, `updateTicket`, `replyTicket`, `listTickets`, `search`                | Zendesk support tickets     |
| `communication/freshdesk` | `addNote`, `createAgent`, `addWatcher`, `bulkUpdateTickets`, `createCannedResponse`   | Freshdesk help desk         |
| `communication/intercom`  | `createContact`, `assignConversation`, `closeConversation`, `createArticle`, `addTag` | Intercom customer messaging |

### Analytics

| Node                             | Actions                                                                | Description                |
| -------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| `communication/google-analytics` | `runReport`, `runRealtimeReport`, `runFunnelReport`, `batchRunReports` | Google Analytics reporting |
| `communication/segment`          | `track`, `identify`, `group`, `page`, `alias`                          | Segment event tracking     |

### Generic

| Node                    | Actions | Description               |
| ----------------------- | ------- | ------------------------- |
| `communication/webhook` | `send`  | Send a webhook to any URL |

---

## Usage Example

```typescript
import { slackNode, githubNode } from '@flowforge/nodes';

workflow('notify-on-pr')
  .trigger({ type: 'event', event: 'pr.merged' })
  .node('create-release', githubNode, {
    config: { connectionId: 'github-bot' },
    input: (ctx) => ({
      action: 'createRelease' as const,
      owner: 'my-org',
      repo: 'my-repo',
      tag: (ctx.event.data as { version: string }).version,
    }),
  })
  .node('notify-slack', slackNode, {
    config: { connectionId: 'slack-bot' },
    input: (ctx) => ({
      action: 'sendMessage' as const,
      channel: '#releases',
      text: `Release ${(ctx.event.data as { version: string }).version} published.`,
    }),
  })
  .build();
```

!!! note "Composio-backed"
All communication nodes (except `email-smtp` and `webhook`) are backed by Composio. See the [Composio Integration](../integrations/composio.md) guide for details on self-hosting and configuration.

!!! warning "Connection IDs"
Each node requires a `connectionId` in its config. This maps to a Composio user/connection that has been authenticated with the target service. The `connectionId` is passed through as the `userId` to Composio's tool execution API.
