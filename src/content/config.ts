import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		author: z.string().default('Superdots Team'),
		department: z.enum(['engineering', 'marketing', 'sales', 'hr', 'finance', 'operations']),
		useCase: z.enum(['automation', 'analysis', 'writing', 'communication']),
		tags: z.array(z.string()).default([]),
		heroImage: z.string().optional(),
	}),
});

export const collections = { blog };
