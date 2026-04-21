export type AgentKind = 'human' | 'ai';

export interface Agent {
	id: string;
	name: string;
	role: string;
	kind: AgentKind;
	color: string;
	/** Position on unit canvas (0-1 coords). Pre-placed to feel "organic" rather than grid. */
	position: { x: number; y: number };
}

/**
 * 1 human + 9 AI agents. Matches the brand claim "Built by one person and nine AI agents."
 * The Paperclip "CEO" agent is Luca operating a seat; we represent him as the human dot.
 */
export const AGENTS: Agent[] = [
	{
		id: 'luca',
		name: 'Luca Bartoccini',
		role: "Founder, editor, the one who says 'no, rewrite that.'",
		kind: 'human',
		color: '#E8363B',
		position: { x: 0.5, y: 0.5 },
	},
	{
		id: 'program-manager',
		name: 'Program Manager',
		role: 'Runs the daily pipeline, keeps briefs moving.',
		kind: 'ai',
		color: '#F59E0B',
		position: { x: 0.22, y: 0.18 },
	},
	{
		id: 'content-manager',
		name: 'Content Manager',
		role: 'Sets editorial priorities, balances the pillars.',
		kind: 'ai',
		color: '#E8363B',
		position: { x: 0.8, y: 0.2 },
	},
	{
		id: 'copywriter',
		name: 'Copywriter',
		role: 'Drafts every article. Ships the words.',
		kind: 'ai',
		color: '#F97A7E',
		position: { x: 0.12, y: 0.46 },
	},
	{
		id: 'seo-expert',
		name: 'SEO Expert',
		role: 'Research, keyword strategy, on-page fixes.',
		kind: 'ai',
		color: '#14B8A6',
		position: { x: 0.88, y: 0.5 },
	},
	{
		id: 'growth-analyst',
		name: 'Growth Analyst',
		role: 'Reads the numbers, surfaces what works.',
		kind: 'ai',
		color: '#2DD4BF',
		position: { x: 0.7, y: 0.78 },
	},
	{
		id: 'founding-engineer',
		name: 'Founding Engineer',
		role: 'Keeps the infrastructure alive and honest.',
		kind: 'ai',
		color: '#8B8BF5',
		position: { x: 0.3, y: 0.82 },
	},
	{
		id: 'frontend-designer',
		name: 'Frontend Designer',
		role: 'Owns how every page looks and feels.',
		kind: 'ai',
		color: '#A5B4FC',
		position: { x: 0.08, y: 0.74 },
	},
	{
		id: 'legal-expert',
		name: 'Legal Expert',
		role: 'Reviews for compliance, never hypes a claim.',
		kind: 'ai',
		color: '#FBBF24',
		position: { x: 0.92, y: 0.78 },
	},
	{
		id: 'reddit-ads',
		name: 'Reddit Ads Specialist',
		role: 'Distributes the work where it earns attention.',
		kind: 'ai',
		color: '#FB7185',
		position: { x: 0.5, y: 0.08 },
	},
];

/** Compact list of AI agents (excludes Luca) — used when rendering a roster only. */
export const AI_AGENTS = AGENTS.filter((a) => a.kind === 'ai');
export const HUMAN = AGENTS.find((a) => a.kind === 'human')!;
