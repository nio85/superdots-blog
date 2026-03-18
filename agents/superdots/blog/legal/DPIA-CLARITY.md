# Data Protection Impact Assessment (DPIA)

## Microsoft Clarity — Session Recordings & Heatmaps

**Controller:** Superdots (superdots.sh)
**Contact:** privacy@superdots.sh
**Date created:** 18 March 2026
**Last reviewed:** 18 March 2026
**Status:** Complete
**Next review due:** September 2026

Required under Art. 35 GDPR. This DPIA is triggered by ROPA item 4 (Heatmaps & Session Recordings) and the recommendation in DPA-VERIFICATION.md for Microsoft Clarity.

---

## 1. Why this DPIA is required

Art. 35(1) GDPR requires a DPIA when processing is "likely to result in a high risk to the rights and freedoms of natural persons." This assessment is required because:

- **Art. 35(3)(c) GDPR** — systematic monitoring of a publicly accessible area: Clarity records user behaviour (clicks, scrolls, mouse movements, DOM snapshots) across the entire website.
- **Garante per la protezione dei dati personali, Provvedimento 11 October 2018** (list of processing operations requiring a DPIA) — large-scale systematic monitoring of individuals' behaviour, including via technologies that observe, monitor, or control data subjects' actions.
- **EDPB Guidelines on DPIA (WP 248 rev.01)** — criteria 3 (systematic monitoring) and 4 (sensitive/highly personal data — behavioural patterns) are met; two or more criteria trigger a DPIA.

---

## 2. Description of processing

### 2.1 What is processed

| Element | Detail |
|---------|--------|
| **Tool** | Microsoft Clarity (free analytics product by Microsoft Corporation) |
| **Clarity Project ID** | Set via `CLARITY_PROJECT_ID` constant in `src/consts.ts` |
| **Script source** | `https://www.clarity.ms/tag/{projectId}` |
| **Processing activities** | Session recordings (DOM replay), heatmaps (click, scroll, area), session metadata |
| **Data collected** | Pseudonymised interaction data: clicks, scrolls, mouse movements, DOM snapshots (page content as rendered), viewport dimensions, device/browser metadata, IP address (used by Microsoft for geolocation then discarded), referrer URL |
| **Cookies set** | `_clck` (1 year — user ID), `_clsk` (1 day — session stitching), `CLID` (1 year — first-seen timestamp) |
| **Processor** | Microsoft Corporation, One Microsoft Way, Redmond, WA 98052, USA |
| **Data location** | United States (Microsoft Azure infrastructure) |

### 2.2 How consent is obtained

- Clarity script is **not loaded** until the user clicks "Accept analytics" on the cookie banner.
- Consent mechanism: `CookieBanner.astro` stores `sd-cookie-consent=accepted` in localStorage. `BaseHead.astro` checks this value and calls `window.SD_startClarity()` only when consent is present.
- Google Consent Mode v2 defaults all consent signals to `denied` on page load.
- Users can withdraw consent at any time via the "Cookie settings" link in the footer, which clears the consent flag and requires a new affirmative action.
- **Legal basis for processing:** Consent — Art. 6(1)(a) GDPR, Art. 5(3) ePrivacy Directive (2002/58/EC).

### 2.3 Data flow

```
Visitor (browser)
  ├── Page load → No Clarity script loaded (consent default: denied)
  ├── Cookie banner displayed → User clicks "Accept analytics"
  │     ├── localStorage: sd-cookie-consent = "accepted"
  │     └── SD_startClarity() called
  ├── Clarity JS tag loaded from www.clarity.ms
  │     ├── Sets cookies: _clck, _clsk, CLID
  │     ├── Records: DOM mutations, clicks, scrolls, mouse movements
  │     └── Sends data to Microsoft Clarity servers (USA)
  └── Microsoft Clarity dashboard (accessed by Superdots team)
        ├── Session recordings (video-like DOM replay)
        ├── Heatmaps (click, scroll, area)
        └── Aggregated insights
```

### 2.4 Retention

- **Clarity session data:** 30 days (Microsoft default), then automatically deleted.
- **Cookies on user device:** `_clck` and `CLID` expire after 1 year; `_clsk` after 1 day.
- **Consent record:** `sd-cookie-consent-date` stored in localStorage indefinitely (user can clear anytime).

