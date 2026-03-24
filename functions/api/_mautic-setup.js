/**
 * POST /api/_mautic-setup
 * One-time endpoint to set up Mautic custom fields and segments.
 * Protected by a setup token passed as query param ?token=...
 * Uses the production Mautic credentials from CF Pages env.
 *
 * DELETE THIS FILE after running setup successfully.
 */

const SETUP_TOKEN = 'superdots-mautic-setup-2026';

export async function onRequestPost(context) {
	const { env, request } = context;
	const url = new URL(request.url);

	if (url.searchParams.get('token') !== SETUP_TOKEN) {
		return json({ error: 'Unauthorized' }, 401);
	}

	const { MAUTIC_API_URL, MAUTIC_USERNAME, MAUTIC_PASSWORD, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET } = env;
	if (!MAUTIC_API_URL || !MAUTIC_USERNAME || !MAUTIC_PASSWORD) {
		return json({ error: 'Mautic env vars not configured' }, 500);
	}

	const baseUrl = MAUTIC_API_URL.replace(/\/$/, '');

	function buildHeaders() {
		const headers = {
			'Authorization': 'Basic ' + btoa(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`),
			'Content-Type': 'application/json',
		};
		if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
			headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
			headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
		}
		return headers;
	}

	async function mauticApi(method, path, body) {
		const opts = { method, headers: buildHeaders() };
		if (body) opts.body = JSON.stringify(body);
		const res = await fetch(`${baseUrl}${path}`, opts);
		const text = await res.text();
		let data;
		try { data = JSON.parse(text); } catch { data = text; }
		return { ok: res.ok, status: res.status, data };
	}

	const CUSTOM_FIELDS = [
		{
			alias: 'consent_status',
			label: 'Consent Status',
			type: 'select',
			properties: { list: [{ label: 'Pending', value: 'pending' }, { label: 'Confirmed', value: 'confirmed' }] },
			group: 'core',
			object: 'lead',
		},
		{ alias: 'signup_source', label: 'Signup Source', type: 'text', group: 'core', object: 'lead' },
		{ alias: 'signup_ip', label: 'Signup IP', type: 'text', group: 'core', object: 'lead' },
		{ alias: 'signup_timestamp', label: 'Signup Timestamp', type: 'datetime', group: 'core', object: 'lead' },
		{ alias: 'confirmed_at', label: 'Confirmed At', type: 'datetime', group: 'core', object: 'lead' },
		{ alias: 'confirmed_ip', label: 'Confirmed IP', type: 'text', group: 'core', object: 'lead' },
	];

	const SEGMENTS = [
		{
			name: 'Confirmed Subscribers',
			alias: 'confirmed-subscribers',
			isPublished: true,
			filters: [{ glue: 'and', field: 'consent_status', object: 'lead', type: 'select', operator: '=', filter: 'confirmed' }],
		},
		{
			name: 'Pending Confirmation',
			alias: 'pending-confirmation',
			isPublished: true,
			filters: [{ glue: 'and', field: 'consent_status', object: 'lead', type: 'select', operator: '=', filter: 'pending' }],
		},
	];

	const results = { fields: [], segments: [], errors: [] };

	// Test connectivity
	const ping = await mauticApi('GET', '/api/contacts?limit=1');
	if (!ping.ok) {
		return json({ error: 'Cannot connect to Mautic API', details: ping.data }, 502);
	}

	// Create fields
	for (const field of CUSTOM_FIELDS) {
		const res = await mauticApi('POST', '/api/fields/contact/new', field);
		if (res.ok) {
			results.fields.push({ alias: field.alias, status: 'created' });
		} else if (res.status === 400 && JSON.stringify(res.data).includes('already')) {
			results.fields.push({ alias: field.alias, status: 'exists' });
		} else {
			results.fields.push({ alias: field.alias, status: 'error', detail: res.data });
			results.errors.push(`Field ${field.alias}: ${JSON.stringify(res.data)}`);
		}
	}

	// Create segments (after fields exist)
	for (const segment of SEGMENTS) {
		const res = await mauticApi('POST', '/api/segments/new', segment);
		if (res.ok) {
			results.segments.push({ name: segment.name, status: 'created' });
		} else if (JSON.stringify(res.data).includes('already')) {
			results.segments.push({ name: segment.name, status: 'exists' });
		} else {
			results.segments.push({ name: segment.name, status: 'error', detail: res.data });
			results.errors.push(`Segment ${segment.name}: ${JSON.stringify(res.data)}`);
		}
	}

	return json({
		success: results.errors.length === 0,
		results,
		fieldMapping: {
			'Resend data.source': 'signup_source',
			'Resend data.signup_ip': 'signup_ip',
			'Resend data.signup_timestamp': 'signup_timestamp',
			'Resend data.consent_pending': 'consent_status (pending/confirmed)',
			'Resend data.confirmed_at': 'confirmed_at',
			'Resend data.confirmed_ip': 'confirmed_ip',
		},
	});
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
