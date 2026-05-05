#!/usr/bin/env node
/**
 * Automated Internal Linking Script
 *
 * Analyzes all blog articles and inserts contextual inline links
 * between related articles based on topic matching.
 *
 * Usage: node scripts/internal-linking.mjs [--dry-run] [--min-links N] [--max-links N]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');

const DRY_RUN = process.argv.includes('--dry-run');
const MIN_LINKS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--min-links') || '5');
const MAX_LINKS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--max-links') || '8');

// ── Parse frontmatter + body from markdown ──────────────────────────
function parseArticle(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const body = fmMatch[2];

  const title = (fm.match(/^title:\s*["'](.+?)["']\s*$/m) || fm.match(/^title:\s*(.+)$/m))?.[1] || '';
  const dept = (fm.match(/^department:\s*["'](.+?)["']\s*$/m) || fm.match(/^department:\s*(.+)$/m))?.[1] || '';
  const useCase = (fm.match(/^useCase:\s*["'](.+?)["']\s*$/m) || fm.match(/^useCase:\s*(.+)$/m))?.[1] || '';

  // Parse tags array
  const tagsMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''))
    : [];

  const pubDateStr = (fm.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m))?.[1] || '';
  const pubDate = pubDateStr ? new Date(pubDateStr + 'T00:00:00') : null;

  const slug = path.basename(filePath, '.md');

  return { slug, title, dept, useCase, tags, pubDate, body, frontmatter: fmMatch[1], raw, filePath };
}

// ── Build keyword phrases from article metadata ─────────────────────
function buildKeywords(article) {
  const keywords = [];

  // Extract key phrases from title
  const titleClean = article.title
    .replace(/^(Best|How to|How|Top|Why|What|The)\s+/i, '')
    .replace(/\s+(in \d{4}|for .+)$/i, '');

  // Full cleaned title as a phrase
  keywords.push(titleClean.toLowerCase());

  // Extract meaningful 2-3 word phrases from the title
  const titleWords = article.title
    .replace(/[:\-–—|]/g, ' ')
    .replace(/['"]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w.toLowerCase());

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'without', 'that', 'this', 'how', 'what',
    'why', 'who', 'when', 'best', 'top', 'your', 'you', 'our', 'can',
    'from', 'into', 'about', 'than', 'more', 'most', 'every', 'all',
    'not', 'are', 'was', 'will', 'has', 'have', 'been', 'get', 'got',
    'does', 'did', 'should', 'would', 'could', 'but', 'also', 'just',
    'its', 'they', 'them', 'their', 'which', 'while', 'where',
  ]);

  const meaningfulWords = titleWords.filter(w => !stopWords.has(w));

  // Build topic-specific keyword map from slug
  const slugParts = article.slug.replace(/^ai-/, '').split('-');
  const slugPhrase = slugParts.join(' ');
  keywords.push(slugPhrase);

  // Build compound phrases from meaningful title words
  for (let i = 0; i < meaningfulWords.length - 1; i++) {
    keywords.push(`${meaningfulWords[i]} ${meaningfulWords[i + 1]}`);
    if (i < meaningfulWords.length - 2) {
      keywords.push(`${meaningfulWords[i]} ${meaningfulWords[i + 1]} ${meaningfulWords[i + 2]}`);
    }
  }

  // Deduplicate and filter short/generic phrases
  const seen = new Set();
  return keywords.filter(k => {
    if (k.length < 6 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Topic mapping: map natural language phrases → target articles ────
function buildTopicMap(articles) {
  // Hand-curated topic aliases that map common text phrases to article slugs
  const topicAliases = {
    'accounting software': 'ai-accounting-software',
    'accounting tools': 'ai-accounting-software',
    'bookkeeping': 'ai-accounting-software',
    'accounts receivable': 'ai-accounts-receivable',
    'invoice collection': 'ai-accounts-receivable',
    'payment collection': 'ai-accounts-receivable',
    'ad copy': 'ai-ad-copy-tools',
    'advertising copy': 'ai-ad-copy-tools',
    'api documentation': 'ai-api-documentation',
    'api docs': 'ai-api-documentation',
    'audit preparation': 'ai-audit-preparation',
    'audit readiness': 'ai-audit-preparation',
    'no-code automation': 'ai-automation-guide',
    'workflow automation': 'ai-automation-guide',
    'brand identity': 'ai-brand-identity-tools',
    'brand guidelines': 'ai-brand-identity-tools',
    'brand monitoring': 'ai-brand-monitoring',
    'brand mentions': 'ai-brand-monitoring',
    'budgeting tools': 'ai-budgeting-tools',
    'budget tracking': 'ai-budgeting-tools',
    'cash flow forecasting': 'ai-cash-flow-forecasting',
    'cash flow prediction': 'ai-cash-flow-forecasting',
    'code migration': 'ai-code-migration',
    'legacy code': 'ai-code-migration',
    'code review': 'ai-code-review-tools',
    'pull request review': 'ai-code-review-tools',
    'cold outreach': 'ai-cold-outreach',
    'cold email': 'ai-cold-outreach',
    'color palette': 'ai-color-palette-generator',
    'compensation benchmarking': 'ai-compensation-benchmarking',
    'salary benchmarking': 'ai-compensation-benchmarking',
    'competitive analysis': 'ai-competitive-analysis',
    'competitor analysis': 'ai-competitive-analysis',
    'compliance tools': 'ai-compliance-tools',
    'regulatory compliance': 'ai-compliance-tools',
    'content creation': 'ai-content-creation',
    'marketing content': 'ai-content-creation',
    'contract clause extraction': 'ai-contract-clause-extraction',
    'clause analysis': 'ai-contract-clause-extraction',
    'contract management': 'ai-contract-management',
    'contract lifecycle': 'ai-contract-management',
    'contract review': 'ai-contract-review-non-lawyers',
    'conversation intelligence': 'ai-conversation-intelligence',
    'call analytics': 'ai-conversation-intelligence',
    'crm tools': 'ai-crm-tools',
    'crm features': 'ai-crm-tools',
    'customer feedback analysis': 'ai-customer-feedback-analysis',
    'feedback analysis': 'ai-customer-feedback-analysis',
    'customer journey mapping': 'ai-customer-journey-mapping',
    'journey mapping': 'ai-customer-journey-mapping',
    'customer retention': 'ai-customer-retention',
    'churn prediction': 'ai-customer-retention',
    'churn prevention': 'ai-customer-retention',
    'customer self-service': 'ai-customer-self-service',
    'self-service portal': 'ai-customer-self-service',
    'sentiment dashboard': 'ai-customer-sentiment-dashboard',
    'sentiment analysis': 'ai-customer-sentiment-dashboard',
    'customer sentiment': 'ai-customer-sentiment-dashboard',
    'customer service chatbot': 'ai-customer-service-chatbot',
    'support chatbot': 'ai-customer-service-chatbot',
    'customer service qa': 'ai-customer-service-qa',
    'quality assurance': 'ai-customer-service-qa',
    'data analysis': 'ai-data-analysis-for-non-technical-teams',
    'database management': 'ai-database-management',
    'data cleaning': 'ai-data-cleaning-tools',
    'data quality': 'ai-data-cleaning-tools',
    'data visualization': 'ai-data-visualization-tools',
    'data dashboards': 'ai-data-visualization-tools',
    'deal intelligence': 'ai-deal-intelligence',
    'deal scoring': 'ai-deal-intelligence',
    'debugging': 'ai-debugging-guide',
    'bug fixing': 'ai-debugging-guide',
    'design handoff': 'ai-design-handoff',
    'developer handoff': 'ai-design-handoff',
    'design systems': 'ai-design-systems',
    'design tokens': 'ai-design-systems',
    'design tools': 'ai-design-tools-non-designers',
    'devops tools': 'ai-devops-tools',
    'ci/cd': 'ai-devops-tools',
    'diversity hiring': 'ai-diversity-hiring',
    'inclusive hiring': 'ai-diversity-hiring',
    'document management': 'ai-document-management',
    'document organization': 'ai-document-management',
    'document summarizer': 'ai-document-summarizer',
    'document summarization': 'ai-document-summarizer',
    'ediscovery': 'ai-ediscovery-tools',
    'e-discovery': 'ai-ediscovery-tools',
    'email marketing': 'ai-email-marketing',
    'email campaigns': 'ai-email-marketing',
    'employee engagement': 'ai-employee-engagement',
    'employee satisfaction': 'ai-employee-engagement',
    'employee offboarding': 'ai-employee-offboarding',
    'offboarding process': 'ai-employee-offboarding',
    'employee onboarding': 'ai-employee-onboarding',
    'onboarding process': 'ai-employee-onboarding',
    'employee training': 'ai-employee-training',
    'training programs': 'ai-employee-training',
    'expense reports': 'ai-expense-reports',
    'expense management': 'ai-expense-reports',
    'financial forecasting': 'ai-financial-forecasting',
    'revenue forecasting': 'ai-financial-forecasting',
    'fleet management': 'ai-fleet-management',
    'vehicle tracking': 'ai-fleet-management',
    'recruiting': 'ai-for-recruiting',
    'talent acquisition': 'ai-for-recruiting',
    'recruitment': 'ai-for-recruiting',
    'sales call prep': 'ai-for-sales-call-prep',
    'call preparation': 'ai-for-sales-call-prep',
    'fraud detection': 'ai-fraud-detection',
    'fraud prevention': 'ai-fraud-detection',
    'generated art': 'ai-generated-art-for-commercial-use',
    'ai art': 'ai-generated-art-for-commercial-use',
    'help desk': 'ai-help-desk-software',
    'help desk software': 'ai-help-desk-software',
    'hr chatbot': 'ai-hr-chatbot',
    'hr assistant': 'ai-hr-chatbot',
    'image generation': 'ai-image-generation-marketing',
    'marketing images': 'ai-image-generation-marketing',
    'incident management': 'ai-incident-management',
    'incident response': 'ai-incident-management',
    'infrastructure monitoring': 'ai-infrastructure-monitoring',
    'server monitoring': 'ai-infrastructure-monitoring',
    'inventory management': 'ai-inventory-management',
    'stock management': 'ai-inventory-management',
    'invoice processing': 'ai-invoice-processing',
    'invoice automation': 'ai-invoice-processing',
    'ip management': 'ai-ip-management',
    'intellectual property': 'ai-ip-management',
    'knowledge base': 'ai-knowledge-base-for-teams',
    'internal knowledge base': 'ai-knowledge-base-for-teams',
    'knowledge base generator': 'ai-knowledge-base-generator',
    'landing page builder': 'ai-landing-page-builder',
    'landing pages': 'ai-landing-page-builder',
    'lead scoring': 'ai-lead-scoring',
    'lead qualification': 'ai-lead-scoring',
    'legal billing': 'ai-legal-billing',
    'legal time tracking': 'ai-legal-billing',
    'legal document review': 'ai-legal-document-review',
    'legal review': 'ai-legal-document-review',
    'legal research': 'ai-legal-research',
    'case law research': 'ai-legal-research',
    'logo design': 'ai-logo-design',
    'brand logos': 'ai-logo-design',
    'market research': 'ai-market-research',
    'market analysis': 'ai-market-research',
    'meeting notes': 'ai-meeting-notes-summaries-action-items',
    'meeting summaries': 'ai-meeting-notes-summaries-action-items',
    'action items': 'ai-meeting-notes-summaries-action-items',
    'motion graphics': 'ai-motion-graphics-tools',
    'omnichannel support': 'ai-omnichannel-support',
    'multichannel support': 'ai-omnichannel-support',
    'pair programming': 'ai-pair-programming',
    'ai coding assistant': 'ai-pair-programming',
    'performance reviews': 'ai-performance-reviews',
    'performance management': 'ai-performance-reviews',
    'pitch deck': 'ai-pitch-deck-generator',
    'investor deck': 'ai-pitch-deck-generator',
    'presentation maker': 'ai-presentation-maker',
    'slide decks': 'ai-presentation-maker',
    'pricing optimization': 'ai-pricing-optimization',
    'dynamic pricing': 'ai-pricing-optimization',
    'process mining': 'ai-process-mining',
    'workflow analysis': 'ai-process-mining',
    'procurement tools': 'ai-procurement-tools',
    'purchasing automation': 'ai-procurement-tools',
    'productivity guide': 'ai-productivity-guide',
    'productivity tools': 'ai-productivity-guide',
    'project management': 'ai-project-management-features-guide',
    'task management': 'ai-project-management-features-guide',
    'proposal generator': 'ai-proposal-generator',
    'business proposals': 'ai-proposal-generator',
    'regulatory monitoring': 'ai-regulatory-compliance-monitoring',
    'compliance monitoring': 'ai-regulatory-compliance-monitoring',
    'report generator': 'ai-report-generator',
    'automated reports': 'ai-report-generator',
    'revenue recognition': 'ai-revenue-recognition',
    'rev rec': 'ai-revenue-recognition',
    'risk management': 'ai-risk-management',
    'risk assessment': 'ai-risk-management',
    'sales emails': 'ai-sales-emails',
    'sales email templates': 'ai-sales-emails',
    'sales forecasting': 'ai-sales-forecasting',
    'pipeline forecasting': 'ai-sales-forecasting',
    'sales prospecting': 'ai-sales-prospecting',
    'prospecting tools': 'ai-sales-prospecting',
    'territory planning': 'ai-sales-territory-planning',
    'sales territories': 'ai-sales-territory-planning',
    'scheduling assistant': 'ai-scheduling-assistant',
    'calendar management': 'ai-scheduling-assistant',
    'security scanning': 'ai-security-scanning',
    'vulnerability scanning': 'ai-security-scanning',
    'seo tools': 'ai-seo-tools',
    'search optimization': 'ai-seo-tools',
    'skills gap analysis': 'ai-skills-gap-analysis',
    'skills assessment': 'ai-skills-gap-analysis',
    'social media calendar': 'ai-social-media-content-calendar',
    'social media content': 'ai-social-media-content-calendar',
    'spreadsheet tools': 'ai-spreadsheet-tools',
    'spreadsheet automation': 'ai-spreadsheet-tools',
    'supply chain': 'ai-supply-chain-management',
    'supply chain management': 'ai-supply-chain-management',
    'tax preparation': 'ai-tax-preparation',
    'tax filing': 'ai-tax-preparation',
    'test generation': 'ai-test-generation',
    'automated testing': 'ai-test-generation',
    'ticket routing': 'ai-ticket-routing',
    'support ticket routing': 'ai-ticket-routing',
    'business tools': 'ai-tools-for-business-guide',
    'data entry': 'ai-tools-for-data-entry',
    'data entry automation': 'ai-tools-for-data-entry',
    'translation tools': 'ai-translation-tools',
    'language translation': 'ai-translation-tools',
    'ux design': 'ai-ux-design-tools',
    'user experience': 'ai-ux-design-tools',
    'vendor management': 'ai-vendor-management',
    'supplier management': 'ai-vendor-management',
    'video marketing': 'ai-video-marketing-tools',
    'marketing videos': 'ai-video-marketing-tools',
    'voice assistant': 'ai-voice-assistant-customer-service',
    'voice bot': 'ai-voice-assistant-customer-service',
    'wireframing': 'ai-wireframing-tools',
    'wireframe tools': 'ai-wireframing-tools',
    'workforce planning': 'ai-workforce-planning',
    'headcount planning': 'ai-workforce-planning',
    'email triage': 'automate-email-triage-with-ai',
    'email sorting': 'automate-email-triage-with-ai',
    'video editing': 'best-ai-video-editing-tools',
    'video editor': 'best-ai-video-editing-tools',
    'email management': 'manage-email-faster-with-ai',
    'inbox management': 'manage-email-faster-with-ai',
    'writing assistant': 'ai-writing-assistant-keep-your-voice',
    'writing tools': 'ai-writing-assistant-keep-your-voice',
    'documentation': 'writing-better-docs-with-ai',
    'technical writing': 'writing-better-docs-with-ai',
  };

  return topicAliases;
}

// ── Determine department-based related topics ───────────────────────
function getDepartmentTopics(dept) {
  const deptGroups = {
    finance: ['accounting software', 'accounts receivable', 'budgeting tools', 'cash flow forecasting',
      'expense reports', 'financial forecasting', 'fraud detection', 'invoice processing',
      'revenue recognition', 'tax preparation', 'audit preparation'],
    sales: ['crm tools', 'cold outreach', 'competitive analysis', 'conversation intelligence',
      'deal intelligence', 'lead scoring', 'sales emails', 'sales forecasting',
      'sales prospecting', 'territory planning', 'sales call prep', 'pricing optimization'],
    marketing: ['ad copy', 'brand monitoring', 'content creation', 'email marketing',
      'image generation', 'landing page builder', 'market research', 'seo tools',
      'social media calendar', 'video marketing', 'customer journey mapping'],
    engineering: ['api documentation', 'code migration', 'code review', 'debugging',
      'devops tools', 'infrastructure monitoring', 'pair programming', 'security scanning',
      'test generation', 'database management', 'incident management'],
    hr: ['compensation benchmarking', 'diversity hiring', 'employee engagement',
      'employee offboarding', 'employee onboarding', 'employee training', 'hr chatbot',
      'performance reviews', 'recruiting', 'skills gap analysis', 'workforce planning'],
    legal: ['compliance tools', 'contract clause extraction', 'contract management',
      'contract review', 'ediscovery', 'ip management', 'legal billing',
      'legal document review', 'legal research', 'regulatory monitoring'],
    'customer-support': ['customer feedback analysis', 'customer retention', 'customer self-service',
      'customer sentiment', 'customer service chatbot', 'customer service qa',
      'help desk', 'omnichannel support', 'ticket routing', 'voice assistant'],
    design: ['brand identity', 'color palette', 'design handoff', 'design systems',
      'design tools', 'logo design', 'motion graphics', 'ux design', 'wireframing'],
    operations: ['data entry', 'document management', 'document summarizer', 'fleet management',
      'inventory management', 'knowledge base', 'meeting notes', 'process mining',
      'procurement tools', 'project management', 'scheduling assistant',
      'spreadsheet tools', 'supply chain', 'vendor management', 'workflow automation'],
  };
  return deptGroups[dept] || [];
}

// ── Find best insertion points in body text ──────────────────────────
function findInsertionPoints(body, targetPhrase, existingLinkedSlugs) {
  const lines = body.split('\n');
  const results = [];

  // Regex to match the phrase in body text (case insensitive, word boundaries)
  const escaped = targetPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\[/])\\b(${escaped})\\b(?![\\]\\(])`, 'gi');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip frontmatter, headings, existing links, code blocks, FAQs, images
    if (line.startsWith('#') || line.startsWith('```') || line.startsWith('![') ||
        line.startsWith('|') || line.trim() === '---' || line.trim() === '') continue;

    // Skip lines that already have a link on them (to avoid nested links)
    // Only skip if the match position is inside an existing link
    const match = re.exec(line);
    if (match) {
      // Check this match isn't inside an existing markdown link
      const before = line.substring(0, match.index);
      const after = line.substring(match.index + match[0].length);

      // Count open/close brackets to detect if we're inside a link
      const openBrackets = (before.match(/\[/g) || []).length;
      const closeBrackets = (before.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        re.lastIndex = 0;
        continue; // Inside a link
      }

      results.push({ lineIndex: i, matchIndex: match.index, matchLength: match[0].length, matchText: match[0] });
      re.lastIndex = 0;
    }
    re.lastIndex = 0;
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────
function main() {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  const allArticles = files.map(f => parseArticle(path.join(BLOG_DIR, f))).filter(Boolean);
  const now = new Date();
  const articles = allArticles.filter(a => a.pubDate && a.pubDate <= now);

  console.log(`Found ${allArticles.length} articles (${allArticles.length - articles.length} future-dated, excluded)`);

  const topicMap = buildTopicMap(articles);
  const slugToArticle = new Map(articles.map(a => [a.slug, a]));

  let totalLinksAdded = 0;
  let articlesModified = 0;
  const stats = { below3: 0, at3: 0, at4: 0, at5plus: 0 };

  for (const article of articles) {
    // Count existing internal links
    const existingLinks = (article.body.match(/\]\(\/blog\/[^)]+\)/g) || []);
    const existingLinkedSlugs = new Set(
      existingLinks.map(l => {
        const m = l.match(/\/blog\/([^)/]+)/);
        return m ? m[1].replace(/\/$/, '') : null;
      }).filter(Boolean)
    );
    const existingCount = existingLinkedSlugs.size;

    if (existingCount >= MAX_LINKS) continue; // Already has enough links

    const linksNeeded = Math.max(0, MIN_LINKS - existingCount);
    if (linksNeeded === 0) continue;

    // Find candidate topics to link to
    const candidates = [];

    // 1. Same department topics
    const deptTopics = getDepartmentTopics(article.dept);
    for (const topic of deptTopics) {
      const targetSlug = topicMap[topic];
      if (!targetSlug || targetSlug === article.slug || existingLinkedSlugs.has(targetSlug)) continue;

      const target = slugToArticle.get(targetSlug);
      if (!target) continue;

      // Score: same department = 3, shared tags = +1 each
      let score = 3;
      for (const t of article.tags) {
        if (target.tags.includes(t)) score += 1;
      }

      candidates.push({ topic, targetSlug, target, score, dept: true });
    }

    // 2. Cross-department topics that appear in the article body
    for (const [topic, targetSlug] of Object.entries(topicMap)) {
      if (targetSlug === article.slug || existingLinkedSlugs.has(targetSlug)) continue;
      if (candidates.some(c => c.targetSlug === targetSlug)) continue;

      const target = slugToArticle.get(targetSlug);
      if (!target) continue;

      // Check if topic phrase appears in the article body
      const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(article.body)) {
        let score = 1;
        if (target.dept === article.dept) score += 2;
        for (const t of article.tags) {
          if (target.tags.includes(t)) score += 1;
        }
        candidates.push({ topic, targetSlug, target, score, dept: false });
      }
    }

    // Sort by score descending, take what we need
    candidates.sort((a, b) => b.score - a.score);

    // Deduplicate by target slug
    const seenSlugs = new Set();
    const uniqueCandidates = candidates.filter(c => {
      if (seenSlugs.has(c.targetSlug)) return false;
      seenSlugs.add(c.targetSlug);
      return true;
    });

    const toInsert = uniqueCandidates.slice(0, linksNeeded);
    if (toInsert.length === 0) continue;

    // Insert links into the body
    let lines = article.body.split('\n');
    let linksAdded = 0;
    const usedLines = new Set();

    for (const candidate of toInsert) {
      const insertions = findInsertionPoints(article.body, candidate.topic, existingLinkedSlugs);
      if (insertions.length > 0) {
        // Pick the first match that's not on an already-used line
        const insertion = insertions.find(ins => !usedLines.has(ins.lineIndex)) || insertions[0];
        if (usedLines.has(insertion.lineIndex) && insertions.length === 1) continue;

        const line = lines[insertion.lineIndex];
        const linkText = insertion.matchText;
        const linkUrl = `/blog/${candidate.targetSlug}/`;
        const replacement = `[${linkText}](${linkUrl})`;

        // Replace only the first occurrence of the match text on this line
        const escaped = linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const lineRe = new RegExp(`(?<!\\[)\\b${escaped}\\b(?!\\]\\()`, 'i');
        const newLine = line.replace(lineRe, replacement);

        if (newLine !== line) {
          lines[insertion.lineIndex] = newLine;
          usedLines.add(insertion.lineIndex);
          linksAdded++;
        }
      } else {
        // No inline match found — append a contextual sentence at end of a relevant paragraph
        // Find a good paragraph in the body to append after
        const bodyParagraphs = [];
        let inCodeBlock = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
          if (inCodeBlock) continue;
          // Look for end of paragraphs (non-empty line followed by empty line or heading)
          if (lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('|') &&
              !lines[i].startsWith('![') && !lines[i].startsWith('-') && !lines[i].startsWith('*') &&
              !usedLines.has(i)) {
            const nextLine = lines[i + 1];
            if (!nextLine || nextLine.trim() === '' || nextLine.startsWith('#') || nextLine.startsWith('##')) {
              bodyParagraphs.push(i);
            }
          }
        }

        if (bodyParagraphs.length > 0) {
          // Pick a paragraph in the middle of the article (not too early, not too late)
          const midIdx = Math.floor(bodyParagraphs.length * 0.4) + linksAdded;
          const targetIdx = bodyParagraphs[Math.min(midIdx, bodyParagraphs.length - 1)];

          const contextSentence = generateContextSentence(candidate.target, article.dept);
          lines[targetIdx] = lines[targetIdx] + ' ' + contextSentence;
          usedLines.add(targetIdx);
          linksAdded++;
        }
      }
    }

    if (linksAdded > 0) {
      const newBody = lines.join('\n');
      const newRaw = `---\n${article.frontmatter}\n---\n${newBody}`;

      if (!DRY_RUN) {
        fs.writeFileSync(article.filePath, newRaw);
      }
      articlesModified++;
      totalLinksAdded += linksAdded;

      const finalCount = existingCount + linksAdded;
      console.log(`  ${article.slug}: +${linksAdded} links (${existingCount} → ${finalCount})`);
    }
  }

  console.log(`\nDone. Modified ${articlesModified} articles, added ${totalLinksAdded} internal links.`);
  if (DRY_RUN) console.log('(Dry run — no files were modified)');
}

// ── Generate a natural contextual sentence for appending ────────────
function generateContextSentence(target, sourceDept) {
  const templates = [
    `For related guidance, see our guide on [${target.title}](/blog/${target.slug}/).`,
    `If this applies to your team, our [${target.title}](/blog/${target.slug}/) guide covers the details.`,
    `For more on this topic, check out [${target.title}](/blog/${target.slug}/).`,
    `Our guide on [${target.title}](/blog/${target.slug}/) explores this further.`,
  ];

  // Cross-department templates
  if (target.dept !== sourceDept) {
    const crossTemplates = [
      `Teams in ${target.dept} face similar challenges — see [${target.title}](/blog/${target.slug}/).`,
      `This also connects to ${target.dept} workflows; our [${target.title}](/blog/${target.slug}/) guide covers the overlap.`,
    ];
    templates.push(...crossTemplates);
  }

  // Pick deterministically based on slug hash
  const hash = target.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return templates[hash % templates.length];
}

main();
