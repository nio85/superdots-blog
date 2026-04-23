/**
 * GET /api/unsubscribe?email=...&token=...
 * One-click unsubscribe. Verifies HMAC token and hard-deletes subscriber from Mautic
 * (GDPR Art. 17 — right to erasure). Mautic is the single source of truth for contacts.
 * Also handles POST for List-Unsubscribe-Post (RFC 8058).
 * Env vars: NEWSLETTER_SECRET,
 *           MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD,
 *           CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET (optional, for CF Access)
 */

export async function onRequestGet(context) {
	return handleUnsubscribe(context);
}

export async function onRequestPost(context) {
	return handleUnsubscribe(context);
}

async function handleUnsubscribe(context) {
	const { env, request } = context;
	const { NEWSLETTER_SECRET, MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD } = env;

	if (!NEWSLETTER_SECRET || !MAUTIC_API_URL || !MAUTIC_USERNAME || !MAUTIC_PASSWORD) {
		return errorPage('Server misconfigured. Please try again later.');
	}

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

	// Delete contact from Mautic (GDPR Art. 17 — right to erasure)
	const mauticBase = MAUTIC_API_URL.replace(/\/$/, '');
	const mauticHeaders = {
		Authorization: 'Basic ' + btoa(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`),
	};
	if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
		mauticHeaders['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
		mauticHeaders['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
	}

	// Find contact by email
	const searchRes = await fetch(`${mauticBase}/api/contacts?search=email:${encodeURIComponent(email)}&limit=1`, {
		headers: mauticHeaders,
	});

	if (!searchRes.ok) {
		console.error('Mautic search error:', await searchRes.text());
		return errorPage('Something went wrong. Please try again or contact us.');
	}

	const searchData = await searchRes.json();
	const contacts = searchData.contacts || {};
	const contactId = Object.keys(contacts)[0];

	if (contactId) {
		// GDPR audit trail: log unsubscribe note BEFORE deleting the contact
		const noteText = `Unsubscribe requested. Contact and engagement history will be hard-deleted (GDPR Art. 17).`;
		try {
			const noteRes = await fetch(`${mauticBase}/api/notes/new`, {
				method: 'POST',
				headers: { ...mauticHeaders, 'Content-Type': 'application/json' },
				body: JSON.stringify({ lead: contactId, type: 'general', text: noteText }),
			});
			if (!noteRes.ok) {
				console.error('Mautic note error (unsubscribe):', await noteRes.text());
			}
		} catch (noteErr) {
			console.error('Mautic note failed (unsubscribe):', noteErr);
		}

		// Hard delete the contact (not just unsubscribe — GDPR Art. 17)
		const deleteRes = await fetch(`${mauticBase}/api/contacts/${contactId}/delete`, {
			method: 'DELETE',
			headers: mauticHeaders,
		});
		if (!deleteRes.ok && deleteRes.status !== 404) {
			console.error('Mautic delete error:', await deleteRes.text());
			return errorPage('Something went wrong. Please try again or contact us.');
		}
	}
	// If contactId is null, contact was already deleted — show success

	return successPage();
}

// --- Helpers ---

async function createToken(email, action, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
	]);
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
		"You've been unsubscribed",
		"You won't receive any more emails from us. If this was a mistake, you can always subscribe again.",
		true
	);
}

function errorPage(message) {
	return page('Unsubscribe Error', 'Oops', message, false);
}
