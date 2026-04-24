export const SITE_TITLE = 'Superdots';
export const SITE_DESCRIPTION = 'Practical AI for work — guides, insights, opinions, and the real story. No fluff.';
export const GA_MEASUREMENT_ID = 'G-DC2BTH9VKX';
export const CLARITY_PROJECT_ID = 'vxukclgmnh';
export const UMAMI_WEBSITE_ID = 'ad359e34-1608-4bf6-9e4e-e8200ed04b86';
export const UMAMI_URL = 'https://umami.bartoccini.cloud';
export const REDDIT_PIXEL_ID = import.meta.env.PUBLIC_REDDIT_PIXEL_ID || '';
export const META_PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID || '';

export const PILLARS = [
	{
		slug: 'dot-by-dot',
		label: 'Dot by Dot',
		description:
			'Step-by-step AI tool guides, how-to walkthroughs, and side-by-side comparisons for every department. Find the right AI tool for your workflow.',
		color: 'red',
	},
	{
		slug: 'connecting-the-dots',
		label: 'Connecting the Dots',
		description:
			'Practical AI and work advice you can act on today — how to use AI for specific tasks, workflows, and professional challenges, without the fluff.',
		color: 'teal',
	},
	{
		slug: 'the-big-picture',
		label: 'The Big Picture',
		description:
			'Data-backed analysis, opinion, and the bigger trends shaping AI and the future of work. Informed perspectives, not hype.',
		color: 'indigo',
	},
	{
		slug: 'behind-the-dots',
		label: 'Behind the Dots',
		description:
			"Behind the scenes at Superdots — real numbers, real mistakes, and what we've learned building an AI-first content company.",
		color: 'amber',
	},
] as const;

export const DEPARTMENTS = [
	{
		slug: 'engineering',
		label: 'Engineering',
		description:
			'AI for engineering teams: ship faster with AI-assisted code reviews, automated documentation, and smarter debugging workflows. Practical guides, no fluff.',
	},
	{
		slug: 'marketing',
		label: 'Marketing',
		description:
			'AI for marketing teams: sharpen your copy, speed up competitive research, and turn customer data into campaigns that convert. Practical, actionable guides.',
	},
	{
		slug: 'sales',
		label: 'Sales',
		description:
			'AI for sales teams: prospect smarter, prep better, follow up faster, and close more deals with practical AI workflows. Real tools, real results.',
	},
	{
		slug: 'hr',
		label: 'HR',
		description:
			'AI for HR teams: hire faster, onboard smoother, and cut admin time. Practical guides for human resources professionals using AI to work smarter.',
	},
	{
		slug: 'finance',
		label: 'Finance',
		description:
			'AI for finance teams: improve forecasts, streamline budgeting, and catch what spreadsheets miss. Practical AI guides for finance professionals.',
	},
	{
		slug: 'operations',
		label: 'Operations',
		description:
			'AI for operations teams: cut busywork, automate email triage, streamline project tracking, and build smarter knowledge bases. Practical ops guides.',
	},
	{
		slug: 'legal',
		label: 'Legal',
		description:
			'AI for legal teams: review contracts faster, track compliance, and reduce manual document work. Practical AI guides for legal professionals.',
	},
	{
		slug: 'customer-support',
		label: 'Customer Support',
		description:
			'AI for customer support teams: respond faster, resolve more tickets, and keep customers happy without burning out. Practical guides for support pros.',
	},
	{
		slug: 'design',
		label: 'Design',
		description:
			'AI for design teams: speed up mockups, explore more creative concepts, and handle production work faster — without extra headcount. Practical guides.',
	},
] as const;

export const USE_CASES = [
	{
		slug: 'automation',
		label: 'Automation',
		description:
			'Guides for automating the repetitive stuff — email triage, data entry, routine approvals — so your team can focus on work that matters.',
	},
	{
		slug: 'analysis',
		label: 'Analysis',
		description:
			'AI techniques for pulling insights from data, feedback, and research — without needing a data science degree.',
	},
	{
		slug: 'writing',
		label: 'Writing',
		description:
			'Guides for writing faster and better with AI — emails, docs, reports, and customer-facing copy that still sounds like you.',
	},
	{
		slug: 'communication',
		label: 'Communication',
		description: 'AI guides for clearer, faster team communication — from meeting summaries to smarter async updates.',
	},
] as const;

export const TAGS = [
	{
		slug: 'ai-tools',
		label: 'AI Tools',
		description:
			"Discover the best AI tools for work — practical reviews, comparisons, and guides to boost your team's output.",
	},
	{
		slug: 'productivity',
		label: 'Productivity',
		description: 'Proven strategies and AI-powered workflows to get more done with less effort at work.',
	},
	{
		slug: 'ai-writing',
		label: 'AI Writing',
		description:
			'AI writing assistants that help you draft, edit, and polish content while keeping your authentic voice.',
	},
	{
		slug: 'ai-email',
		label: 'AI Email',
		description:
			'Tame your inbox with AI — smart triage, automated replies, and email management tools that save hours weekly.',
	},
	{
		slug: 'ai-data-analysis',
		label: 'AI Data Analysis',
		description: 'Turn raw data into insights without code — AI tools that make data analysis accessible to every team.',
	},
	{
		slug: 'ai-for-hr',
		label: 'AI for HR',
		description:
			'AI solutions for human resources — from recruiting and onboarding to employee engagement and compliance.',
	},
	{
		slug: 'ai-customer-support',
		label: 'AI Customer Support',
		description:
			'Build faster, smarter customer service with AI chatbots, sentiment analysis, and automated ticket resolution.',
	},
	{
		slug: 'ai-for-sales',
		label: 'AI for Sales',
		description: 'AI tools that help sales teams prospect smarter, prep better, and close more deals.',
	},
	{
		slug: 'ai-for-legal',
		label: 'AI for Legal',
		description:
			'AI-powered contract review, compliance tracking, and legal research tools for non-lawyers and legal teams alike.',
	},
	{
		slug: 'ai-for-finance',
		label: 'AI for Finance',
		description: 'AI budgeting, forecasting, and financial planning tools that give every team CFO-level insights.',
	},
	{
		slug: 'ai-project-management',
		label: 'AI Project Management',
		description: 'AI features that automate task tracking, predict risks, and keep projects on schedule.',
	},
	{
		slug: 'ai-for-operations',
		label: 'AI for Operations',
		description: 'Streamline inventory, logistics, and business operations with practical AI automation.',
	},
	{
		slug: 'ai-design',
		label: 'AI Design',
		description:
			'Create professional visuals without a designer — AI tools for presentations, graphics, and brand assets.',
	},
	{
		slug: 'ai-meetings',
		label: 'AI Meetings',
		description: 'AI meeting assistants that capture notes, extract action items, and make every meeting count.',
	},
	{
		slug: 'ai-knowledge-management',
		label: 'AI Knowledge Management',
		description:
			'Build a smarter team knowledge base with AI — search, organize, and surface institutional knowledge instantly.',
	},
] as const;
