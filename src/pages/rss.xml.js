import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { filterPublished } from '../lib/posts';

export async function GET(context) {
	const sortedPosts = filterPublished(await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
	);
	const lastBuildDate = sortedPosts[0]?.data.pubDate ?? new Date();
	const siteUrl = context.site.toString().replace(/\/$/, '');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		xmlns: {
			atom: 'http://www.w3.org/2005/Atom',
			dc: 'http://purl.org/dc/elements/1.1/',
		},
		customData: [
			`<language>en</language>`,
			`<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`,
			`<atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>`,
		].join('\n'),
		items: sortedPosts.map((post) => {
			const imageUrl = post.data.heroImage ? `${siteUrl}${post.data.heroImage}` : null;
			return {
				title: post.data.title,
				pubDate: post.data.pubDate,
				description: post.data.description,
				link: `/blog/${post.slug}/`,
				customData: [
					post.data.author ? `<dc:creator>${post.data.author}</dc:creator>` : '',
					imageUrl ? `<enclosure url="${imageUrl}" type="image/webp" length="0"/>` : '',
				]
					.filter(Boolean)
					.join('\n'),
			};
		}),
	});
}
