/**
 * GET /api/unsubscribe?email=...&token=...
 * One-click unsubscribe. Verifies HMAC token and removes subscriber from Resend audience.
 * Also handles POST for List-Unsubscribe-Post (RFC 8058).
 * Env vars: RESEND_API_KEY, NEWSLETTER_SECRET, RESEND_AUDIENCE_ID
 */

export async function onRequestGet(context) {
	return handleUnsubscribe(context);
}

export async function onRequestPost(context) {
	return handleUnsubscribe(context);
}

async function handleUnsubscribe(context) {
	const { env, request } = context;
	const { RESEND_API_KEY, NEWSLETTER_SECRET, RESEND_AUDIENCE_ID } = env;

	const url = new URL(request.url);
	const email = (url.searchParams.get('email') || '').trim().toLowerCase();
	const token = url.searchParams.get('token') || '';

	if (!email || !token) {
		return errorPage('Invalid unsubscribe link.');
	}

	// Verify HMAC (unsubscribe tokens don't expire)
	const expected = await createToken(email, 'unsubscribe', NEWSLETTER_SECRET);
	if (token !== expected) {
		return errorPage('Invalid unsubscribe link.');
	}

	// Delete contact from Resend audience (GDPR Art. 17 — right to erasure)
	// Privacy policy §6 commits to deletion within 30 days; immediate deletion exceeds that.
	const res = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${RESEND_API_KEY}`,
		},
	});

	if (!res.ok && res.status !== 404) {
		console.error('Resend contact deletion error:', await res.text());
		return errorPage('Something went wrong. Please try again or contact us.');
	}

	return successPage();
}

// --- Helpers ---

async function createToken(email, action, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const data = encoder.encode(`${email}:${action}`);
	const sig = await crypto.subtle.sign('HMAC', key, data);
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function page(title, heading, message, isSuccess) {
	const color = isSuccess ? '#14B8A6' : '#E8363B';
	return new Response(
		`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Superdots</title>
<style>
  body{margin:0;padding:40px 20px;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;}
  .card{max-width:480px;background:#fff;border-radius:12px;padding:48px 40px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
  .dot{display:inline-block;width:12px;height:12px;background:${color};border-radius:50%;margin-bottom:16px;}
  h1{margin:0 0 12px;font-size:24px;font-weight:700;color:#0B1222;letter-spacing:-0.02em;}
  p{margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;}
  a.btn{display:inline-block;background:#0B1222;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;}
  a.btn:hover{background:#1a2436;}
</style>
</head>
<body>
<div class="card">
  <div class="dot"></div>
  <h1>${heading}</h1>
  <p>${message}</p>
  <a class="btn" href="https://superdots.sh/blog/">Browse articles</a>
</div>
</body>
</html>`,
		{ status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
	);
}

function successPage() {
	return page(
		'Unsubscribed',
		'You\'ve been unsubscribed',
		'You won\'t receive any more emails from us. If this was a mistake, you can always subscribe again.',
		true
	);
}

function errorPage(message) {
	return page('Unsubscribe Error', 'Oops', message, false);
}