### 2.5 Scope and scale

- **Data subjects:** All visitors to superdots.sh who consent to analytics cookies.
- **Geographic scope:** Global (blog is publicly accessible); expected audience primarily EU/EEA and Italy.
- **Volume:** Blog traffic scale — estimated low thousands of sessions/month. Not large-scale processing in absolute terms, but systematic monitoring of all consenting visitors.

---

## 3. Necessity and proportionality assessment

### 3.1 Purpose limitation (Art. 5(1)(b))

Clarity is used solely to understand how visitors interact with pages — scroll depth, click patterns, navigation flow — to improve content layout and usability. It is **not** used for profiling, advertising, automated decision-making, or any purpose beyond UX improvement.

### 3.2 Data minimisation (Art. 5(1)(c))

- **Input masking:** Clarity provides built-in input masking that obscures text typed into form fields (e.g., newsletter email input). **Action required:** Verify in Clarity dashboard that masking mode is set to "Balanced" or "Strict" (not "Relaxed").
- **IP address:** Microsoft uses IP for approximate geolocation only; the raw IP is not stored in session recordings per Clarity documentation.
- **No personal identifiers:** Superdots does not pass any user identifiers, email addresses, or custom tags to Clarity.
- **DOM content:** Session recordings capture visible page content. Blog content is public, so the privacy risk of captured DOM content is low. The only sensitive element is the newsletter email input field, which is addressed by input masking.

### 3.3 Proportionality

| Factor | Assessment |
|--------|------------|
| **Is the processing necessary for the stated purpose?** | Yes — heatmaps and session recordings provide UX insights that page-view analytics alone cannot (e.g., where users stop scrolling, confusing click targets). |
| **Could the purpose be achieved with less data?** | Partially — aggregated heatmaps alone would reduce risk, but session recordings provide significantly more diagnostic value. The short retention period (30 days) mitigates the additional risk. |
| **Is the legal basis appropriate?** | Yes — consent is the correct basis for non-essential analytics under Art. 5(3) ePrivacy Directive and EDPB guidance. |
| **Is the processing proportionate to the purpose?** | Yes, given the mitigations in place (consent-gated, input masking, 30-day retention, pseudonymised data). |

---

## 4. Risk assessment

### 4.1 Identified risks

| # | Risk | Likelihood | Severity | Residual risk (after mitigations) |
|---|------|------------|----------|----------------------------------|
| R1 | **Accidental capture of personal data in DOM** — session recordings could capture personal data entered in form fields (email address in newsletter signup) | Medium | Medium | **Low** — input masking obscures form field content |
| R2 | **Re-identification via behavioural patterns** — unique interaction patterns could theoretically identify a returning user | Low | Low | **Low** — data is pseudonymised, 30-day retention limits accumulation |
| R3 | **Unauthorised access to recordings** — Microsoft account compromise could expose session recordings to attackers | Low | Medium | **Low** — Microsoft SOC 2 Type II, ISO 27001 certified; access restricted to authorised team members |
| R4 | **International transfer risk** — data transferred to USA | Medium | Medium | **Low** — Microsoft is DPF-certified, SCCs in DPA, supplementary measures in place |
| R5 | **Consent bypass** — Clarity script loads without valid consent due to implementation bug | Low | High | **Low** — consent-gating verified in code review (BaseHead.astro lines 122–138); Clarity only loads when `SD_startClarity()` is called, which requires `sd-cookie-consent=accepted` |
| R6 | **Lack of granular consent** — users cannot consent to GA4 separately from Clarity | Medium | Low | **Acceptable** — both are analytics tools serving the same purpose; a single "analytics" consent category is common and compliant, though granular consent would be best practice |

### 4.2 Risk rating

**Overall residual risk: LOW**

All identified risks are adequately mitigated by technical and organisational measures. No risk reaches a level that would require consultation with the Garante under Art. 36 GDPR.

---

## 5. Mitigations and safeguards

### 5.1 Technical measures (in place)

