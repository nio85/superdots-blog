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

	// Skip: root, already has trailing slash, file extensions, API routes, or /404
	if (path === '/' || path === '/404' || path.endsWith('/') || /\.\w{1,10}$/.test(path) || path.startsWith('/api/')) {
		return context.next();
	}

	url.pathname = path + '/';
	return new Response(null, {
		status: 301,
		headers: { Location: url.pathname + url.search },
	});
}
