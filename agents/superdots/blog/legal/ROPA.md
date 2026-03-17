# Record of Processing Activities (ROPA)

**Controller:** Superdots (superdots.sh)
**Contact:** privacy@superdots.sh
**Date created:** 17 March 2026
**Last reviewed:** 17 March 2026

Required under Art. 30 GDPR. This document records all personal data processing activities carried out by Superdots in connection with the blog at superdots.sh.

---

## 1. Newsletter Operations

| Field | Details |
|-------|---------|
| **Processing activity** | Newsletter subscription and email delivery |
| **Purpose** | Send subscribers weekly editorial content about AI at work |
| **Legal basis** | Consent — Art. 6(1)(a) GDPR, confirmed via double opt-in |
| **Data subjects** | Newsletter subscribers (EU/EEA and international visitors) |
| **Categories of personal data** | Email address, IP address (at signup and confirmation), signup timestamp, confirmation timestamp, email engagement data (opens, clicks) |
| **Source of data** | Collected directly from data subjects via subscription form on superdots.sh |
| **Recipients / processors** | Resend (Plus Five Five, Inc.) — email delivery processor |
| **International transfers** | USA — Resend is a US-based processor. Transfer safeguards: EU Standard Contractual Clauses (SCCs) incorporated in Resend DPA, EU-US Data Privacy Framework (self-certified by Resend) |
| **Retention period** | Email address: retained until unsubscribe, then deleted within 30 days. Transactional logs (delivery receipts): up to 30 days per Resend retention policy. Engagement data: retained by Resend per their data retention schedule |
| **Technical & organisational measures** | Double opt-in with HMAC-signed confirmation tokens (7-day expiry); HTTPS/TLS encryption in transit; Resend SOC 2 Type II and ISO 27001 certified; one-click unsubscribe in every email; access restricted to Resend API key holders |
| **Data processor agreement** | Resend DPA: https://resend.com/legal/dpa (accepted via Resend Terms of Service) |

---

## 2. Website Analytics

| Field | Details |
|-------|---------|
| **Processing activity** | Traffic analytics via Google Analytics 4 |
| **Purpose** | Understand content performance and improve the Site |
| **Legal basis** | Consent — Art. 6(1)(a) GDPR (analytics cookies loaded only after user consent via cookie banner) |
| **Data subjects** | Website visitors who consent to analytics |
| **Categories of personal data** | Pseudonymised usage data (page views, referrer, device type), IP address (anonymised by default in GA4) |
| **Source of data** | Collected automatically from consenting visitors |
| **Recipients / processors** | Google LLC — analytics processor |
| **International transfers** | USA — Google. Transfer safeguards: SCCs, EU-US Data Privacy Framework (Google is DPF-certified) |
| **Retention period** | 14 months (GA4 default), then automatically deleted |
| **Technical & organisational measures** | IP anonymisation enabled by default; consent-gated loading (no tracking without opt-in); Google SOC 2 and ISO 27001 certified |
| **Data processor agreement** | Google Ads Data Processing Terms: https://privacy.google.com/businesses/processorterms/ |

---

## 3. Website Hosting & Security

| Field | Details |
|-------|---------|
| **Processing activity** | Website hosting, CDN delivery, DDoS protection |
| **Purpose** | Serve web pages and protect against abuse |
| **Legal basis** | Legitimate interest — Art. 6(1)(f) GDPR (necessary for website operation and security) |
| **Data subjects** | All website visitors |
| **Categories of personal data** | IP address, request metadata (URL, user agent, headers) |
| **Source of data** | Collected automatically from HTTP requests |
| **Recipients / processors** | Cloudflare, Inc. — hosting and security processor |
| **International transfers** | USA / global CDN — Cloudflare. Transfer safeguards: SCCs incorporated in Cloudflare DPA, EU-US Data Privacy Framework (Cloudflare is DPF-certified) |
| **Retention period** | Edge logs: ~72 hours (Cloudflare standard retention) |
| **Technical & organisational measures** | Encrypted transit (HTTPS/TLS); bot management (`__cf_bm` cookie — strictly necessary, no consent required per Art. 5(3) ePrivacy Directive); Cloudflare SOC 2 Type II certified |
| **Data processor agreement** | Cloudflare DPA: https://www.cloudflare.com/cloudflare-customer-dpa/ |

---

## 4. Web Fonts

| Field | Details |
|-------|---------|
| **Processing activity** | Loading web fonts from Google Fonts |
| **Purpose** | Display typography on the website |
| **Legal basis** | Legitimate interest — Art. 6(1)(f) GDPR (standard web functionality). Note: self-hosting fonts would eliminate this processing activity entirely |
| **Data subjects** | All website visitors |
| **Categories of personal data** | IP address, HTTP headers sent with font requests |
| **Source of data** | Collected automatically when fonts are loaded |
| **Recipients / processors** | Google LLC |
| **International transfers** | USA — Google. Transfer safeguards: SCCs, EU-US Data Privacy Framework |
| **Retention period** | Google does not store personal data from font requests beyond standard server log retention |
| **Technical & organisational measures** | HTTPS delivery; no cookies set by Google Fonts |

---

## Review Schedule

This ROPA is reviewed quarterly, or whenever a new processing activity is introduced. Next review due: **June 2026**.
