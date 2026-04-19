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
      <img src="data:image/png;base64,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" width="40" height="40" alt="" style="display:inline-block;vertical-align:middle;border:0;">
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
    <p style="margin:28px 0 0;font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.5;color:#64748B;">
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
