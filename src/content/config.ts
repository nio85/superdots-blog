import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	type: 'content',
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().default('Superdots Team'),
		department: z.enum(['engineering', 'marketing', 'sales', 'hr', 'finance', 'operations', 'legal', 'customer-support', 'design']),
		useCase: z.enum(['automation', 'analysis', 'writing', 'communication']),
		pillar: z.boolean().default(false),
		tags: z.array(z.string()).default([]),
		heroImage: z.union([image(), z.string()]).optional(),
		faqs: z.array(z.object({
			question: z.string(),
			answer: z.string(),
		})).optional(),
	}),
});

export const collections = { blog };
