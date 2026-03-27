/**
 * Reusable Paperclip API client for pipeline scripts.
 * Extracts the common auth + fetch pattern used across all scripts.
 */

import { execSync } from 'node:child_process';
import {
  PAPERCLIP_API_URL,
  PAPERCLIP_COMPANY_ID,
  PAPERCLIP_PROJECT_ID,
  AGENTS,
  getPaperclipApiKey,
} from '../../config.mjs';

export class PaperclipClient {
  constructor({ agentId = AGENTS.CEO, companyId, projectId } = {}) {
    this.apiUrl = PAPERCLIP_API_URL;
    this.companyId = companyId || PAPERCLIP_COMPANY_ID;
    this.projectId = projectId || PAPERCLIP_PROJECT_ID;
    this.apiKey = getPaperclipApiKey(agentId);
    this.runId = process.env.PAPERCLIP_RUN_ID || '';

    if (!this.apiKey) {
      throw new Error('No auth available: set PAPERCLIP_API_KEY or PAPERCLIP_AGENT_JWT_SECRET');
    }
  }

  async request(method, path, body) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.runId) headers['X-Paperclip-Run-Id'] = this.runId;

    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path} returned ${res.status}: ${text}`);
    }
    return res.json();
  }

  async createIssue(fields) {
    return this.request('POST', `/api/companies/${this.companyId}/issues`, {
      projectId: this.projectId,
      ...fields,
    });
  }

  async searchIssues(query) {
    return this.request('GET', `/api/companies/${this.companyId}/issues?q=${encodeURIComponent(query)}`);
  }

  async getIssue(issueId) {
    return this.request('GET', `/api/issues/${issueId}`);
  }

  async addComment(issueId, body) {
    return this.request('POST', `/api/issues/${issueId}/comments`, { body });
  }

  /** Count child issues (subtasks) of a parent issue via local DB query */
  countChildren(parentId) {
    try {
      const result = execSync(
        `psql -U luca -d paperclip -t -A -c "SELECT COUNT(*) FROM issues WHERE parent_id = '${parentId.replace(/'/g, "''")}';"`,
        { encoding: 'utf-8', uid: 1000 }
      ).trim();
      return parseInt(result, 10) || 0;
    } catch {
      return -1; // error querying — treat as unknown
    }
  }

  /** Resolve an AGENTS key (e.g. "SEO_EXPERT") to its UUID */
  static resolveAgent(key) {
    const id = AGENTS[key];
    if (!id) {
      const valid = Object.keys(AGENTS).join(', ');
      throw new Error(`Unknown agent key "${key}". Valid keys: ${valid}`);
    }
    return id;
  }
}
