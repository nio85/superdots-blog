/**
 * Cloudflare Pages middleware: 301 trailing-slash redirect.
 *
 * CF Pages auto-redirects /path → /path/ with 308, but Google treats 301
 * as a stronger canonical signal. This middleware fires before the built-in
 * 308, converting it to a 301 for non-file paths.
 */
export async function onRequest(context) {
	const url = new URL(context.request.url);
	const path = url.pathname;

	// /404: serve the 404 page directly with 404 status to prevent redirect loop
	if (path === '/404' || path === '/404/') {
		const res = await context.env.ASSETS.fetch(new URL('/404.html', url.origin));
		return new Response(res.body, { status: 404, headers: res.headers });
	}

	// Skip: root, already has trailing slash, file extensions, or API routes
	if (path === '/' || path.endsWith('/') || /\.\w{1,10}$/.test(path) || path.startsWith('/api/')) {
		return context.next();
	}

	url.pathname = path + '/';
	return new Response(null, {
		status: 301,
		headers: { Location: url.pathname + url.search },
	});
}
