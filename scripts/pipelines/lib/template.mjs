/**
 * Simple {{variable}} template engine for pipeline definitions.
 * Supports dot-notation (e.g. {{seo_brief.identifier}}) and built-in variables.
 */

const BUILTINS = {
  TODAY: () => new Date().toISOString().split('T')[0],
  NOW: () => new Date().toISOString(),
  WEEKDAY: () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()],
};

/**
 * Resolve all {{var}} placeholders in a string.
 * @param {string} text - Template string
 * @param {object} context - Variable context (supports nested via dot-notation)
 * @returns {string} Resolved string
 */
export function resolve(text, context = {}) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key) => {
    // Try context first (supports dot-notation)
    const parts = key.split('.');
    let val = context;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') { val = undefined; break; }
      val = val[p];
    }
    if (val !== undefined) return String(val);

    // Try builtins
    if (BUILTINS[key]) return BUILTINS[key]();

    // Leave unresolved (may be resolved in a later pass)
    return match;
  });
}

/**
 * Resolve a description field (string or array of strings) into a single string.
 * @param {string|string[]} desc - Description field from JSON definition
 * @param {object} context - Variable context
 * @returns {string} Resolved description
 */
export function resolveDescription(desc, context = {}) {
  if (Array.isArray(desc)) {
    return resolve(desc.join('\n'), context);
  }
  return resolve(desc || '', context);
}
