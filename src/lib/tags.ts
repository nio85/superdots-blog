/**
 * Canonical tag slug.
 *
 * Agents sometimes write tags with inconsistent casing or spaces
 * ("AI tools", "ai tools", "ai-tools"). Without normalization, Astro
 * generates three separate /tags/... pages for the same topic, which
 * splits internal linking and produces duplicate titles/descriptions
 * in SEO audits.
 *
 * Rules:
 *   - lowercase
 *   - runs of whitespace → single hyphen
 *   - strip characters outside [a-z0-9-]
 *   - collapse repeated hyphens
 *   - trim leading/trailing hyphens
 */
export function toTagSlug(raw: string): string {
	return raw
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function tagSlugToLabel(slug: string): string {
	return slug
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}
