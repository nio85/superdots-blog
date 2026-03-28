#!/usr/bin/env node

/**
 * Google Drive CLI wrapper for Superdots agents.
 * Uses service account auth via googleapis.
 *
 * Usage:
 *   node scripts/tools/gdrive.mjs list [folderId]
 *   node scripts/tools/gdrive.mjs search <query>
 *   node scripts/tools/gdrive.mjs read <fileId>
 *   node scripts/tools/gdrive.mjs create-doc <name> <folderId> <content>
 *   node scripts/tools/gdrive.mjs upload <name> <folderId> <filepath>
 *   node scripts/tools/gdrive.mjs mkdir <name> [parentId]
 */

import { google } from 'googleapis';
import { readFileSync, createReadStream } from 'fs';
import { basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_FOLDER = '16hrle1lTNjRr-IDDXDbV74XYYkhpTJJW';

const MIME_MAP = {
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.mjml': 'text/plain',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
};

const IMPERSONATE_USER = 'lucavittorio.bartoccini@superdots.sh';

async function getAuth() {
  const keyFile = process.env.GCP_KEY_FILE;
  if (!keyFile) {
    console.error('Error: GCP_KEY_FILE env var not set. Run: source .env');
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(keyFile, 'utf8'));
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: IMPERSONATE_USER,
  });
  return auth;
}

async function getDrive() {
  const auth = await getAuth();
  return google.drive({ version: 'v3', auth });
}

async function listFiles(folderId) {
  const drive = await getDrive();
  const id = folderId || ROOT_FOLDER;
  const res = await drive.files.list({
    q: `'${id}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
  });
  if (!res.data.files?.length) {
    console.log('No files found.');
    return;
  }
  console.log(`Files in folder ${id}:\n`);
  for (const f of res.data.files) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    const size = f.size ? ` (${(parseInt(f.size) / 1024).toFixed(1)}KB)` : '';
    const icon = isFolder ? '[DIR]' : '     ';
    console.log(`${icon} ${f.name}  ${f.id}  ${f.modifiedTime}${size}`);
  }
}

async function searchFiles(query) {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, parents)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });
  if (!res.data.files?.length) {
    console.log('No files found.');
    return;
  }
  for (const f of res.data.files) {
    console.log(`${f.name}  ${f.id}  ${f.mimeType}  ${f.modifiedTime}`);
  }
}

async function readFile(fileId) {
  const drive = await getDrive();
  const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType,modifiedTime,size' });
  console.log(JSON.stringify(meta.data, null, 2));

  if (meta.data.mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' });
    console.log('\n--- Content ---\n');
    console.log(res.data);
  } else if (meta.data.mimeType?.startsWith('text/')) {
    const res = await drive.files.get({ fileId, alt: 'media' });
    console.log('\n--- Content ---\n');
    console.log(res.data);
  }
}

async function createDoc(name, folderId, content) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId || ROOT_FOLDER],
    },
    media: {
      mimeType: 'text/plain',
      body: content,
    },
    fields: 'id, name, webViewLink',
  });
  console.log(`Created: ${res.data.name}`);
  console.log(`ID: ${res.data.id}`);
  console.log(`Link: ${res.data.webViewLink}`);
}

async function uploadFile(name, folderId, filepath) {
  const drive = await getDrive();
  const ext = extname(filepath).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId || ROOT_FOLDER],
    },
    media: {
      mimeType,
      body: createReadStream(filepath),
    },
    fields: 'id, name, webViewLink, size',
  });
  console.log(`Uploaded: ${res.data.name}`);
  console.log(`ID: ${res.data.id}`);
  if (res.data.webViewLink) console.log(`Link: ${res.data.webViewLink}`);
}

async function mkDir(name, parentId) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId || ROOT_FOLDER],
    },
    fields: 'id, name, webViewLink',
  });
  console.log(`Created folder: ${res.data.name}`);
  console.log(`ID: ${res.data.id}`);
  if (res.data.webViewLink) console.log(`Link: ${res.data.webViewLink}`);
}

const [,, command, ...args] = process.argv;

try {
  switch (command) {
    case 'list':
      await listFiles(args[0]);
      break;
    case 'search':
      if (!args[0]) { console.error('Usage: search <query>'); process.exit(1); }
      await searchFiles(args.join(' '));
      break;
    case 'read':
      if (!args[0]) { console.error('Usage: read <fileId>'); process.exit(1); }
      await readFile(args[0]);
      break;
    case 'create-doc':
      if (args.length < 3) { console.error('Usage: create-doc <name> <folderId> <content>'); process.exit(1); }
      await createDoc(args[0], args[1], args.slice(2).join(' '));
      break;
    case 'upload':
      if (args.length < 3) { console.error('Usage: upload <name> <folderId> <filepath>'); process.exit(1); }
      await uploadFile(args[0], args[1], args[2]);
      break;
    case 'mkdir':
      if (!args[0]) { console.error('Usage: mkdir <name> [parentId]'); process.exit(1); }
      await mkDir(args[0], args[1]);
      break;
    default:
      console.log(`Google Drive CLI

Commands:
  list [folderId]                    List files (default: root)
  search <query>                     Search files by name
  read <fileId>                      Read file metadata/content
  create-doc <name> <folderId> <content>  Create a Google Doc
  upload <name> <folderId> <filepath>     Upload a local file
  mkdir <name> [parentId]            Create a folder`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
