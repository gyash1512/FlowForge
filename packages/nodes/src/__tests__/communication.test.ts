import { describe, it, expect, vi } from 'vitest';
import { createMockContext } from './helpers.js';

// ── Original nodes ────────────────────────────────────────────
import { slackNode } from '../communication/slack.js';
import { discordNode } from '../communication/discord.js';
import { githubNode } from '../communication/github.js';
import { notionNode } from '../communication/notion.js';
import { stripeNode } from '../communication/stripe.js';
import { telegramNode } from '../communication/telegram.js';

// ── New Composio-backed nodes ─────────────────────────────────
import { whatsappNode } from '../communication/whatsapp.js';
import { twilioNode } from '../communication/twilio.js';
import { sendgridNode } from '../communication/sendgrid.js';
import { zoomNode } from '../communication/zoom.js';
import { mailchimpNode } from '../communication/mailchimp.js';
import { calendlyNode } from '../communication/calendly.js';
import { jiraNode } from '../communication/jira.js';
import { linearNode } from '../communication/linear.js';
import { asanaNode } from '../communication/asana.js';
import { trelloNode } from '../communication/trello.js';
import { salesforceNode } from '../communication/salesforce.js';
import { hubspotNode } from '../communication/hubspot.js';
import { zendeskNode } from '../communication/zendesk.js';
import { freshdeskNode } from '../communication/freshdesk.js';
import { gitlabNode } from '../communication/gitlab.js';
import { bitbucketNode } from '../communication/bitbucket.js';
import { vercelNode } from '../communication/vercel.js';
import { circleciNode } from '../communication/circleci.js';
import { microsoftTeamsNode } from '../communication/microsoft-teams.js';
import { intercomNode } from '../communication/intercom.js';
import { googleSheetsNode } from '../communication/google-sheets.js';
import { googleDriveNode } from '../communication/google-drive.js';
import { googleCalendarNode } from '../communication/google-calendar.js';
import { airtableNode } from '../communication/airtable.js';
import { twitterNode } from '../communication/twitter.js';
import { linkedinNode } from '../communication/linkedin.js';
import { instagramNode } from '../communication/instagram.js';
import { youtubeNode } from '../communication/youtube.js';
import { shopifyNode } from '../communication/shopify.js';
import { quickbooksNode } from '../communication/quickbooks.js';
import { xeroNode } from '../communication/xero.js';
import { segmentNode } from '../communication/segment.js';
import { googleAnalyticsNode } from '../communication/google-analytics.js';
import { mondayNode } from '../communication/monday.js';
import { clickupNode } from '../communication/clickup.js';
import { pipedriveNode } from '../communication/pipedrive.js';
import { dropboxNode } from '../communication/dropbox.js';

// ── Helpers ───────────────────────────────────────────────────

function makeCtx(input: unknown, integrate?: ReturnType<typeof vi.fn>) {
  return createMockContext({
    input,
    config: { connectionId: 'conn-1' },
    integrate: integrate ?? vi.fn().mockResolvedValue({ ok: true }),
  });
}

// ────────────────────────────────────────────────────────────────
// Messaging
// ────────────────────────────────────────────────────────────────

describe('communication/slack', () => {
  it('sends a message', async () => {
    const integrate = vi.fn().mockResolvedValue({ ok: true, ts: '123', channel: '#gen' });
    const ctx = makeCtx({ action: 'sendMessage', channel: '#gen', text: 'hi' }, integrate);
    const res = (await slackNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'slack',
      'sendMessage',
      expect.objectContaining({ channel: '#gen', text: 'hi' }),
    );
    expect(res.ok).toBe(true);
  });

  it('throws without channel', async () => {
    const ctx = makeCtx({ action: 'sendMessage', text: 'hi' });
    await expect(slackNode.handler(ctx)).rejects.toThrow('channel is required');
  });
});

