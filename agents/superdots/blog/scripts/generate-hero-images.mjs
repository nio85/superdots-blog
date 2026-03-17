#!/usr/bin/env node
/**
 * Generate branded SVG hero images for all Superdots blog posts.
 * Each image is 1200x630 (OG standard) with department-specific design.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'images', 'blog');

// Brand colors from the design system
const COLORS = {
  red: '#E8363B',
  redDark: '#CC2D32',
  navy: '#0B1222',
  navyLight: '#1E293B',
  teal: '#14B8A6',
  tealDark: '#0D9488',
  amber: '#F59E0B',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray700: '#334155',
  gray800: '#1E293B',
};

// Department → accent color mapping
const DEPT_COLORS = {
  engineering: { accent: COLORS.teal, accentLight: '#5EEAD4', icon: '&#60;/&#62;' },
  marketing: { accent: COLORS.red, accentLight: '#FCA5A5', icon: '&#9650;' },
  sales: { accent: COLORS.amber, accentLight: '#FDE68A', icon: '&#9670;' },
  hr: { accent: COLORS.teal, accentLight: '#5EEAD4', icon: '&#9673;' },
  finance: { accent: COLORS.amber, accentLight: '#FDE68A', icon: '&#9632;' },
  operations: { accent: COLORS.teal, accentLight: '#5EEAD4', icon: '&#9646;' },
  legal: { accent: COLORS.red, accentLight: '#FCA5A5', icon: '&#167;' },
  'customer-support': { accent: COLORS.amber, accentLight: '#FDE68A', icon: '&#9829;' },
  design: { accent: COLORS.red, accentLight: '#FCA5A5', icon: '&#10022;' },
};

// UseCase labels
const USECASE_LABELS = {
  automation: 'Automation',
  analysis: 'Analysis',
  writing: 'Writing',
  communication: 'Communication',
};

// All blog posts
const posts = [
  { slug: 'ai-budgeting-tools', title: 'AI Budgeting Tools', subtitle: 'How Non-Finance Teams Can Track Spending', dept: 'finance', useCase: 'analysis' },
  { slug: 'ai-competitive-analysis', title: 'AI Competitive Analysis', subtitle: 'How Sales Teams Prep Smarter, Faster', dept: 'sales', useCase: 'analysis' },
  { slug: 'ai-compliance-tools', title: 'AI Compliance Tools', subtitle: 'What Non-Technical Teams Need to Know', dept: 'legal', useCase: 'automation' },
  { slug: 'ai-contract-review-non-lawyers', title: 'AI Contract Review', subtitle: 'Cut Review Time by 70%', dept: 'legal', useCase: 'automation' },
  { slug: 'ai-customer-feedback-analysis', title: 'AI Customer Feedback', subtitle: 'Turn Reviews and Surveys Into Action', dept: 'customer-support', useCase: 'analysis' },
  { slug: 'ai-customer-service-chatbot', title: 'AI Customer Service Chatbots', subtitle: 'Set One Up Without a Dev Team', dept: 'customer-support', useCase: 'automation' },
  { slug: 'ai-data-analysis-for-non-technical-teams', title: 'AI Data Analysis', subtitle: 'Ask Questions, Get Answers', dept: 'finance', useCase: 'analysis' },
  { slug: 'ai-design-tools-non-designers', title: 'AI Design Tools', subtitle: 'Create Pro Visuals Fast', dept: 'design', useCase: 'communication' },
  { slug: 'ai-employee-onboarding', title: 'AI Employee Onboarding', subtitle: 'Get New Hires Productive in Half the Time', dept: 'hr', useCase: 'automation' },
  { slug: 'ai-for-recruiting', title: 'AI for Recruiting', subtitle: 'Cut Hiring Busywork Without Losing the Human Touch', dept: 'hr', useCase: 'automation' },
  { slug: 'ai-for-sales-call-prep', title: 'AI Sales Call Prep', subtitle: 'Prep Smarter in 5 Minutes', dept: 'sales', useCase: 'analysis' },
  { slug: 'ai-inventory-management', title: 'AI Inventory Management', subtitle: 'A Practical Guide for Operations Teams', dept: 'operations', useCase: 'automation' },
  { slug: 'ai-knowledge-base-for-teams', title: 'AI Knowledge Base', subtitle: 'Build an AI-Powered Internal Wiki', dept: 'operations', useCase: 'communication' },
  { slug: 'ai-meeting-notes-summaries-action-items', title: 'AI Meeting Notes', subtitle: 'Summaries and Action Items, Automatically', dept: 'operations', useCase: 'communication' },
  { slug: 'ai-presentation-maker', title: 'AI Presentations', subtitle: "That Don't Look AI-Generated", dept: 'operations', useCase: 'writing' },
  { slug: 'ai-project-management-features-guide', title: 'AI in Project Management', subtitle: 'Features That Actually Save Time', dept: 'operations', useCase: 'automation' },
  { slug: 'ai-writing-assistant-keep-your-voice', title: 'AI Writing Assistant', subtitle: 'Without Losing Your Voice', dept: 'marketing', useCase: 'writing' },
  { slug: 'automate-email-triage-with-ai', title: 'Automate Email Triage', subtitle: 'Sort, Prioritize, Respond — with AI', dept: 'operations', useCase: 'automation' },
  { slug: 'manage-email-faster-with-ai', title: 'Manage Email 2x Faster', subtitle: 'A Practical Guide to AI Email', dept: 'operations', useCase: 'communication' },
  { slug: 'writing-better-docs-with-ai', title: 'Better Technical Docs', subtitle: 'Writing Docs with AI That Actually Help', dept: 'engineering', useCase: 'writing' },
  // Sprint 5b quick-win articles
  { slug: 'ai-contract-clause-extraction', title: 'AI Clause Extraction', subtitle: 'Extract and Analyze Contract Clauses Automatically', dept: 'legal', useCase: 'automation' },
  { slug: 'ai-legal-billing', title: 'AI Legal Billing', subtitle: 'Automate Time Tracking and Client Invoices', dept: 'legal', useCase: 'automation' },
  { slug: 'ai-motion-graphics-tools', title: 'AI Motion Graphics', subtitle: 'Animation Tools for Design Teams', dept: 'design', useCase: 'automation' },
  { slug: 'ai-design-handoff', title: 'AI Design Handoff', subtitle: 'Streamline Design-to-Dev Delivery', dept: 'design', useCase: 'automation' },
  { slug: 'ai-customer-sentiment-dashboard', title: 'AI Sentiment Dashboard', subtitle: 'Real-Time Customer Sentiment at a Glance', dept: 'customer-support', useCase: 'analysis' },
  { slug: 'ai-compensation-benchmarking', title: 'AI Comp Benchmarking', subtitle: 'Get Salary Data Right Without Consultants', dept: 'hr', useCase: 'analysis' },
  { slug: 'ai-employee-offboarding', title: 'AI Offboarding', subtitle: 'Automate the Exit Checklist', dept: 'hr', useCase: 'automation' },
  { slug: 'ai-proposal-generator', title: 'AI Proposal Generator', subtitle: 'Write Winning Proposals in Half the Time', dept: 'sales', useCase: 'writing' },
  { slug: 'ai-sales-territory-planning', title: 'AI Territory Planning', subtitle: 'Optimize Sales Territory Assignment', dept: 'sales', useCase: 'analysis' },
  { slug: 'ai-revenue-recognition', title: 'AI Revenue Recognition', subtitle: 'Automate ASC 606 Compliance', dept: 'finance', useCase: 'automation' },
  { slug: 'ai-audit-preparation', title: 'AI Audit Preparation', subtitle: 'Automate Evidence Gathering', dept: 'finance', useCase: 'automation' },
  { slug: 'ai-code-migration', title: 'AI Code Migration', subtitle: 'Upgrade Legacy Codebases Without the Pain', dept: 'engineering', useCase: 'automation' },
  { slug: 'ai-customer-journey-mapping', title: 'AI Journey Mapping', subtitle: 'Map Customer Journeys with Real Data', dept: 'marketing', useCase: 'analysis' },
  { slug: 'ai-vendor-management', title: 'AI Vendor Management', subtitle: 'Evaluate, Track, and Negotiate Smarter', dept: 'operations', useCase: 'analysis' },
  { slug: 'ai-fleet-management', title: 'AI Fleet Management', subtitle: 'Optimize Routes, Maintenance, and Costs', dept: 'operations', useCase: 'automation' },
];

// Word-wrap text into lines of maxChars
function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Generate dot pattern
function dotPattern(accent, opacity = 0.12) {
  const dots = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 12; col++) {
      const x = 820 + col * 22;
      const y = 40 + row * 22;
      // Skip some dots for visual interest
      if ((row + col) % 3 === 0) continue;
      dots.push(`<circle cx="${x}" cy="${y}" r="2" fill="${accent}" opacity="${opacity}"/>`);
    }
  }
  return dots.join('\n    ');
}

// Generate geometric shapes unique per post index
function decorativeShapes(index, accent, accentLight) {
  const shapes = [];
  const seed = index * 7;

  // Large circle (bottom right area)
  const cx = 980 + (seed % 5) * 20;
  const cy = 380 + (seed % 7) * 15;
  const r = 60 + (seed % 4) * 15;
  shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.2"/>`);

  // Smaller filled circle
  shapes.push(`<circle cx="${cx + 40}" cy="${cy - 60}" r="8" fill="${accent}" opacity="0.3"/>`);

  // Diagonal line
  const lx = 900 + (seed % 8) * 15;
  const ly = 500 + (seed % 5) * 10;
  shapes.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 120}" y2="${ly - 80}" stroke="${accent}" stroke-width="1.5" opacity="0.15"/>`);

  // Rectangle outline
  const rx = 1020 + (seed % 6) * 10;
  const ry = 480 + (seed % 4) * 12;
  shapes.push(`<rect x="${rx}" y="${ry}" width="40" height="40" rx="4" fill="none" stroke="${accentLight}" stroke-width="1" opacity="0.15" transform="rotate(${15 + seed % 30}, ${rx + 20}, ${ry + 20})"/>`);

  return shapes.join('\n    ');
}

function generateSVG(post, index) {
  const dept = DEPT_COLORS[post.dept] || DEPT_COLORS.operations;
  const useCaseLabel = USECASE_LABELS[post.useCase] || post.useCase;
  const deptLabel = post.dept.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());

  const titleLines = wrapText(post.title, 22);
  const titleY = titleLines.length > 1 ? 260 : 290;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg${index}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.navy}"/>
      <stop offset="100%" stop-color="${COLORS.navyLight}"/>
    </linearGradient>
    <linearGradient id="accent${index}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${dept.accent}"/>
      <stop offset="100%" stop-color="${dept.accent}00"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg${index})"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="1200" height="4" fill="${dept.accent}"/>

  <!-- Dot pattern -->
  <g>
    ${dotPattern(dept.accent)}
  </g>

  <!-- Decorative geometry -->
  <g>
    ${decorativeShapes(index, dept.accent, dept.accentLight)}
  </g>

  <!-- Bottom accent line -->
  <rect x="80" y="540" width="120" height="3" rx="1.5" fill="${dept.accent}" opacity="0.6"/>

  <!-- Superdots brand dot -->
  <circle cx="92" cy="80" r="8" fill="${COLORS.red}"/>
  <text x="112" y="87" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="600" fill="#FFFFFF" letter-spacing="-0.02em">superdots</text>

  <!-- Department badge -->
  <rect x="80" y="140" width="${deptLabel.length * 10 + 28}" height="28" rx="14" fill="${dept.accent}" opacity="0.15"/>
  <text x="94" y="159" font-family="'Space Grotesk', sans-serif" font-size="12" font-weight="600" fill="${dept.accentLight}" letter-spacing="0.08em">${deptLabel.toUpperCase()}</text>

  <!-- Use case badge -->
  <rect x="${80 + deptLabel.length * 10 + 36}" y="140" width="${useCaseLabel.length * 9 + 24}" height="28" rx="14" fill="${COLORS.gray700}" opacity="0.5"/>
  <text x="${92 + deptLabel.length * 10 + 36}" y="159" font-family="'Space Grotesk', sans-serif" font-size="12" font-weight="600" fill="${COLORS.gray400}" letter-spacing="0.06em">${useCaseLabel.toUpperCase()}</text>

  <!-- Title -->
  ${titleLines.map((line, i) =>
    `<text x="80" y="${titleY + i * 64}" font-family="'Space Grotesk', sans-serif" font-size="54" font-weight="700" fill="#FFFFFF" letter-spacing="-0.03em">${escapeXml(line)}<tspan fill="${COLORS.red}">.</tspan></text>`
  ).join('\n  ')}

  <!-- Subtitle -->
  <text x="80" y="${titleY + titleLines.length * 64 + 16}" font-family="'Inter', sans-serif" font-size="22" fill="${COLORS.gray400}" letter-spacing="-0.01em">${escapeXml(post.subtitle)}</text>

  <!-- Bottom brand -->
  <text x="80" y="580" font-family="'Space Grotesk', sans-serif" font-size="14" fill="${COLORS.gray500}" letter-spacing="0.04em">superdots.sh</text>

  <!-- Corner accent -->
  <rect x="1160" y="590" width="8" height="8" rx="4" fill="${dept.accent}" opacity="0.4"/>
</svg>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate all images
for (let i = 0; i < posts.length; i++) {
  const post = posts[i];
  const svg = generateSVG(post, i);
  const outPath = join(OUT_DIR, `${post.slug}.svg`);
  writeFileSync(outPath, svg, 'utf-8');
  console.log(`✓ ${post.slug}.svg`);
}

console.log(`\nGenerated ${posts.length} hero images in ${OUT_DIR}`);
