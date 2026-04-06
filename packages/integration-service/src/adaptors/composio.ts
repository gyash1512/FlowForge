import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

/**
 * Composio SDK client interface.
 * We depend on the interface rather than the concrete class so the adaptor
 * is testable with a simple mock and the import is only needed at runtime.
 */
export interface ComposioClient {
  tools: {
    execute(
      toolSlug: string,
      options: { userId: string; arguments: Record<string, unknown> },
    ): Promise<unknown>;
  };
}

/**
 * Maps FlowForge integration names + actions to Composio tool slugs.
 *
 * Convention: `<TOOLKIT>_<ACTION>` in UPPER_SNAKE_CASE.
 * See https://docs.composio.dev for the full catalog.
 */
const TOOL_MAP: Record<string, Record<string, string>> = {
  // ── Communication ───────────────────────────────────────────
  slack: {
    sendMessage: 'SLACK_SEND_A_MESSAGE',
    updateMessage: 'SLACK_UPDATE_A_MESSAGE',
    addReaction: 'SLACK_ADD_A_REACTION',
    createChannel: 'SLACK_CREATE_A_CHANNEL',
    listUsers: 'SLACK_LIST_USERS',
    uploadFile: 'SLACK_UPLOAD_A_FILE',
  },
  discord: {
    sendMessage: 'DISCORD_SEND_MESSAGE',
    createChannel: 'DISCORD_CREATE_GUILD_CHANNEL',
    addRole: 'DISCORD_ADD_GUILD_MEMBER_ROLE',
  },
  telegram: {
    sendMessage: 'TELEGRAM_SEND_TEXT_MESSAGE',
    sendPhoto: 'TELEGRAM_SEND_A_PHOTO',
    sendDocument: 'TELEGRAM_SEND_A_DOCUMENT',
  },
  microsoftTeams: {
    sendMessage: 'MICROSOFT_TEAMS_CHATS_GET_ALL_MESSAGES',
    addChatMember: 'MICROSOFT_TEAMS_ADD_CHAT_MEMBER',
    addTeamMember: 'MICROSOFT_TEAMS_ADD_TEAM_MEMBER',
    archiveTeam: 'MICROSOFT_TEAMS_ARCHIVE_TEAM',
  },
  email: {
    send: 'GMAIL_SEND_EMAIL',
  },
  intercom: {
    createContact: 'INTERCOM_CREATE_CONTACT',
    assignConversation: 'INTERCOM_ASSIGN_CONVERSATION',
    closeConversation: 'INTERCOM_CLOSE_CONVERSATION',
    createArticle: 'INTERCOM_CREATE_AN_ARTICLE',
    addTag: 'INTERCOM_ADD_TAG_TO_CONTACT',
  },

  // ── Developer Tools ─────────────────────────────────────────
  github: {
    createIssue: 'GITHUB_CREATE_AN_ISSUE',
    createPR: 'GITHUB_CREATE_A_PULL_REQUEST',
    addComment: 'GITHUB_CREATE_AN_ISSUE_COMMENT',
    createRelease: 'GITHUB_CREATE_A_RELEASE',
    listRepos: 'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
  },
  gitlab: {
    createIssue: 'GITLAB_CREATE_PROJECT_ISSUE',
    createBranch: 'GITLAB_CREATE_REPOSITORY_BRANCH',
    getMergeRequest: 'GITLAB_GET_PROJECT_MERGE_REQUEST',
    createProject: 'GITLAB_CREATE_PROJECT',
    createGroup: 'GITLAB_CREATE_GROUP',
  },
  bitbucket: {
    createPR: 'BITBUCKET_CREATE_PULL_REQUEST',
    createIssue: 'BITBUCKET_CREATE_ISSUE',
    createBranch: 'BITBUCKET_CREATE_BRANCH',
    approvePR: 'BITBUCKET_APPROVE_PULL_REQUEST',
    createRepo: 'BITBUCKET_CREATE_REPOSITORY',
  },
  vercel: {
    createDeployment: 'VERCEL_CREATE_DEPLOYMENT',
    addEnvVariable: 'VERCEL_ADD_ENVIRONMENT_VARIABLE',
    addDomain: 'VERCEL_ADD_PROJECT_DOMAIN',
    checkDomain: 'VERCEL_CHECK_DOMAIN_AVAILABILITY',
  },
  circleci: {
    triggerPipeline: 'CIRCLECI_TRIGGER_PIPELINE',
    getJobDetails: 'CIRCLECI_GET_JOB_DETAILS',
    getArtifacts: 'CIRCLECI_GET_JOB_ARTIFACTS',
    listPipelines: 'CIRCLECI_LIST_PIPELINES_FOR_PROJECT',
    createEnvVar: 'CIRCLECI_CREATE_PROJECT_ENV_VAR',
  },

  // ── Project Management ──────────────────────────────────────
  jira: {
    createIssue: 'JIRA_CREATE_ISSUE',
    editIssue: 'JIRA_EDIT_ISSUE',
    addComment: 'JIRA_ADD_COMMENT',
    assignIssue: 'JIRA_ASSIGN_ISSUE',
    getIssue: 'JIRA_GET_ISSUE',
  },
  linear: {
    createIssue: 'LINEAR_CREATE_LINEAR_ISSUE',
    updateIssue: 'LINEAR_UPDATE_ISSUE',
    searchIssues: 'LINEAR_SEARCH_ISSUES',
    createProject: 'LINEAR_CREATE_LINEAR_PROJECT',
    listIssues: 'LINEAR_LIST_LINEAR_ISSUES',
  },
  asana: {
    createTask: 'ASANA_CREATE_A_TASK',
    createProject: 'ASANA_CREATE_A_PROJECT',
    addComment: 'ASANA_CREATE_TASK_COMMENT',
    getTask: 'ASANA_GET_A_TASK',
    createSubtask: 'ASANA_CREATE_SUBTASK',
  },
  trello: {
    addCard: 'TRELLO_ADD_CARDS',
    addBoard: 'TRELLO_ADD_BOARDS',
    addComment: 'TRELLO_ADD_CARDS_ACTIONS_COMMENTS_BY_ID_CARD',
    addList: 'TRELLO_ADD_BOARDS_LISTS_BY_ID_BOARD',
    createWebhook: 'TRELLO_CREATE_WEBHOOK',
  },
  monday: {
    createItem: 'MONDAY_CREATE_ITEM',
    createBoard: 'MONDAY_CREATE_BOARD',
    createUpdate: 'MONDAY_CREATE_UPDATE',
    listItems: 'MONDAY_LIST_BOARD_ITEMS',
    moveItem: 'MONDAY_MOVE_ITEM_TO_GROUP',
  },
  clickup: {
    createTimeEntry: 'CLICKUP_CREATE_A_TIME_ENTRY',
    createDoc: 'CLICKUP_CREATE_DOC',
    createChecklist: 'CLICKUP_CREATE_CHECKLIST',
    addTask: 'CLICKUP_ADD_TASK_TO_LIST',
    addTag: 'CLICKUP_ADD_TAG_TO_TASK',
  },

  // ── CRM ─────────────────────────────────────────────────────
  salesforce: {
    createLead: 'SALESFORCE_CREATE_LEAD',
    createOpportunity: 'SALESFORCE_CREATE_OPPORTUNITY',
    createContact: 'SALESFORCE_CREATE_CONTACT',
    query: 'SALESFORCE_EXECUTE_SOQL_QUERY',
    createAccount: 'SALESFORCE_CREATE_ACCOUNT',
  },
  hubspot: {
    archiveContact: 'HUBSPOT_ARCHIVE_CONTACT',
    archiveDeal: 'HUBSPOT_ARCHIVE_DEALS',
    createTicket: 'HUBSPOT_CREATE_ZENDESK_TICKET',
    readCompanies: 'HUBSPOT_BATCH_READ_COMPANIES_BY_PROPERTIES',
    cloneEmail: 'HUBSPOT_CLONE_MARKETING_EMAIL',
  },
  pipedrive: {
    addDeal: 'PIPEDRIVE_ADD_A_DEAL',
    addPerson: 'PIPEDRIVE_ADD_A_PERSON',
    addOrganization: 'PIPEDRIVE_ADD_AN_ORGANIZATION',
    addNote: 'PIPEDRIVE_ADD_A_NOTE',
    addActivity: 'PIPEDRIVE_ADD_AN_ACTIVITY',
  },

  // ── Productivity ────────────────────────────────────────────
  notion: {
    createPage: 'NOTION_CREATE_A_PAGE',
    updatePage: 'NOTION_UPDATE_PAGE_PROPERTIES',
    queryDatabase: 'NOTION_QUERY_A_DATABASE',
  },
  googleSheets: {
    createRow: 'GOOGLESHEETS_CREATE_SPREADSHEET_ROW',
    lookupRow: 'GOOGLESHEETS_LOOKUP_SPREADSHEET_ROW',
    getValues: 'GOOGLESHEETS_VALUES_GET',
    updateValues: 'GOOGLESHEETS_VALUES_UPDATE',
    createSheet: 'GOOGLESHEETS_CREATE_GOOGLE_SHEET1',
  },
  googleDrive: {
    createFile: 'GOOGLEDRIVE_CREATE_FILE',
    downloadFile: 'GOOGLEDRIVE_DOWNLOAD_FILE',
    findFile: 'GOOGLEDRIVE_FIND_FILE',
    createFolder: 'GOOGLEDRIVE_CREATE_FOLDER',
    createPermission: 'GOOGLEDRIVE_CREATE_PERMISSION',
  },
  googleCalendar: {
    createEvent: 'GOOGLECALENDAR_CREATE_EVENT',
    findEvent: 'GOOGLECALENDAR_FIND_EVENT',
    deleteEvent: 'GOOGLECALENDAR_DELETE_EVENT',
    findFreeSlots: 'GOOGLECALENDAR_FIND_FREE_SLOTS',
    listEvents: 'GOOGLECALENDAR_EVENTS_LIST',
  },
  airtable: {
    createRecord: 'AIRTABLE_CREATE_RECORD',
    listRecords: 'AIRTABLE_LIST_RECORDS',
    updateRecord: 'AIRTABLE_UPDATE_RECORD',
    deleteRecord: 'AIRTABLE_DELETE_RECORD',
    createTable: 'AIRTABLE_CREATE_TABLE',
  },
  dropbox: {
    addFileMember: 'DROPBOX_ADD_FILE_MEMBER',
    addFolderMember: 'DROPBOX_ADD_FOLDER_MEMBER_ACTION',
    addTags: 'DROPBOX_ADD_FILE_TAGS',
    archiveFolder: 'DROPBOX_ARCHIVE_TEAM_FOLDER',
  },

  // ── Payments & Finance ──────────────────────────────────────
  stripe: {
    createCharge: 'STRIPE_CREATE_A_CHARGE',
    createCustomer: 'STRIPE_CREATE_A_CUSTOMER',
    createSubscription: 'STRIPE_CREATE_A_SUBSCRIPTION',
    listPayments: 'STRIPE_LIST_ALL_CHARGES',
    createRefund: 'STRIPE_CREATE_A_REFUND',
  },
  shopify: {
    createProducts: 'SHOPIFY_BULK_CREATE_PRODUCTS',
    cancelOrder: 'SHOPIFY_CANCEL_ORDER',
    closeOrder: 'SHOPIFY_CLOSE_ORDER',
    adjustInventory: 'SHOPIFY_ADJUST_INVENTORY_LEVEL',
    addToCollection: 'SHOPIFY_ADD_PRODUCT_TO_COLLECTION',
  },
  quickbooks: {
    createInvoice: 'QUICKBOOKS_CREATE_INVOICE',
    createCustomer: 'QUICKBOOKS_CREATE_CUSTOMER',
    createBill: 'QUICKBOOKS_CREATE_BILL',
    createPayment: 'QUICKBOOKS_CREATE_PAYMENT',
    createEstimate: 'QUICKBOOKS_CREATE_ESTIMATE',
  },
  xero: {
    createInvoice: 'XERO_CREATE_INVOICE',
    createContact: 'XERO_CREATE_CONTACT',
    createPayment: 'XERO_CREATE_PAYMENT',
    getBalanceSheet: 'XERO_GET_BALANCE_SHEET_REPORT',
    createTransaction: 'XERO_CREATE_BANK_TRANSACTION',
  },

  // ── Social Media ────────────────────────────────────────────
  twitter: {
    createPost: 'TWITTER_CREATION_OF_A_POST',
    search: 'TWITTER_RECENT_SEARCH',
    followUser: 'TWITTER_FOLLOW_USER',
    getUser: 'TWITTER_GET_USER_BY_ID',
    createDM: 'TWITTER_CREATE_DM_CONVERSATION',
  },
  linkedin: {
    createPost: 'LINKEDIN_CREATE_LINKED_IN_POST',
    addComment: 'LINKEDIN_CREATE_COMMENT_ON_POST',
    getMyInfo: 'LINKEDIN_GET_MY_INFO',
    getCompanyInfo: 'LINKEDIN_GET_COMPANY_INFO',
    deletePost: 'LINKEDIN_DELETE_LINKED_IN_POST',
  },
  instagram: {
    createPost: 'INSTAGRAM_CREATE_POST',
    getUserMedia: 'INSTAGRAM_GET_USER_MEDIA',
    replyToComment: 'INSTAGRAM_REPLY_TO_COMMENT',
    createCarousel: 'INSTAGRAM_CREATE_CAROUSEL_CONTAINER',
    getPostInsights: 'INSTAGRAM_GET_POST_INSIGHTS',
  },
  youtube: {
    addToPlaylist: 'YOUTUBE_ADD_VIDEO_TO_PLAYLIST',
    createPlaylist: 'YOUTUBE_CREATE_PLAYLIST',
    getChannelStats: 'YOUTUBE_GET_CHANNEL_STATISTICS',
    getVideoDetails: 'YOUTUBE_GET_VIDEO_DETAILS_BATCH',
    replyToComment: 'YOUTUBE_CREATE_COMMENT_REPLY',
  },

  // ── Support ─────────────────────────────────────────────────
  zendesk: {
    createTicket: 'ZENDESK_CREATE_ZENDESK_TICKET',
    updateTicket: 'ZENDESK_UPDATE_ZENDESK_TICKET',
    replyTicket: 'ZENDESK_REPLY_ZENDESK_TICKET',
    listTickets: 'ZENDESK_LIST_ZENDESK_TICKETS',
    search: 'ZENDESK_SEARCH_ZENDESK',
  },
  freshdesk: {
    addNote: 'FRESHDESK_ADD_NOTE_TO_TICKET',
    createAgent: 'FRESHDESK_CREATE_AGENTS',
    addWatcher: 'FRESHDESK_ADD_WATCHER',
    bulkUpdateTickets: 'FRESHDESK_BULK_UPDATE_TICKETS',
    createCannedResponse: 'FRESHDESK_CREATE_CANNED_RESPONSE',
  },

  // ── Analytics ───────────────────────────────────────────────
  googleAnalytics: {
    runReport: 'GOOGLE_ANALYTICS_RUN_REPORT',
    runRealtimeReport: 'GOOGLE_ANALYTICS_RUN_REALTIME_REPORT',
    runFunnelReport: 'GOOGLE_ANALYTICS_RUN_FUNNEL_REPORT',
    batchRunReports: 'GOOGLE_ANALYTICS_BATCH_RUN_REPORTS',
  },
  segment: {
    track: 'SEGMENT_TRACK',
    identify: 'SEGMENT_IDENTIFY',
    group: 'SEGMENT_GROUP',
    page: 'SEGMENT_PAGE',
    alias: 'SEGMENT_ALIAS',
  },
};