| Measure | Status | Reference |
|---------|--------|-----------|
| Consent-gated loading (script not loaded until opt-in) | Implemented | `BaseHead.astro` lines 122–138, `CookieBanner.astro` |
| Google Consent Mode v2 defaults to denied | Implemented | `BaseHead.astro` lines 93–100 |
| Consent withdrawal via footer "Cookie settings" link | Implemented | `CookieBanner.astro` lines 68–86 |
| Consent timestamp recorded | Implemented | `sd-cookie-consent-date` in localStorage |
| Cookies documented in Cookie Policy | Implemented | `cookie-policy.astro` |
| Clarity disclosed in Privacy Policy | Implemented | `privacy.astro` section 2, 4 |
| DPA with Microsoft verified | Verified | `legal/DPA-VERIFICATION.md` |

### 5.2 Technical measures (required — action items)

| # | Action | Priority | Owner |
|---|--------|----------|-------|
| A1 | **Verify input masking in Clarity dashboard** — confirm masking mode is "Balanced" or "Strict" to prevent capture of email addresses in newsletter form | High | Founding Engineer / Legal Expert |
| A2 | **Add Clarity-specific selector to mask newsletter input** — if masking mode is not sufficient, add `data-clarity-mask="true"` attribute to the newsletter email `<input>` element | Medium | Founding Engineer |

### 5.3 Organisational measures (in place)

| Measure | Status |
|---------|--------|
| ROPA entry for Clarity processing | Documented (`legal/ROPA.md` item 4) |
| DPA with Microsoft reviewed and verified | Documented (`legal/DPA-VERIFICATION.md`) |
| Privacy policy discloses Clarity, its purpose, data shared, and links to Microsoft privacy statement | Published (`/privacy`) |
| Cookie policy lists all Clarity cookies with purpose and duration | Published (`/cookie-policy`) |
| Data subjects informed of right to withdraw consent | Published (`/privacy` section 8) |
| Complaint mechanism to Garante documented | Published (`/privacy` section 9) |

---

## 6. Consultation

### 6.1 Prior consultation with supervisory authority (Art. 36 GDPR)

**Not required.** The residual risk after mitigations is low. Art. 36 only requires prior consultation when the controller "cannot find sufficient measures to reduce the risk to an acceptable level." All identified risks are adequately mitigated.

### 6.2 DPO consultation

Superdots does not currently have a Data Protection Officer (DPO). A DPO is not required under Art. 37 GDPR because:
- Superdots is not a public authority.
- Core activities do not consist of large-scale systematic monitoring (the blog is a content publication, not a surveillance platform).
- Core activities do not involve large-scale processing of special categories of data.

---

## 7. Decision

**Processing approved** with the following conditions:

1. Action items A1 and A2 (input masking verification) must be completed before any change to Clarity's default masking configuration.
2. This DPIA must be reviewed if any of the following occur:
   - Clarity configuration changes (e.g., enabling custom user ID tracking, disabling input masking).
   - Clarity's data processing practices materially change (monitor Microsoft's Clarity documentation and DPA).
   - A new Garante provvedimento or EDPB guidance affects session recording technologies.
   - Blog functionality changes to collect additional personal data visible in recordings (e.g., login, user profiles, payment forms).
3. Next scheduled review: **September 2026** (aligned with DPA review cycle).

---

## 8. Approval

| Role | Name/Entity | Date |
|------|-------------|------|
| **Controller** | Superdots | 18 March 2026 |
| **Prepared by** | Legal Expert (Paperclip agent) | 18 March 2026 |

---

## Appendix A: Legal references

- **GDPR Art. 35** — Data protection impact assessment
- **GDPR Art. 36** — Prior consultation
- **GDPR Art. 6(1)(a)** — Consent as legal basis
- **GDPR Art. 5(3) ePrivacy Directive (2002/58/EC)** — Consent for non-essential cookies/tracking
- **GDPR Art. 28** — Processor obligations
- **GDPR Art. 30** — Records of processing activities
- **GDPR Art. 44–49** — International transfers
- **Garante Provvedimento 11 October 2018** — List of processing operations requiring DPIA under Italian law
- **Garante Provvedimento n. 229/2021** — Cookie guidelines (updated implementation of Art. 5(3) ePrivacy)
- **EDPB Guidelines on DPIA (WP 248 rev.01)** — Criteria for when a DPIA is required
- **Microsoft Clarity Terms of Use** — https://clarity.microsoft.com/terms
- **Microsoft DPA** — https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
