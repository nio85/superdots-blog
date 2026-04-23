import { describe, expect, it } from 'vitest';
import { tagSlugToLabel, toTagSlug } from './tags';

describe('toTagSlug', () => {
	it('lowercases and hyphenates spaces', () => {
		expect(toTagSlug('AI Tools')).toBe('ai-tools');
		expect(toTagSlug('AI TOOLS')).toBe('ai-tools');
		expect(toTagSlug('ai tools')).toBe('ai-tools');
	});

	it('is idempotent on already-canonical slugs', () => {
		expect(toTagSlug('ai-tools')).toBe('ai-tools');
		expect(toTagSlug(toTagSlug('AI Tools'))).toBe('ai-tools');
	});

	it('collapses inconsistent casing/spacing variants to the same slug', () => {
		// This is the bug that caused 8 duplicate /tags/ pages (PR #284)
		const variants = ['AI tools', 'ai tools', 'AI Tools', 'AI  Tools', '  ai tools  '];
		const slugs = new Set(variants.map(toTagSlug));
		expect(slugs.size).toBe(1);
		expect([...slugs][0]).toBe('ai-tools');
	});

	it('strips non-alphanumeric characters', () => {
		expect(toTagSlug('AI & Productivity!')).toBe('ai-productivity');
		expect(toTagSlug('AI/ML')).toBe('aiml');
		expect(toTagSlug('ChatGPT (Advanced)')).toBe('chatgpt-advanced');
	});

	it('collapses repeated hyphens', () => {
		expect(toTagSlug('ai--tools')).toBe('ai-tools');
		expect(toTagSlug('ai - - tools')).toBe('ai-tools');
	});

	it('trims leading and trailing hyphens', () => {
		expect(toTagSlug('-ai-tools-')).toBe('ai-tools');
		expect(toTagSlug('   ai tools   ')).toBe('ai-tools');
	});

	it('returns empty string for pure-symbol input', () => {
		expect(toTagSlug('---')).toBe('');
		expect(toTagSlug('!!!')).toBe('');
	});
});

describe('tagSlugToLabel', () => {
	it('title-cases hyphenated slugs', () => {
		expect(tagSlugToLabel('ai-tools')).toBe('Ai Tools');
		expect(tagSlugToLabel('productivity')).toBe('Productivity');
	});

	it('handles single-word slugs', () => {
		expect(tagSlugToLabel('writing')).toBe('Writing');
	});
});
