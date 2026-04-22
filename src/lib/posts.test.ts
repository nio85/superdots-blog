import type { CollectionEntry } from 'astro:content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterPublished } from './posts';

// Minimal stub matching the shape filterPublished consumes
function mockPost(pubDate: Date): CollectionEntry<'blog'> {
	return { data: { pubDate } } as unknown as CollectionEntry<'blog'>;
}

describe('filterPublished', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns posts with past pubDate', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));

		const posts = [mockPost(new Date('2026-04-20T00:00:00Z')), mockPost(new Date('2026-04-21T00:00:00Z'))];
		expect(filterPublished(posts)).toHaveLength(2);
	});

	it('excludes posts with future pubDate (scheduled publishing)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));

		const posts = [
			mockPost(new Date('2026-04-20T00:00:00Z')), // past
			mockPost(new Date('2026-04-23T00:00:00Z')), // future — scheduled
			mockPost(new Date('2026-05-01T00:00:00Z')), // future — scheduled
		];
		expect(filterPublished(posts)).toHaveLength(1);
	});

	it('includes posts with pubDate equal to now', () => {
		vi.useFakeTimers();
		const now = new Date('2026-04-22T12:00:00Z');
		vi.setSystemTime(now);

		const posts = [mockPost(now)];
		expect(filterPublished(posts)).toHaveLength(1);
	});

	it('returns empty array when all posts are future', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));

		const posts = [mockPost(new Date('2026-04-23T00:00:00Z')), mockPost(new Date('2026-04-24T00:00:00Z'))];
		expect(filterPublished(posts)).toEqual([]);
	});

	it('does not mutate the input array', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));

		const posts = [mockPost(new Date('2026-04-20T00:00:00Z')), mockPost(new Date('2026-04-23T00:00:00Z'))];
		const original = [...posts];
		filterPublished(posts);
		expect(posts).toEqual(original);
	});
});