describe('communication/discord', () => {
  it('sends a message', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'msg-1' });
    const ctx = makeCtx({ action: 'sendMessage', channelId: 'ch-1', content: 'hello' }, integrate);
    const res = (await discordNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'discord',
      'sendMessage',
      expect.objectContaining({ channelId: 'ch-1' }),
    );
    expect(res.success).toBe(true);
  });

  it('throws without channelId', async () => {
    const ctx = makeCtx({ action: 'sendMessage', content: 'hi' });
    await expect(discordNode.handler(ctx)).rejects.toThrow('channelId is required');
  });
});

describe('communication/telegram', () => {
  it('sends a message', async () => {
    const integrate = vi.fn().mockResolvedValue({ message_id: 42 });
    const ctx = makeCtx({ action: 'sendMessage', chatId: '123', text: 'hi' }, integrate);
    const res = (await telegramNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'telegram',
      'sendMessage',
      expect.objectContaining({ chatId: '123', text: 'hi' }),
    );
    expect(res.messageId).toBe(42);
  });

  it('throws without text', async () => {
    const ctx = makeCtx({ action: 'sendMessage', chatId: '123' });
    await expect(telegramNode.handler(ctx)).rejects.toThrow('text is required');
  });
});

describe('communication/whatsapp', () => {
  it('sends a message', async () => {
    const integrate = vi.fn().mockResolvedValue({ messageId: 'wam-1' });
    const ctx = makeCtx({ action: 'sendMessage', to: '+1234567890', text: 'hello' }, integrate);
    const res = (await whatsappNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'whatsapp',
      'sendMessage',
      expect.objectContaining({ to: '+1234567890', text: 'hello' }),
    );
    expect(res.success).toBe(true);
  });

  it('throws without text for sendMessage', async () => {
    const ctx = makeCtx({ action: 'sendMessage', to: '+1234567890' });
    await expect(whatsappNode.handler(ctx)).rejects.toThrow('text is required');
  });

  it('sends a template', async () => {
    const integrate = vi.fn().mockResolvedValue({ ok: true });
    const ctx = makeCtx(
      { action: 'sendTemplate', to: '+1234567890', templateName: 'welcome' },
      integrate,
    );
    const res = (await whatsappNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'whatsapp',
      'sendTemplate',
      expect.objectContaining({ templateName: 'welcome', language: 'en' }),
    );
    expect(res.success).toBe(true);
  });

  it('marks a message as read', async () => {
    const integrate = vi.fn().mockResolvedValue({ ok: true });
    const ctx = makeCtx({ action: 'markRead', to: '+1234567890', messageId: 'msg-1' }, integrate);
    await whatsappNode.handler(ctx);
    expect(integrate).toHaveBeenCalledWith(
      'whatsapp',
      'markRead',
      expect.objectContaining({ messageId: 'msg-1' }),
    );
  });
});

