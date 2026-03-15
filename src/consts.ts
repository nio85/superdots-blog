export const SITE_TITLE = 'Superdots';
export const SITE_DESCRIPTION = 'Practical AI guides for every department. No fluff, just useful stuff.';
export const ANALYTICS_DOMAIN = 'superdots.sh';

export const DEPARTMENTS = [
	{ slug: 'engineering', label: 'Engineering' },
	{ slug: 'marketing', label: 'Marketing' },
	{ slug: 'sales', label: 'Sales' },
	{ slug: 'hr', label: 'HR' },
	{ slug: 'finance', label: 'Finance' },
	{ slug: 'operations', label: 'Operations' },
] as const;

export const USE_CASES = [
	{ slug: 'automation', label: 'Automation' },
	{ slug: 'analysis', label: 'Analysis' },
	{ slug: 'writing', label: 'Writing' },
	{ slug: 'communication', label: 'Communication' },
] as const;
