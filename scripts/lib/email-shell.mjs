/**
 * Superdots Email Shell — shared branded layout for internal emails.
 *
 * Exports:
 *   BRAND          — brand constants (colors, fonts, site URL)
 *   renderEmail()  — wraps content in the navy + red shell
 *   statCard()     — stat tile for numeric summaries
 *   section()      — titled section with card body
 *   issueRow()     — row helper for task/article tables
 *   signatureDots  — three red dots signature mark (inline HTML)
 *
 * Design: dark theme matching public newsletter style.
 *   Background #0B1222, text #F8FAFC, accent #E8363B.
 *   Space Grotesk (display) + Inter (body) via Google Fonts.
 */

export const BRAND = {
  color: {
    bg:       '#0B1222',
    surface:  '#141B2E',
    surfaceAlt:'#1C2338',
    border:   '#252C43',
    text:     '#F8FAFC',
    muted:    '#94A3B8',
    accent:   '#E8363B',
    accentDark:'#CC2D32',
    accentTint:'rgba(232,54,59,0.12)',
    success:  '#22C55E',
    warning:  '#F59E0B',
    info:     '#60A5FA',
  },
  font: {
    display: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
    body:    "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  siteUrl: 'https://superdots.sh',
};

const C = BRAND.color;

// Three ascending red dots arranged diagonally bottom-left → top-right,
// matching public/brand/superdots-icon.svg (coords 14,50 r6 → 32,32 r8 → 50,14 r10).
// Rendered via a 3×3 table (position:absolute is unreliable in email clients).
export const signatureDots = (() => {
  const empty = '<td style="width:14px;height:14px;line-height:0;font-size:0">&nbsp;</td>';
  const dotCell = (size) =>
    `<td style="width:14px;height:14px;line-height:0;font-size:0;vertical-align:middle;text-align:center">` +
    `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${C.accent};line-height:0;font-size:0">&nbsp;</span>` +
    `</td>`;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;line-height:0;font-size:0;display:inline-table;vertical-align:middle">
    <tr>${empty}${empty}${dotCell(12)}</tr>
    <tr>${empty}${dotCell(10)}${empty}</tr>
    <tr>${dotCell(8)}${empty}${empty}</tr>
  </table>`;
})();

/**
 * Numeric stat tile.
 *   statCard({ value, label, color? })
 */
export function statCard({ value, label, color = C.text }) {
  return `
    <td style="padding:0 4px" width="25%">
      <div style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:16px 10px;text-align:center">
        <div style="font-family:${BRAND.font.display};font-size:28px;font-weight:700;color:${color};line-height:1">${value}</div>
        <div style="font-family:${BRAND.font.body};font-size:10px;color:${C.muted};margin-top:6px;text-transform:uppercase;letter-spacing:0.8px">${label}</div>
      </div>
    </td>`;
}

/**
 * Titled section block.
 *   section({ title, count?, body, accent? })
 * `body` is raw HTML (can be a full <table>, a <div>, a paragraph, etc.).
 */
export function section({ title, count = null, body, accent = C.accent }) {
  const badge = count !== null ? `
    <span style="display:inline-block;background:${C.accentTint};color:${accent};font-family:${BRAND.font.body};font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;margin-left:10px;vertical-align:middle">${count}</span>` : '';
  return `
  <tr><td style="padding:0 0 22px">
    <div style="font-family:${BRAND.font.display};font-size:16px;font-weight:600;color:${C.text};margin:0 0 12px 2px">
      ${title}${badge}
    </div>
    <div style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;overflow:hidden">
      ${body}
    </div>
  </td></tr>`;
}

/**
 * Row helper for a table of items (article, task, etc.)
 *   issueRow({ left, main, right?, subline? })
 */
export function issueRow({ left = '', main, right = '', subline = '' }) {
  return `
    <tr>
      ${left ? `<td style="padding:12px 0 12px 16px;border-bottom:1px solid ${C.border};font-family:${BRAND.font.body};font-size:11px;color:${C.muted};white-space:nowrap;vertical-align:top">${left}</td>` : ''}
      <td style="padding:12px 16px;border-bottom:1px solid ${C.border};vertical-align:top">
        <div style="font-family:${BRAND.font.body};font-size:14px;font-weight:500;color:${C.text};line-height:1.4">${main}</div>
        ${subline ? `<div style="font-family:${BRAND.font.body};font-size:12px;color:${C.muted};margin-top:3px">${subline}</div>` : ''}
      </td>
      ${right ? `<td style="padding:12px 16px 12px 0;border-bottom:1px solid ${C.border};font-family:${BRAND.font.body};font-size:13px;color:${C.muted};text-align:right;white-space:nowrap;vertical-align:top">${right}</td>` : ''}
    </tr>`;
}

/**
 * Empty-state placeholder inside a section.
 */
export function emptyState(text) {
  return `
    <div style="padding:22px 16px;text-align:center;font-family:${BRAND.font.body};font-size:13px;color:${C.muted}">${text}</div>`;
}

/**
 * Wraps rows in the standard `<table>` that sits inside a section card.
 */
export function rowTable(rowsHtml) {
  return `<table role="presentation" width="100%" style="border-collapse:collapse;width:100%">${rowsHtml}</table>`;
}

/**
 * renderEmail({
 *   preheader,   // hidden preview text shown in client list
 *   eyebrow,     // small label above title (e.g. "Daily Summary")
 *   title,       // big display heading
 *   subtitle,    // date range or subtitle line
 *   content,     // HTML of the body (usually a sequence of section() blocks)
 *   footerNote?, // optional extra line above the brand footer
 * })
 */
export function renderEmail({ preheader = '', eyebrow, title, subtitle = '', content, footerNote = '' }) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin:0; padding:0; background:${C.bg}; }
    a { color:${C.accent}; text-decoration:none; }
    a:hover { color:${C.accentDark}; }
    @media (max-width:600px) {
      .sd-stats td { display:block !important; width:100% !important; padding:4px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${BRAND.font.body};color:${C.text}">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 16px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="padding:0 0 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;position:relative">
            <tr><td style="padding:32px 28px 28px;position:relative">
              <div style="margin-bottom:16px">${signatureDots}</div>
              <div style="font-family:${BRAND.font.body};font-size:11px;font-weight:600;color:${C.accent};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:10px">${eyebrow}</div>
              <div style="font-family:${BRAND.font.display};font-size:26px;font-weight:700;color:${C.text};line-height:1.2;margin-bottom:${subtitle ? '6px' : '0'}">${title}</div>
              ${subtitle ? `<div style="font-family:${BRAND.font.body};font-size:13px;color:${C.muted}">${subtitle}</div>` : ''}
            </td></tr>
            <tr><td style="height:3px;background:${C.accent};line-height:0;font-size:0">&nbsp;</td></tr>
          </table>
        </td></tr>

        <!-- Content -->
        ${content}

        <!-- Footer -->
        <tr><td style="padding:8px 0 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:22px 20px;background:${C.surface};border:1px solid ${C.border};border-radius:14px;text-align:center">
              ${footerNote ? `<div style="font-family:${BRAND.font.body};font-size:12px;color:${C.muted};margin-bottom:14px">${footerNote}</div>` : ''}
              <div style="margin-bottom:10px">${signatureDots}</div>
              <div style="font-family:${BRAND.font.display};font-size:14px;font-weight:600;color:${C.text};letter-spacing:0.5px;margin-bottom:4px">Superdots</div>
              <div style="font-family:${BRAND.font.body};font-size:11px;color:${C.muted};letter-spacing:0.3px">Practical AI for every department.</div>
              <div style="font-family:${BRAND.font.body};font-size:10px;color:${C.muted};margin-top:14px;opacity:0.7">
                Report interno generato automaticamente da Paperclip &middot; <a href="${BRAND.siteUrl}" style="color:${C.muted};text-decoration:underline">superdots.sh</a>
              </div>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
