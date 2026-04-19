/**
 * POST /api/subscribe
 * Accepts { email, source } and sends a double opt-in confirmation email via Resend.
 * Contacts are stored in Mautic (single source of truth). Resend is used only for email delivery.
 * Env vars: RESEND_API_KEY, NEWSLETTER_SECRET,
 *           MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD,
 *           CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET (optional, for CF Access)
 */

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
	const { env, request } = context;
	const { RESEND_API_KEY, NEWSLETTER_SECRET, MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD } = env;

	if (!RESEND_API_KEY || !NEWSLETTER_SECRET || !MAUTIC_API_URL || !MAUTIC_USERNAME || !MAUTIC_PASSWORD) {
		return json({ error: 'Server misconfigured' }, 500);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, 400);
	}

	const email = (body.email || '').trim().toLowerCase();
	if (!email || !isValidEmail(email)) {
		return json({ error: 'Invalid email address' }, 400);
	}

	const source = body.source || 'unknown';
	const timestamp = Date.now();
	const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

	// Create HMAC token for confirmation link
	const token = await createToken(email, timestamp, 'confirm', NEWSLETTER_SECRET);
	const siteUrl = 'https://superdots.sh';
	const confirmUrl = `${siteUrl}/api/confirm?email=${encodeURIComponent(email)}&ts=${timestamp}&token=${token}`;

	// Create contact in Mautic with pending consent status
	const mauticHeaders = {
		'Authorization': 'Basic ' + btoa(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`),
		'Content-Type': 'application/json',
	};
	if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
		mauticHeaders['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
		mauticHeaders['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
	}

	const mauticRes = await fetch(`${MAUTIC_API_URL.replace(/\/$/, '')}/api/contacts/new`, {
		method: 'POST',
		headers: mauticHeaders,
		body: JSON.stringify({
			email,
			consent_status: 'pending',
			signup_source: source,
			signup_ip: clientIp,
			signup_timestamp: new Date(timestamp).toISOString(),
			tags: ['newsletter-pending'],
			ipAddress: clientIp,
		}),
	});

	if (!mauticRes.ok) {
		const err = await mauticRes.text();
		console.error('Mautic contact error:', err);
		return json({ error: 'Failed to process subscription' }, 500);
	}

	// Add DNC so pending contacts cannot receive campaign emails
	const mauticData = await mauticRes.json();
	const contactId = mauticData.contact?.id;
	if (contactId) {
		try {
			const dncRes = await fetch(`${MAUTIC_API_URL.replace(/\/$/, '')}/api/contacts/${contactId}/dnc/email/add`, {
				method: 'POST',
				headers: mauticHeaders,
				body: JSON.stringify({ reason: 3, comments: 'Pending double opt-in confirmation' }),
			});
			if (!dncRes.ok) {
				console.error('DNC add error:', await dncRes.text());
			}
		} catch (err) {
			console.error('DNC add failed:', err);
		}

		// GDPR audit trail: log consent note on the contact
		const noteText = `Newsletter signup. Source: ${source}. IP: ${clientIp}. Timestamp: ${new Date(timestamp).toISOString()}. Consent text: 'Subscribe to receive new articles, curated links, and practical AI guides. Max 1 email/week. Unsubscribe anytime.'`;
		try {
			const noteRes = await fetch(`${MAUTIC_API_URL.replace(/\/$/, '')}/api/notes/new`, {
				method: 'POST',
				headers: mauticHeaders,
				body: JSON.stringify({ lead: contactId, type: 'general', text: noteText }),
			});
			if (!noteRes.ok) {
				console.error('Mautic note error (subscribe):', await noteRes.text());
			}
		} catch (noteErr) {
			console.error('Mautic note failed (subscribe):', noteErr);
		}
	}

	// Send confirmation email via Resend (email delivery only)
	const emailRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: 'Superdots <newsletter@superdots.sh>',
			to: [email],
			subject: 'Confirm your Superdots subscription',
			html: confirmationEmailHtml(confirmUrl),
			text: confirmationEmailText(confirmUrl),
		}),
	});

	if (!emailRes.ok) {
		const err = await emailRes.text();
		console.error('Resend email error:', err);
		return json({ error: 'Failed to send confirmation email' }, 500);
	}

	return json({ ok: true, message: 'Check your inbox to confirm your subscription.' });
}

// --- Helpers ---

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

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
	return bufferToHex(sig);
}

function bufferToHex(buffer) {
	return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function confirmationEmailHtml(confirmUrl) {
	return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style type="text/css">
    #outlook a { padding:0; }
    body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
    table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
    img { border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080E1A;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#080E1A;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background-color:#0B1222;padding:20px 24px;border-radius:12px 12px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="vertical-align:middle;">
      <img src="https://superdots.sh/brand/superdots-logo-300x300-dark.png" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border:0;">
      <span style="font-family:'Space Grotesk',Arial,sans-serif;font-size:20px;font-weight:700;color:#FFFFFF;vertical-align:middle;margin-left:8px;letter-spacing:-0.01em;">superdots</span>
    </td></tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background-color:#0F172A;padding:40px 40px 32px;">
    <h1 style="margin:0 0 12px;font-family:'Space Grotesk',Arial,sans-serif;font-size:26px;font-weight:700;color:#F1F5F9;letter-spacing:-0.02em;line-height:1.2;">
      Confirm your subscription<span style="color:#E8363B;">.</span>
    </h1>
    <p style="margin:0 0 28px;font-family:'Inter',Arial,sans-serif;font-size:16px;line-height:1.6;color:#94A3B8;">
      You signed up for the Superdots newsletter — practical AI for every team. One click to confirm:
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="border-radius:8px;background-color:#E8363B;">
      <a href="${confirmUrl}" style="display:inline-block;background:#E8363B;color:#ffffff;font-family:'Space Grotesk',Arial,sans-serif;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Confirm subscription
      </a>
    </td></tr>
    </table>
    <p style="margin:28px 0 0;font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.5;color:#475569;">
      If you didn't sign up, you can safely ignore this email. You won't receive anything else.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background-color:#0F172A;padding:24px 40px;border-radius:0 0 12px 12px;">
    <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:1.6;color:#64748B;text-align:center;">
      <strong style="color:#94A3B8;">Superdots</strong> &mdash; Practical AI for every team.<br>
      <a href="https://superdots.sh" style="color:#64748B;">superdots.sh</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function confirmationEmailText(confirmUrl) {
	return `Confirm your Superdots subscription

You signed up for the Superdots newsletter. Visit this link to confirm:

${confirmUrl}

If you didn't sign up, you can safely ignore this email.

— Superdots (superdots.sh)`;
}
