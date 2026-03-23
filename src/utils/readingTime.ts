/** Estimate reading time from raw markdown/text content. */
export function getReadingTime(content: string): number {
	// Strip markdown syntax for more accurate word count
	const text = content
		.replace(/```[\s\S]*?```/g, '') // code blocks
		.replace(/`[^`]*`/g, '') // inline code
		.replace(/!\[.*?\]\(.*?\)/g, '') // images
		.replace(/\[([^\]]*)\]\(.*?\)/g, '$1') // links → text
		.replace(/#{1,6}\s/g, '') // headings
		.replace(/[*_~]+/g, '') // emphasis
		.replace(/^\s*[-*+]\s/gm, '') // list markers
		.replace(/^\s*\d+\.\s/gm, '') // numbered list markers
		.replace(/---+/g, '') // horizontal rules
		.replace(/<[^>]+>/g, '') // HTML tags
		.trim();

	const words = text.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 238));
}
