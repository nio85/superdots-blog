import type { CollectionEntry } from 'astro:content';

/**
 * Filters blog posts to only those whose pubDate is at or before the current
 * build time. This implements scheduled publishing: articles with a future
 * pubDate are written and merged but do not appear anywhere on the site
 * (no listing, no URL, no sitemap entry, no RSS item) until a build runs
 * after their pubDate.
 *
 * The daily GitHub Actions deploy at 07:00 Europe/Rome ensures scheduled
 * articles go live within 7 hours of their pubDate.
 *
 * Usage:
 *   import { filterPublished } from '../../lib/posts';
 *   const posts = filterPublished(await getCollection('blog'));
 */
export function filterPublished(posts: CollectionEntry<'blog'>[]): CollectionEntry<'blog'>[] {
	const now = new Date();
	return posts.filter((post) => post.data.pubDate <= now);
}
