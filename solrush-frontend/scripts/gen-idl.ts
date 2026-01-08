import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const idlSource = path.resolve(root, '..', 'solrush-dex', 'target', 'idl', 'solrush_dex.json');
const idlTargetDir = path.resolve(root, 'public', 'idl');
const idlTarget = path.resolve(idlTargetDir, 'solrush_dex.json');

if (!fs.existsSync(idlSource)) {
  throw new Error(`IDL not found at ${idlSource}. Run anchor build first.`);
}

const idlRaw = fs.readFileSync(idlSource, 'utf8');
const idl = JSON.parse(idlRaw);

if (!idl.types) {
  throw new Error('IDL missing `types`. Ensure Anchor is up to date and rebuild.');
}

fs.mkdirSync(idlTargetDir, { recursive: true });
fs.writeFileSync(idlTarget, JSON.stringify(idl, null, 2));

console.log(`IDL copied to ${idlTarget}`);
