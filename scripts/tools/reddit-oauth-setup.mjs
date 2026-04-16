#!/usr/bin/env node
/**
 * One-time Reddit OAuth2 setup helper.
 * Opens browser for authorization, captures the code, exchanges for refresh_token.
 *
 * Usage:
 *   node scripts/tools/reddit-oauth-setup.mjs
 *
 * Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env
 */

import '../config.mjs';
import { createServer } from 'http';
import { randomBytes } from 'crypto';

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDIRECT_URI = 'https://superdots.sh/oauth/callback';
const SCOPES = 'adsread,adsconversions,history,adsedit,read';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET in .env');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');

const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${CLIENT_ID}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&duration=permanent&scope=${encodeURIComponent(SCOPES)}`;

console.log('\n=== Reddit OAuth2 Setup ===\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Click "Allow" to authorize the app');
console.log('3. You will be redirected back here automatically\n');
console.log('Waiting for callback on port 8888...\n');

const server = createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, 'http://localhost:8888');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>Authorization denied: ${error}</h2><p>Close this tab.</p>`);
    console.error(`Authorization denied: ${error}`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>State mismatch — possible CSRF</h2>');
    console.error('State mismatch');
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>No authorization code received</h2>');
    server.close();
    process.exit(1);
  }

  console.log('Authorization code received. Exchanging for tokens...\n');

  try {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'superdots-ads/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
    }

    const data = await tokenRes.json();

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done! You can close this tab.</h2><p>Check the terminal for your tokens.</p>');

    console.log('=== SUCCESS ===\n');
    console.log('Add these to /home/luca/superdots-blog/.env:\n');
    console.log(`REDDIT_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`\nAccess token (temporary, auto-refreshed by reddit-ads.mjs):`);
    console.log(`  expires_in: ${data.expires_in}s`);
    console.log(`  scope: ${data.scope}`);
    console.log('\nNext: get your AD_ACCOUNT_ID from ads.reddit.com (URL bar after login)');
    console.log('Then add: REDDIT_AD_ACCOUNT_ID=<id>\n');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${e.message}</h2>`);
    console.error(e.message);
  }

  server.close();
});

server.listen(8877, () => {});
