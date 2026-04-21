import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	type: 'content',
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().default('Superdots Team'),
		contentPillar: z.enum(['dot-by-dot', 'connecting-the-dots', 'the-big-picture', 'behind-the-dots']).default('dot-by-dot'),
		department: z.enum(['engineering', 'marketing', 'sales', 'hr', 'finance', 'operations', 'legal', 'customer-support', 'design']).optional(),
		useCase: z.enum(['automation', 'analysis', 'writing', 'communication']).optional(),
		pillar: z.boolean().default(false),
		noindex: z.boolean().default(false),
		tags: z.array(z.string()).default([]),
		heroImage: z.union([image(), z.string()]).optional(),
		faqs: z.array(z.object({
			question: z.string(),
			answer: z.string(),
		})).optional(),
	}),
});

const legal = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pageTitle: z.string(),
		lastUpdated: z.string(),
	}),
});

const pages = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pageTitle: z.string(),
		kicker: z.string().optional(),
		subtitle: z.string().optional(),
	}),
});

export const collections = { blog, legal, pages };
