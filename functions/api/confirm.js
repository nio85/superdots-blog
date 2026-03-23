/**
 * GET /api/confirm?email=...&ts=...&token=...
 * Verifies the HMAC token and activates the subscriber in Resend.
 * Also syncs the confirmed contact to Mautic for campaign management.
 * Env vars: RESEND_API_KEY, NEWSLETTER_SECRET, RESEND_AUDIENCE_ID,
 *           MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD
 */

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function onRequestGet(context) {
	const { env, request } = context;
	const { RESEND_API_KEY, NEWSLETTER_SECRET, RESEND_AUDIENCE_ID } = env;

	if (!RESEND_API_KEY || !NEWSLETTER_SECRET || !RESEND_AUDIENCE_ID) {
		return errorPage('Server misconfigured. Please try again later.');
	}

	const url = new URL(request.url);
	const email = (url.searchParams.get('email') || '').trim().toLowerCase();
	const ts = parseInt(url.searchParams.get('ts') || '0', 10);
	const token = url.searchParams.get('token') || '';

	if (!email || !ts || !token) {
		return errorPage('Invalid confirmation link.');
	}

	// Check expiry
	if (Date.now() - ts > TOKEN_MAX_AGE_MS) {
		return errorPage('This confirmation link has expired. Please subscribe again.');
	}

	// Verify HMAC
	const expected = await createToken(email, ts, 'confirm', NEWSLETTER_SECRET);
	if (token !== expected) {
		return errorPage('Invalid confirmation link.');
	}

	// Update contact in Resend to subscribed
	const res = await fetch(`https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`, {
		method: 'PATCH',
		headers: {
			'Authorization': `Bearer ${RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			unsubscribed: false,
			data: {
				consent_pending: 'false',
				confirmed_at: new Date().toISOString(),
				confirmed_ip: request.headers.get('CF-Connecting-IP') || 'unknown',
			},
		}),
	});

	if (!res.ok) {
		console.error('Resend update error:', await res.text());
		return errorPage('Something went wrong. Please try again.');
	}

	// Sync confirmed contact to Mautic for campaign management
	const { MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD } = env;
	if (MAUTIC_API_URL && MAUTIC_USERNAME && MAUTIC_PASSWORD) {
		try {
			const mauticRes = await fetch(`${MAUTIC_API_URL}/api/contacts/new`, {
				method: 'POST',
				headers: {
					'Authorization': 'Basic ' + btoa(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`),
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email,
					tags: ['newsletter', 'double-opt-in'],
					ipAddress: request.headers.get('CF-Connecting-IP') || '',
				}),
			});
			if (!mauticRes.ok) {
				console.error('Mautic sync error:', await mauticRes.text());
			}
		} catch (err) {
			console.error('Mautic sync failed:', err.message);
		}
	}

	return successPage();
}

// --- Helpers ---

async function createToken(email, timestamp, action, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const data = encoder.encode(`${email}:${timestamp}:${action}`);
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
		'Subscription Confirmed',
		'You\'re in!',
		'Your subscription is confirmed. You\'ll receive our weekly digest with the best AI-at-work articles.',
		true
	);
}

function errorPage(message) {
	return page('Subscription Error', 'Oops', message, false);
}
