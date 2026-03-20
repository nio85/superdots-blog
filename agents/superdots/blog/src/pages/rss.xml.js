import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
	const posts = await getCollection('blog');
	const sortedPosts = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
	const lastBuildDate = sortedPosts[0]?.data.pubDate ?? new Date();
	const siteUrl = context.site.toString().replace(/\/$/, '');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		xmlns: { atom: 'http://www.w3.org/2005/Atom' },
		customData: [
			`<language>en</language>`,
			`<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`,
			`<atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>`,
		].join('\n'),
		items: sortedPosts.map((post) => ({
			title: post.data.title,
			pubDate: post.data.pubDate,
			description: post.data.description,
			link: `/blog/${post.slug}/`,
		})),
	});
}
