---
title: "Cookie Policy | Superdots"
description: "Cookie policy for superdots.sh — what cookies we use and why."
pageTitle: "Cookie Policy"
lastUpdated: "24 April 2026"
---

## What are cookies?

Cookies are small text files stored on your device by your browser. We also use localStorage, a similar browser storage mechanism. This policy covers both.

## Consent categories

We divide cookies into three categories. When you visit the Site, a banner lets you choose which categories to allow:

| Category | Consent required | What it controls |
|---|---|---|
| **Necessary** | No — always active | Core site functionality (theme, consent record, bot protection) |
| **Analytics** | Yes — opt-in | Google Analytics 4, Microsoft Clarity, Umami Session Replays |
| **Marketing** | Yes — opt-in | Reddit Pixel and Meta Pixel (ad conversion tracking and retargeting) |

Your choices are stored in your browser's localStorage and respected on every visit. You can change them at any time via the "Cookie settings" link in the footer.

## Cookies we use

### Necessary (always active — no consent required)

These are essential for the Site to function correctly. Under Art. 5(3) of the ePrivacy Directive (2002/58/EC) and the Garante's cookie guidelines (Provvedimento n. 229/2021), strictly necessary cookies do not require consent.

<table>
	<thead>
		<tr>
			<th>Name</th>
			<th>Provider</th>
			<th>Purpose</th>
			<th>Type</th>
			<th>Duration</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td><code>sd-theme</code></td>
			<td>superdots.sh</td>
			<td>Stores your light/dark mode preference so the site renders correctly</td>
			<td>localStorage</td>
			<td>Until cleared</td>
		</tr>
		<tr>
			<td><code>sd-consent-v2</code></td>
			<td>superdots.sh</td>
			<td>Stores your cookie consent record as a JSON object containing: version, timestamp, expiry date, and per-category choices (analytics: true/false, marketing: true/false). Updated whenever you change your preferences.</td>
			<td>localStorage</td>
			<td>6 months (auto-expires)</td>
		</tr>
		<tr>
			<td><code>__cf_bm</code></td>
			<td>Cloudflare</td>
			<td>Bot management — distinguishes humans from automated traffic. Set by Cloudflare as part of the content delivery network that powers this site.</td>
			<td>HTTP cookie</td>
			<td>30 minutes</td>
		</tr>
	</tbody>
</table>

### Cookie-free analytics (no consent required)

**Umami Analytics** is a privacy-friendly, self-hosted analytics tool that **does not use cookies**, does not store IP addresses, and does not collect any personal data. Because Umami does not access or store information on your device, no consent is required under Art. 5(3) of the ePrivacy Directive. The legal basis for this processing is legitimate interest (Art. 6(1)(f) GDPR).

Umami collects only aggregated, anonymous metrics: page URL, referrer, browser type, operating system, device type, and country (derived from IP at request time, IP not stored). It is hosted on Superdots infrastructure in the EU — no data is sent to third parties.

**Umami Session Replays** (consent-gated) — when you give analytics consent, we may also record an anonymised replay of your browsing session (clicks, scrolls, page navigation). Form inputs and sensitive text are automatically masked. Recordings are stored on our self-hosted infrastructure (EU) and automatically deleted after 30 days. No personal data is extracted from replays. This feature requires your explicit analytics consent.

### Analytics (consent required — opt-in)

These cookies are set by Google Analytics 4 and Microsoft Clarity to help us understand how visitors use the Site. They are only activated **after you give explicit consent** via the cookie banner, as required by Art. 5(3) ePrivacy Directive and Art. 6(1)(a) GDPR. If you decline or do not choose, these cookies are never set.

<table>
	<thead>
		<tr>
			<th>Name</th>
			<th>Provider</th>
			<th>Purpose</th>
			<th>Type</th>
			<th>Duration</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td><code>_ga</code></td>
			<td>Google</td>
			<td>Distinguishes unique users by assigning a randomly generated ID</td>
			<td>HTTP cookie</td>
			<td>2 years</td>
		</tr>
		<tr>
			<td><code>_ga_DC2BTH9VKX</code></td>
			<td>Google</td>
			<td>Maintains session state for GA4 property G-DC2BTH9VKX</td>
			<td>HTTP cookie</td>
			<td>2 years</td>
		</tr>
		<tr>
			<td><code>_clck</code></td>
			<td>Microsoft Clarity</td>
			<td>Persists the Clarity user ID and preferences</td>
			<td>HTTP cookie</td>
			<td>1 year</td>
		</tr>
		<tr>
			<td><code>_clsk</code></td>
			<td>Microsoft Clarity</td>
			<td>Connects page views into a single Clarity session recording</td>
			<td>HTTP cookie</td>
			<td>1 day</td>
		</tr>
		<tr>
			<td><code>CLID</code></td>
			<td>Microsoft Clarity</td>
			<td>Identifies the first-time Clarity saw this user on any site</td>
			<td>HTTP cookie</td>
			<td>1 year</td>
		</tr>
	</tbody>
</table>

### Marketing (consent required — opt-in)

These cookies are used for ad conversion tracking and retargeting. They are only activated **after you give explicit consent** via the cookie banner, as required by Art. 5(3) ePrivacy Directive and Art. 6(1)(a) GDPR. If you decline or do not choose, these cookies are never set.

