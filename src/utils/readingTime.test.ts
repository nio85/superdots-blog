import { describe, expect, it } from 'vitest';
import { getReadingTime } from './readingTime';

describe('getReadingTime', () => {
	it('returns at least 1 minute for any content', () => {
		expect(getReadingTime('')).toBe(1);
		expect(getReadingTime('hello world')).toBe(1);
	});

	it('rounds up to whole minutes (238 wpm)', () => {
		// 239 words → 2 min (ceil(239/238))
		const content = Array(239).fill('word').join(' ');
		expect(getReadingTime(content)).toBe(2);

		// 476 words → 2 min exactly
		const content2 = Array(476).fill('word').join(' ');
		expect(getReadingTime(content2)).toBe(2);

		// 477 words → 3 min
		const content3 = Array(477).fill('word').join(' ');
		expect(getReadingTime(content3)).toBe(3);
	});

	it('strips markdown syntax before counting', () => {
		const markdown = '# Heading\n\n```js\nconst x = 1;\nconst y = 2;\n```\n\nText [link](https://example.com) word.';
		// Should count: Heading, Text, link, word (code block stripped)
		const time = getReadingTime(markdown);
		expect(time).toBe(1);
	});

	it('strips HTML tags', () => {
		const html = '<p>Hello <strong>world</strong> from HTML</p>';
		// 4 words after strip: Hello, world, from, HTML
		expect(getReadingTime(html)).toBe(1);
	});

	it('strips list markers but keeps words', () => {
		const list = '- item one\n- item two\n- item three\n1. numbered one\n2. numbered two';
		// 10 words after stripping bullets/numbers
		expect(getReadingTime(list)).toBe(1);
	});

	it('strips horizontal rules', () => {
		expect(getReadingTime('word\n---\nword\n---\nword')).toBe(1);
	});
});
