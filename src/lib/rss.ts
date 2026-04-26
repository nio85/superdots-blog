export interface RssItemInput {
	title: string;
	pubDate: Date;
	description: string;
	slug: string;
	author?: string;
	heroImage?: string;
}

export interface RssItem {
	title: string;
	pubDate: Date;
	description: string;
	link: string;
	customData?: string;
}

export function buildRssItem(post: RssItemInput, siteUrl: string): RssItem {
	const imageUrl = post.heroImage ? `${siteUrl}${post.heroImage}` : null;
	return {
		title: post.title,
		pubDate: post.pubDate,
		description: post.description,
		link: `/blog/${post.slug}/`,
		customData: [
			post.author ? `<dc:creator>${post.author}</dc:creator>` : '',
			imageUrl ? `<media:content url="${imageUrl}" medium="image" type="image/webp"/>` : '',
		]
			.filter(Boolean)
			.join('\n'),
	};
}

export function buildRssCustomData(siteUrl: string, lastBuildDate: Date): string {
	return [
		`<language>en</language>`,
		`<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`,
		`<atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>`,
	].join('\n');
}

export function postsToRssItems(posts: Array<{ data: RssItemInput; slug: string }>, siteUrl: string): RssItem[] {
	return posts.map((post) => buildRssItem({ ...post.data, slug: post.slug }, siteUrl));
}
