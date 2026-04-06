import type { IntegrationAdaptor } from '@flowforge/shared';
import { IntegrationError } from '@flowforge/shared';

export interface GitHubClient {
  createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
  ): Promise<unknown>;
  createPR(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ): Promise<unknown>;
  addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<unknown>;
  createRelease(
    owner: string,
    repo: string,
    tag: string,
    name: string,
    body?: string,
    draft?: boolean,
  ): Promise<unknown>;
  listRepos(org?: string, page?: number, perPage?: number): Promise<unknown>;
}

interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

interface CreatePRParams {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
}

interface AddCommentParams {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

interface CreateReleaseParams {
  owner: string;
  repo: string;
  tag: string;
  name: string;
  body?: string;
  draft?: boolean;
}

interface ListReposParams {
  org?: string;
  page?: number;
  perPage?: number;
}

export class GitHubAdaptor implements IntegrationAdaptor {
  readonly name = 'github';
  readonly actions = ['createIssue', 'createPR', 'addComment', 'createRelease', 'listRepos'];

  constructor(private readonly client?: GitHubClient) {}

  async execute(action: string, params: unknown, _connectionId: string): Promise<unknown> {
    switch (action) {
      case 'createIssue':
        return this.createIssue(params);
      case 'createPR':
        return this.createPR(params);
      case 'addComment':
        return this.addComment(params);
      case 'createRelease':
        return this.createRelease(params);
      case 'listRepos':
        return this.listRepos(params);
      default:
        throw new IntegrationError('github', `Unknown action: ${action}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client !== undefined;
  }

  private async createIssue(params: unknown): Promise<unknown> {
    this.requireFields(params, ['owner', 'repo', 'title']);
    const p = params as CreateIssueParams;
    if (!this.client) return { action: 'createIssue', params };
    return this.client.createIssue(p.owner, p.repo, p.title, p.body, p.labels);
  }

  private async createPR(params: unknown): Promise<unknown> {
    this.requireFields(params, ['owner', 'repo', 'title', 'head', 'base']);
    const p = params as CreatePRParams;
    if (!this.client) return { action: 'createPR', params };
    return this.client.createPR(p.owner, p.repo, p.title, p.head, p.base, p.body);
  }

  private async addComment(params: unknown): Promise<unknown> {
    this.requireFields(params, ['owner', 'repo', 'issueNumber', 'body']);
    const p = params as AddCommentParams;
    if (!this.client) return { action: 'addComment', params };
    return this.client.addComment(p.owner, p.repo, p.issueNumber, p.body);
  }

  private async createRelease(params: unknown): Promise<unknown> {
    this.requireFields(params, ['owner', 'repo', 'tag', 'name']);
    const p = params as CreateReleaseParams;
    if (!this.client) return { action: 'createRelease', params };
    return this.client.createRelease(p.owner, p.repo, p.tag, p.name, p.body, p.draft);
  }

  private async listRepos(params: unknown): Promise<unknown> {
    this.requireFields(params, []);
    const p = params as ListReposParams;
    if (!this.client) return { action: 'listRepos', params };
    return this.client.listRepos(p.org, p.page, p.perPage);
  }

  private requireFields(params: unknown, fields: string[]): void {
    if (typeof params !== 'object' || params === null) {
      throw new IntegrationError('github', 'params must be an object');
    }
    const p = params as Record<string, unknown>;
    for (const field of fields) {
      if (p[field] === undefined || p[field] === null) {
        throw new IntegrationError('github', `Missing required field: ${field}`);
      }
    }
  }
}
