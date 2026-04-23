/**
 * GET /api/confirm?email=...&ts=...&token=...
 * Verifies the HMAC token and confirms the subscriber in Mautic (single source of truth).
 * Env vars: NEWSLETTER_SECRET, RESEND_API_KEY,
 *           MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD,
 *           CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET (optional, for CF Access)
 */

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function onRequestGet(context) {
	const { env, request } = context;
	const { NEWSLETTER_SECRET, MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD } = env;

	if (!NEWSLETTER_SECRET || !MAUTIC_API_URL || !MAUTIC_USERNAME || !MAUTIC_PASSWORD) {
		return errorPage('Server misconfigured. Please try again later.');
	}

	const url = new URL(request.url);
	const email = (url.searchParams.get('email') || '').trim().toLowerCase();
	const ts = Number.parseInt(url.searchParams.get('ts') || '0', 10);
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

	// Update contact in Mautic: set consent_status to confirmed
	const mauticBase = MAUTIC_API_URL.replace(/\/$/, '');
	const mauticHeaders = {
		Authorization: 'Basic ' + btoa(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`),
		'Content-Type': 'application/json',
	};
	if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
		mauticHeaders['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
		mauticHeaders['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
	}

	const clientIp = request.headers.get('CF-Connecting-IP') || '';

	// Use /api/contacts/new which creates or updates by email (Mautic upsert behavior)
	const mauticRes = await fetch(`${mauticBase}/api/contacts/new`, {
		method: 'POST',
		headers: mauticHeaders,
		body: JSON.stringify({
			email,
			consent_status: 'confirmed',
			confirmed_at: new Date().toISOString(),
			confirmed_ip: clientIp,
			tags: ['newsletter', 'double-opt-in', '-newsletter-pending'],
			ipAddress: clientIp,
		}),
	});

	if (!mauticRes.ok) {
		console.error('Mautic confirm error:', await mauticRes.text());
		return errorPage('Something went wrong confirming your subscription. Please try again.');
	}

	const mauticData = await mauticRes.json();
	const contactId = mauticData.contact?.id;

	// Explicitly remove newsletter-pending tag (upsert `-tag` syntax is unreliable in Mautic)
	if (contactId) {
		try {
			const tagPatchRes = await fetch(`${mauticBase}/api/contacts/${contactId}/edit`, {
				method: 'PATCH',
				headers: mauticHeaders,
				body: JSON.stringify({ tags: ['-newsletter-pending'] }),
			});
			if (!tagPatchRes.ok) {
				console.error('Tag removal error:', await tagPatchRes.text());
			}
		} catch (tagErr) {
			console.error('Tag removal failed:', tagErr);
		}
	}

	// Remove DNC so the confirmed contact can receive emails
	if (contactId) {
		try {
			const dncRes = await fetch(`${mauticBase}/api/contacts/${contactId}/dnc/email/remove`, {
				method: 'POST',
				headers: mauticHeaders,
			});
			if (!dncRes.ok) {
				console.error('DNC remove error:', await dncRes.text());
				return errorPage('Something went wrong confirming your subscription. Please try again.');
			}
		} catch (err) {
			console.error('DNC remove failed:', err);
			return errorPage('Something went wrong confirming your subscription. Please try again.');
		}

		// GDPR audit trail: log confirmation note on the contact
		const noteText = `Double opt-in confirmed. IP: ${clientIp}. Timestamp: ${new Date().toISOString()}. Consent status: confirmed.`;
		try {
			const noteRes = await fetch(`${mauticBase}/api/notes/new`, {
				method: 'POST',
				headers: mauticHeaders,
				body: JSON.stringify({ lead: contactId, type: 'general', text: noteText }),
			});
			if (!noteRes.ok) {
				console.error('Mautic note error (confirm):', await noteRes.text());
			}
		} catch (noteErr) {
			console.error('Mautic note failed (confirm):', noteErr);
		}
	}

	// Send welcome email with lead magnet download link
	if (env.RESEND_API_KEY) {
		try {
			const welcomeRes = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.RESEND_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					from: 'Superdots <newsletter@superdots.sh>',
					to: [email],
					subject: "Welcome to Superdots — here's your AI Tools Cheatsheet",
					html: welcomeEmailHtml(),
				}),
			});
			if (!welcomeRes.ok) {
				console.error('Welcome email error:', await welcomeRes.text());
			}
		} catch (welcomeErr) {
			console.error('Welcome email failed:', welcomeErr);
		}
	}

	// Reddit Conversions API: report newsletter confirmation as Lead event
	if (env.REDDIT_PIXEL_ID && env.REDDIT_CONVERSION_TOKEN) {
		try {
			await fetch('https://ads-api.reddit.com/api/v2/conversions/events/' + env.REDDIT_PIXEL_ID, {
				method: 'POST',
				headers: {
					Authorization: 'Bearer ' + env.REDDIT_CONVERSION_TOKEN,
					'Content-Type': 'application/json',
				},
				body: await (async () => {
					const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim()));
					const emailHash = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
					return JSON.stringify({
						test_mode: false,
						events: [
							{
								event_at: new Date().toISOString(),
								event_type: { tracking_type: 'Lead' },
								user: { email: emailHash },
								event_metadata: { currency: 'EUR', value_decimal: 0 },
							},
						],
					});
				})(),
			});
		} catch (e) {
			console.error('Reddit CAPI error:', e);
		}
	}

	return successPage();
}

// --- Helpers ---

function welcomeEmailHtml() {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">
<div style="background:#fff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<div style="width:10px;height:10px;background:#E8363B;border-radius:50%;margin-bottom:20px;"></div>
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0B1222;letter-spacing:-0.02em;">Welcome to Superdots.</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563;">You're confirmed. Every Tuesday, you'll get one practical AI workflow — specific tools, step-by-step setup, honest tradeoffs.</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;margin-bottom:24px;">
<p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Your free download</p>
<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0B1222;">The AI Tools Evaluation Checklist</p>
<a href="https://superdots.sh/downloads/ai-tools-cheatsheet.pdf" style="display:inline-block;background:#0B1222;color:#fff;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Download PDF</a>
</div>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">While you wait for Tuesday, browse our latest guides:</p>
<a href="https://superdots.sh/blog/" style="display:inline-block;color:#E8363B;font-size:15px;font-weight:600;text-decoration:none;">Browse articles →</a>
</div>
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">You signed up at superdots.sh. <a href="https://superdots.sh/privacy#newsletter" style="color:#9ca3af;">Privacy</a>.</p>
</div>
</body>
</html>`;
}

async function createToken(email, timestamp, action, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
	]);
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
		"You're in!",
		'Your subscription is confirmed. Check your inbox for a welcome email with your free AI Tools Cheatsheet.',
		true
	);
}

function errorPage(message) {
	return page('Subscription Error', 'Oops', message, false);
}
