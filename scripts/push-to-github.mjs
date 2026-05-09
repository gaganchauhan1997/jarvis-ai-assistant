import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const OWNER = 'gaganchauhan1997';
const REPO = 'jarvis-ai-assistant';
const BRANCH = 'main';
const TOKEN = process.env.GITHUB_TOKEN;
const BASE = '/home/runner/workspace';

const EXCLUDE = [
  '.git', 'node_modules', '.local', 'dist', '.cache',
  'tsconfig.tsbuildinfo', '.replit-artifact',
  'pnpm-lock.yaml',
];

function getAllFiles(dir, fileList = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.some(ex => entry.name === ex || entry.name.endsWith('.map') || entry.name.endsWith('.log'))) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function ghApi(path, method = 'GET', body = null) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function createBlob(content, encoding = 'base64') {
  const data = await ghApi(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', { content, encoding });
  return data.sha;
}

async function main() {
  console.log('Getting current HEAD...');
  const ref = await ghApi(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`);
  const baseCommitSha = ref.object.sha;
  const commit = await ghApi(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`);
  const baseTreeSha = commit.tree.sha;
  console.log(`Base commit: ${baseCommitSha}, tree: ${baseTreeSha}`);

  const allFiles = getAllFiles(BASE);
  console.log(`Found ${allFiles.length} files to push`);

  const treeItems = [];
  let i = 0;
  for (const filePath of allFiles) {
    const relPath = relative(BASE, filePath);
    i++;
    process.stdout.write(`\r[${i}/${allFiles.length}] ${relPath.substring(0, 60)}`);
    try {
      const content = readFileSync(filePath);
      const b64 = content.toString('base64');
      const sha = await createBlob(b64, 'base64');
      treeItems.push({ path: relPath, mode: '100644', type: 'blob', sha });
    } catch (e) {
      console.warn(`\nSkipping ${relPath}: ${e.message}`);
    }
  }
  console.log('\nCreating tree...');

  const newTree = await ghApi(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', {
    base_tree: baseTreeSha,
    tree: treeItems,
  });
  console.log(`New tree: ${newTree.sha}`);

  const newCommit = await ghApi(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: 'feat: Jarvis Voice AI - complete app with Gemini AI integration',
    tree: newTree.sha,
    parents: [baseCommitSha],
  });
  console.log(`New commit: ${newCommit.sha}`);

  const updateRef = await ghApi(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: newCommit.sha,
    force: true,
  });
  console.log('Done! Updated branch:', updateRef.ref);
}

main().catch(e => { console.error(e); process.exit(1); });