describe('communication/microsoft-teams', () => {
  it('sends a message', async () => {
    const integrate = vi.fn().mockResolvedValue({ ok: true });
    const ctx = makeCtx({ action: 'sendMessage', chatId: 'chat-1', content: 'hi' }, integrate);
    const res = (await microsoftTeamsNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'microsoft-teams',
      'sendMessage',
      expect.objectContaining({ chatId: 'chat-1' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Email, SMS & Voice
// ────────────────────────────────────────────────────────────────

describe('communication/twilio', () => {
  it('sends an SMS', async () => {
    const integrate = vi.fn().mockResolvedValue({ sid: 'SM123' });
    const ctx = makeCtx({ action: 'sendSms', to: '+1234567890', body: 'Hello' }, integrate);
    const res = (await twilioNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'twilio',
      'sendSms',
      expect.objectContaining({ to: '+1234567890', body: 'Hello' }),
    );
    expect(res.success).toBe(true);
  });

  it('makes a call', async () => {
    const integrate = vi.fn().mockResolvedValue({ sid: 'CA123' });
    const ctx = makeCtx(
      { action: 'makeCall', to: '+1234567890', url: 'https://twiml.example.com' },
      integrate,
    );
    const res = (await twilioNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'twilio',
      'makeCall',
      expect.objectContaining({ to: '+1234567890', url: 'https://twiml.example.com' }),
    );
    expect(res.success).toBe(true);
  });

  it('throws without body for sendSms', async () => {
    const ctx = makeCtx({ action: 'sendSms', to: '+1234567890' });
    await expect(twilioNode.handler(ctx)).rejects.toThrow('body is required');
  });

  it('throws without url for makeCall', async () => {
    const ctx = makeCtx({ action: 'makeCall', to: '+1234567890' });
    await expect(twilioNode.handler(ctx)).rejects.toThrow('url');
  });
});

describe('communication/sendgrid', () => {
  it('sends an email', async () => {
    const integrate = vi.fn().mockResolvedValue({ statusCode: 202 });
    const ctx = makeCtx(
      {
        action: 'sendEmail',
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Hi',
        html: '<p>Hello</p>',
      },
      integrate,
    );
    const res = (await sendgridNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'sendgrid',
      'sendEmail',
      expect.objectContaining({ to: 'user@example.com', subject: 'Hi' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/mailchimp', () => {
  it('adds a member to a list', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'mem-1' });
    const ctx = makeCtx(
      { action: 'addMember', listId: 'list-1', email: 'user@example.com', status: 'subscribed' },
      integrate,
    );
    const res = (await mailchimpNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'mailchimp',
      'addMember',
      expect.objectContaining({ listId: 'list-1', email: 'user@example.com' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Meetings & Scheduling
// ────────────────────────────────────────────────────────────────

describe('communication/zoom', () => {
  it('creates a meeting', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 123, join_url: 'https://zoom.us/j/123' });
    const ctx = makeCtx({ action: 'createMeeting', topic: 'Standup', duration: 30 }, integrate);
    const res = (await zoomNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'zoom',
      'createMeeting',
      expect.objectContaining({ topic: 'Standup', duration: 30 }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/calendly', () => {
  it('lists events', async () => {
    const integrate = vi.fn().mockResolvedValue({ collection: [] });
    const ctx = makeCtx({ action: 'listEvents' }, integrate);
    const res = (await calendlyNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'calendly',
      'listEvents',
      expect.objectContaining({ connectionId: 'conn-1' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Developer Tools
// ────────────────────────────────────────────────────────────────

describe('communication/github', () => {
  it('creates an issue', async () => {
    const integrate = vi
      .fn()
      .mockResolvedValue({ id: 1, number: 42, html_url: 'https://github.com/...', node_id: 'abc' });
    const ctx = makeCtx(
      { action: 'createIssue', owner: 'acme', repo: 'app', title: 'Bug' },
      integrate,
    );
    const res = (await githubNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'github',
      'createIssue',
      expect.objectContaining({ owner: 'acme', repo: 'app', title: 'Bug' }),
    );
    expect(res.number).toBe(42);
  });

  it('throws without title for createIssue', async () => {
    const ctx = makeCtx({ action: 'createIssue', owner: 'acme', repo: 'app' });
    await expect(githubNode.handler(ctx)).rejects.toThrow('title is required');
  });
});

describe('communication/gitlab', () => {
  it('creates an issue', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 1 });
    const ctx = makeCtx({ action: 'createIssue', projectId: 'proj-1', title: 'Bug' }, integrate);
    const res = (await gitlabNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'gitlab',
      'createIssue',
      expect.objectContaining({ projectId: 'proj-1', title: 'Bug' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/bitbucket', () => {
  it('creates a pull request', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 1 });
    const ctx = makeCtx(
      {
        action: 'createPR',
        workspace: 'acme',
        repoSlug: 'app',
        title: 'Fix',
        sourceBranch: 'feat',
        destinationBranch: 'main',
      },
      integrate,
    );
    const res = (await bitbucketNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'bitbucket',
      'createPR',
      expect.objectContaining({ workspace: 'acme', title: 'Fix' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/vercel', () => {
  it('creates a deployment', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'dpl-1' });
    const ctx = makeCtx(
      { action: 'createDeployment', projectId: 'proj-1', name: 'my-app' },
      integrate,
    );
    const res = (await vercelNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'vercel',
      'createDeployment',
      expect.objectContaining({ projectId: 'proj-1' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/circleci', () => {
  it('triggers a pipeline', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'pipe-1' });
    const ctx = makeCtx(
      { action: 'triggerPipeline', projectSlug: 'gh/acme/app', branch: 'main' },
      integrate,
    );
    const res = (await circleciNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'circleci',
      'triggerPipeline',
      expect.objectContaining({ projectSlug: 'gh/acme/app' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Project Management
// ────────────────────────────────────────────────────────────────

describe('communication/jira', () => {
  it('creates an issue', async () => {
    const integrate = vi.fn().mockResolvedValue({ key: 'PROJ-1' });
    const ctx = makeCtx(
      { action: 'createIssue', projectKey: 'PROJ', summary: 'Fix login' },
      integrate,
    );
    const res = (await jiraNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'jira',
      'createIssue',
      expect.objectContaining({ projectKey: 'PROJ', summary: 'Fix login' }),
    );
    expect(res.success).toBe(true);
  });

  it('throws without projectKey for createIssue', async () => {
    const ctx = makeCtx({ action: 'createIssue', summary: 'oops' });
    await expect(jiraNode.handler(ctx)).rejects.toThrow('projectKey and summary are required');
  });
});

describe('communication/linear', () => {
  it('creates an issue', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'LIN-1' });
    const ctx = makeCtx({ action: 'createIssue', teamId: 'team-1', title: 'Bug' }, integrate);
    const res = (await linearNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'linear',
      'createIssue',
      expect.objectContaining({ teamId: 'team-1', title: 'Bug' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/asana', () => {
  it('creates a task', async () => {
    const integrate = vi.fn().mockResolvedValue({ gid: '123' });
    const ctx = makeCtx({ action: 'createTask', workspaceId: 'ws-1', name: 'Do stuff' }, integrate);
    const res = (await asanaNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'asana',
      'createTask',
      expect.objectContaining({ workspaceId: 'ws-1', name: 'Do stuff' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/trello', () => {
  it('adds a card', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'card-1' });
    const ctx = makeCtx({ action: 'addCard', listId: 'list-1', name: 'Task' }, integrate);
    const res = (await trelloNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'trello',
      'addCard',
      expect.objectContaining({ listId: 'list-1', name: 'Task' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/monday', () => {
  it('creates an item', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'item-1' });
    const ctx = makeCtx({ action: 'createItem', boardId: 'board-1', itemName: 'Task' }, integrate);
    const res = (await mondayNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'monday',
      'createItem',
      expect.objectContaining({ boardId: 'board-1', itemName: 'Task' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/clickup', () => {
  it('creates a time entry', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'te-1' });
    const ctx = makeCtx({ action: 'createTimeEntry', taskId: 'task-1', duration: 3600 }, integrate);
    const res = (await clickupNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'clickup',
      'createTimeEntry',
      expect.objectContaining({ taskId: 'task-1' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// CRM
// ────────────────────────────────────────────────────────────────

describe('communication/salesforce', () => {
  it('creates a lead', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: '00Q1' });
    const ctx = makeCtx({ action: 'createLead', lastName: 'Smith', company: 'Acme' }, integrate);
    const res = (await salesforceNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'salesforce',
      'createLead',
      expect.objectContaining({ lastName: 'Smith', company: 'Acme' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/hubspot', () => {
  it('archives a contact', async () => {
    const integrate = vi.fn().mockResolvedValue({ ok: true });
    const ctx = makeCtx({ action: 'archiveContact', contactId: 'c-1' }, integrate);
    const res = (await hubspotNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'hubspot',
      'archiveContact',
      expect.objectContaining({ contactId: 'c-1' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/pipedrive', () => {
  it('adds a deal', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 1 });
    const ctx = makeCtx({ action: 'addDeal', title: 'New deal' }, integrate);
    const res = (await pipedriveNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'pipedrive',
      'addDeal',
      expect.objectContaining({ title: 'New deal' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Productivity
// ────────────────────────────────────────────────────────────────

describe('communication/notion', () => {
  it('creates a page', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'page-1', url: 'https://notion.so/...' });
    const ctx = makeCtx({ action: 'createPage', databaseId: 'db-1' }, integrate);
    const res = (await notionNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'notion',
      'createPage',
      expect.objectContaining({ connectionId: 'conn-1' }),
    );
    expect(res.id).toBe('page-1');
  });
});

describe('communication/google-sheets', () => {
  it('creates a row', async () => {
    const integrate = vi.fn().mockResolvedValue({ updatedRows: 1 });
    const ctx = makeCtx(
      {
        action: 'createRow',
        spreadsheetId: 'ss-1',
        sheetName: 'Sheet1',
        row: { col1: 'a', col2: 'b' },
      },
      integrate,
    );
    const res = (await googleSheetsNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'google-sheets',
      'createRow',
      expect.objectContaining({ spreadsheetId: 'ss-1' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/google-drive', () => {
  it('creates a file', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'file-1' });
    const ctx = makeCtx({ action: 'createFile', name: 'doc.txt', content: 'hello' }, integrate);
    const res = (await googleDriveNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'google-drive',
      'createFile',
      expect.objectContaining({ name: 'doc.txt' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/google-calendar', () => {
  it('creates an event', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'evt-1' });
    const ctx = makeCtx(
      {
        action: 'createEvent',
        calendarId: 'primary',
        summary: 'Meeting',
        startTime: '2025-01-01T10:00:00Z',
        endTime: '2025-01-01T11:00:00Z',
      },
      integrate,
    );
    const res = (await googleCalendarNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'google-calendar',
      'createEvent',
      expect.objectContaining({ summary: 'Meeting' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/airtable', () => {
  it('creates a record', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'rec-1' });
    const ctx = makeCtx(
      { action: 'createRecord', baseId: 'app123', tableId: 'tbl456', fields: { Name: 'Alice' } },
      integrate,
    );
    const res = (await airtableNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'airtable',
      'createRecord',
      expect.objectContaining({ baseId: 'app123' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/dropbox', () => {
  it('adds a file member', async () => {
    const integrate = vi.fn().mockResolvedValue({ ok: true });
    const ctx = makeCtx(
      { action: 'addFileMember', fileId: 'f-1', memberEmail: 'user@example.com' },
      integrate,
    );
    const res = (await dropboxNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'dropbox',
      'addFileMember',
      expect.objectContaining({ fileId: 'f-1' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Payments & Finance
// ────────────────────────────────────────────────────────────────

describe('communication/stripe', () => {
  it('creates a charge', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'ch_1' });
    const ctx = makeCtx(
      { action: 'createCharge', amount: 1000, currency: 'usd', source: 'tok_visa' },
      integrate,
    );
    const res = (await stripeNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'stripe',
      'createCharge',
      expect.objectContaining({ amount: 1000 }),
    );
    expect(res.ok).toBe(true);
  });

  it('throws without amount', async () => {
    const ctx = makeCtx({ action: 'createCharge', currency: 'usd', source: 'tok_visa' });
    await expect(stripeNode.handler(ctx)).rejects.toThrow('amount is required');
  });
});

describe('communication/shopify', () => {
  it('creates products', async () => {
    const integrate = vi.fn().mockResolvedValue({ created: 1 });
    const ctx = makeCtx({ action: 'createProducts', products: [{ title: 'Widget' }] }, integrate);
    const res = (await shopifyNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'shopify',
      'createProducts',
      expect.objectContaining({ products: [{ title: 'Widget' }] }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/quickbooks', () => {
  it('creates an invoice', async () => {
    const integrate = vi.fn().mockResolvedValue({ Id: 'inv-1' });
    const ctx = makeCtx(
      { action: 'createInvoice', customerRef: { value: '1' }, lineItems: [{ amount: 100 }] },
      integrate,
    );
    const res = (await quickbooksNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'quickbooks',
      'createInvoice',
      expect.objectContaining({ customerRef: { value: '1' } }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/xero', () => {
  it('creates an invoice', async () => {
    const integrate = vi.fn().mockResolvedValue({ InvoiceID: 'inv-1' });
    const ctx = makeCtx(
      { action: 'createInvoice', contactId: 'c-1', lineItems: [{ description: 'Work' }] },
      integrate,
    );
    const res = (await xeroNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'xero',
      'createInvoice',
      expect.objectContaining({ contactId: 'c-1' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Social Media
// ────────────────────────────────────────────────────────────────

describe('communication/twitter', () => {
  it('creates a post', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'tweet-1' });
    const ctx = makeCtx({ action: 'createPost', text: 'Hello Twitter!' }, integrate);
    const res = (await twitterNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'twitter',
      'createPost',
      expect.objectContaining({ text: 'Hello Twitter!' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/linkedin', () => {
  it('creates a post', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'post-1' });
    const ctx = makeCtx({ action: 'createPost', text: 'Hello LinkedIn!' }, integrate);
    const res = (await linkedinNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'linkedin',
      'createPost',
      expect.objectContaining({ text: 'Hello LinkedIn!' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/instagram', () => {
  it('creates a post', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'ig-1' });
    const ctx = makeCtx(
      { action: 'createPost', imageUrl: 'https://example.com/img.jpg', caption: 'Nice!' },
      integrate,
    );
    const res = (await instagramNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'instagram',
      'createPost',
      expect.objectContaining({ imageUrl: 'https://example.com/img.jpg' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/youtube', () => {
  it('adds a video to playlist', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'pl-item-1' });
    const ctx = makeCtx(
      { action: 'addToPlaylist', playlistId: 'pl-1', videoId: 'vid-1' },
      integrate,
    );
    const res = (await youtubeNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'youtube',
      'addToPlaylist',
      expect.objectContaining({ playlistId: 'pl-1', videoId: 'vid-1' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Support
// ────────────────────────────────────────────────────────────────

describe('communication/zendesk', () => {
  it('creates a ticket', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 1 });
    const ctx = makeCtx(
      { action: 'createTicket', subject: 'Help', description: 'Need help' },
      integrate,
    );
    const res = (await zendeskNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'zendesk',
      'createTicket',
      expect.objectContaining({ subject: 'Help' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/freshdesk', () => {
  it('adds a note', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 1 });
    const ctx = makeCtx({ action: 'addNote', ticketId: 't-1', body: 'A note' }, integrate);
    const res = (await freshdeskNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'freshdesk',
      'addNote',
      expect.objectContaining({ ticketId: 't-1', body: 'A note' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/intercom', () => {
  it('creates a contact', async () => {
    const integrate = vi.fn().mockResolvedValue({ id: 'contact-1' });
    const ctx = makeCtx(
      { action: 'createContact', email: 'user@example.com', name: 'Alice' },
      integrate,
    );
    const res = (await intercomNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'intercom',
      'createContact',
      expect.objectContaining({ email: 'user@example.com' }),
    );
    expect(res.success).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────────

describe('communication/google-analytics', () => {
  it('runs a report', async () => {
    const integrate = vi.fn().mockResolvedValue({ rows: [] });
    const ctx = makeCtx(
      { action: 'runReport', propertyId: 'prop-1', dimensions: ['country'], metrics: ['sessions'] },
      integrate,
    );
    const res = (await googleAnalyticsNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'google-analytics',
      'runReport',
      expect.objectContaining({ propertyId: 'prop-1' }),
    );
    expect(res.success).toBe(true);
  });
});

describe('communication/segment', () => {
  it('tracks an event', async () => {
    const integrate = vi.fn().mockResolvedValue({ success: true });
    const ctx = makeCtx(
      { action: 'track', userId: 'user-1', event: 'Page Viewed', properties: { url: '/home' } },
      integrate,
    );
    const res = (await segmentNode.handler(ctx)) as Record<string, unknown>;
    expect(integrate).toHaveBeenCalledWith(
      'segment',
      'track',
      expect.objectContaining({ userId: 'user-1', event: 'Page Viewed' }),
    );
    expect(res.success).toBe(true);
  });
});
