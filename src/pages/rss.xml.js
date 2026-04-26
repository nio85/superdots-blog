import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { filterPublished } from '../lib/posts';
import { buildRssCustomData, postsToRssItems } from '../lib/rss';

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
			media: 'http://search.yahoo.com/mrss/',
		},
		customData: buildRssCustomData(siteUrl, lastBuildDate),
		items: postsToRssItems(sortedPosts, siteUrl),
	});
}
