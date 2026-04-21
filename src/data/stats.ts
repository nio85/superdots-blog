/**
 * Team / site stats — single source of truth for numbers shown on the site
 * (hero kicker, manifesto, about page, social).
 *
 * Source of truth for `aiAgents`: Paperclip DB (see `agents` table on the
 * production Postgres). Verify with:
 *
 *     sudo -u luca psql -d paperclip -tAc "SELECT count(*) FROM agents;"
 *
 * Whenever agents are added or retired via Paperclip, update this file.
 * A scheduled Paperclip routine (Founding Engineer) may later write it
 * automatically — until then, keep it in sync manually.
 *
 * Keep these values conservative and verifiable — they are public claims.
 */

export const TEAM_STATS = {
	/** Number of active Paperclip AI agents running heartbeats. */
	aiAgents: 10,
	/** Number of human editors with final sign-off. */
	humanEditors: 1,
	/** Number of sponsored/affiliated placements published. Zero by policy. */
	sponsored: 0,
} as const;