<table>
	<thead>
		<tr>
			<th>Name</th>
			<th>Provider</th>
			<th>Purpose</th>
			<th>Type</th>
			<th>Duration</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td><code>_rdt_uuid</code></td>
			<td>Reddit, Inc.</td>
			<td>Assigns a unique identifier to track ad conversions and measure the effectiveness of Reddit advertising campaigns</td>
			<td>HTTP cookie</td>
			<td>2 years</td>
		</tr>
		<tr>
			<td><code>rdt_uuid</code></td>
			<td>Reddit, Inc.</td>
			<td>Reddit UUID used for cross-site conversion tracking and retargeting audiences</td>
			<td>HTTP cookie</td>
			<td>2 years</td>
		</tr>
		<tr>
			<td><code>rdt_cid</code></td>
			<td>Reddit, Inc.</td>
			<td>Click ID that links a Reddit ad click to a site visit, enabling attribution of conversions to specific ad campaigns</td>
			<td>HTTP cookie</td>
			<td>Session</td>
		</tr>
	</tbody>
</table>

Reddit, Inc. is headquartered in the United States. Data is transferred to Reddit's US servers under Standard Contractual Clauses (SCCs) as the transfer mechanism. See [Reddit's privacy policy](https://www.reddit.com/policies/privacy-policy) and [Reddit Ads data processing terms](https://advertising.reddithelp.com/en/categories/reddit-ads-policies/reddit-advertising-platform-terms) for details.

### Meta Pixel cookies

<table>
	<thead>
		<tr>
			<th>Cookie name</th>
			<th>Provider</th>
			<th>Purpose</th>
			<th>Type</th>
			<th>Duration</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td><code>_fbp</code></td>
			<td>Meta Platforms, Inc.</td>
			<td>Identifies the browser for ad delivery and measurement across Facebook and Instagram campaigns</td>
			<td>HTTP cookie</td>
			<td>90 days</td>
		</tr>
		<tr>
			<td><code>_fbc</code></td>
			<td>Meta Platforms, Inc.</td>
			<td>Click ID that links a Facebook/Instagram ad click to a site visit, enabling conversion attribution</td>
			<td>HTTP cookie</td>
			<td>90 days</td>
		</tr>
	</tbody>
</table>

Meta Platforms, Inc. is headquartered in the United States. Data is transferred under the EU-U.S. Data Privacy Framework and Standard Contractual Clauses (SCCs). See [Meta's privacy policy](https://www.facebook.com/privacy/policy/) for details.

## Email tracking (newsletter subscribers only)

If you subscribe to our newsletter, our marketing automation system (Mautic, self-hosted in the EU) uses a **tracking pixel** (a tiny invisible image) to detect email opens, and **link rewriting** to measure which links you click. This is not a cookie — it operates within the email itself, not on the Site. Mautic associates this data with your email address to help us understand which content resonates.

This tracking is covered by the consent you give when subscribing to the newsletter (Art. 6(1)(a) GDPR). You can prevent open tracking by disabling remote image loading in your email client, or unsubscribe at any time to stop all tracking.

## Third-party requests

In addition to cookies, the Site makes requests to third-party servers that may process your IP address:

- **Umami Analytics** (`umami.bartoccini.cloud`) — base tracker loaded on all pages without consent (cookie-free, no PII). Session replay recorder loaded only after analytics consent. Self-hosted on Superdots infrastructure; no data leaves the EU.
- **Google Analytics** (`www.googletagmanager.com`) — only loaded after consent. Sends pseudonymised usage data to Google (servers in the US; EU–US Data Privacy Framework adequacy decision and Standard Contractual Clauses apply).
- **Microsoft Clarity** (`www.clarity.ms`) — only loaded after consent. Records anonymised heatmaps and session replays to help us improve site usability. [Clarity privacy info](https://learn.microsoft.com/en-us/clarity/setup-and-installation/cookie-consent).
- **Reddit Pixel** (`www.redditstatic.com`) — only loaded after marketing consent. Tracks ad conversions and enables retargeting on Reddit. Data is sent to Reddit, Inc. (US) under Standard Contractual Clauses.
- **Meta Pixel** (`connect.facebook.net`) — only loaded after marketing consent. Tracks ad conversions and enables retargeting and lookalike audiences on Facebook and Instagram. Data is sent to Meta Platforms, Inc. (US) under the EU-U.S. Data Privacy Framework and Standard Contractual Clauses.

## How to manage cookies

### Cookie consent modal

When you first visit the Site, a modal requires you to actively choose your cookie preferences before continuing. You have three options:

- **Accept All** — enables Necessary, Analytics, and Marketing cookies.
- **Reject All** — enables Necessary cookies only. Analytics (GA4, Clarity) are not loaded.
- **Customize** — opens a preferences panel where you can enable or disable each category individually.

You can change your choice at any time by clicking the **"Cookie settings"** link in the site footer.

**Why a non-dismissible modal?** Under Art. 5(3) of the ePrivacy Directive and the Garante's 2021 cookie guidelines (Provvedimento n. 229/2021), continued browsing cannot be treated as consent. The modal requires an affirmative act (clicking a button) before any optional cookies are placed — this is the legally required mechanism.

### Browser settings

You can also control cookies through your browser:

- [Chrome](https://support.google.com/chrome/answer/95647?hl=en)
- [Firefox](https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer)
- [Safari](https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac)
- [Edge](https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09)

To clear localStorage (used for theme preference and consent choices), use your browser's developer tools or "Clear site data" option. Clearing localStorage will reset your consent preferences and you will be shown the consent modal again on your next visit.

## Changes to this policy

We may update this policy when we add or remove cookies. The "Last updated" date at the top reflects the most recent revision. If we introduce new cookies that require consent, we will display the consent modal again so you can make a fresh choice.