/**
 * A single adaptor that delegates every integration action to Composio.
 *
 * It replaces the individual per-service adaptors (SlackAdaptor, GitHubAdaptor, etc.)
 * with one unified implementation backed by Composio's 250+ pre-built integrations.
 */
export class ComposioAdaptor implements IntegrationAdaptor {
  readonly name: string;
  readonly actions: string[];

  constructor(
    private readonly integration: string,
    private readonly client: ComposioClient,
  ) {
    this.name = integration;
    const mapping = TOOL_MAP[integration];
    this.actions = mapping ? Object.keys(mapping) : [];
  }

  async execute(action: string, params: unknown, connectionId: string): Promise<unknown> {
    const mapping = TOOL_MAP[this.integration];
    if (!mapping) {
      throw new IntegrationError(
        this.integration,
        `No Composio mapping for integration: ${this.integration}`,
      );
    }

    const toolSlug = mapping[action];
    if (!toolSlug) {
      throw new IntegrationError(
        this.integration,
        `Unknown action "${action}" for integration "${this.integration}"`,
      );
    }

    const args =
      typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {};

    // Strip connectionId from args — Composio uses userId for auth routing
    const { connectionId: _stripped, ...toolArgs } = args;

    try {
      const result = await this.client.tools.execute(toolSlug, {
        userId: connectionId,
        arguments: toolArgs,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IntegrationError(this.integration, `Composio execution failed: ${message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client != null;
  }
}

/**
 * Factory: create ComposioAdaptor instances for all mapped integrations.
 */
export function createComposioAdaptors(client: ComposioClient): ComposioAdaptor[] {
  return Object.keys(TOOL_MAP).map((integration) => new ComposioAdaptor(integration, client));
}

/**
 * Get the Composio tool slug for a given integration + action.
 * Returns undefined if no mapping exists.
 */
export function getComposioToolSlug(integration: string, action: string): string | undefined {
  return TOOL_MAP[integration]?.[action];
}

/** Expose the tool map for introspection / testing. */
export { TOOL_MAP };
