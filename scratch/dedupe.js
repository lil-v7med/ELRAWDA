import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'src', 'services', 'translations.ts');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const header = [];
const footer = [];
const objLines = [];

let inObject = false;
for (const line of lines) {
  if (line.includes('export const translations:')) {
    header.push(line);
    inObject = true;
    continue;
  }
  if (inObject) {
    if (line.trim() === '};') {
      footer.push(line);
      inObject = false;
      continue;
    }
    objLines.push(line);
  } else {
    if (footer.length > 0) {
      footer.push(line);
    } else {
      header.push(line);
    }
  }
}

const seenKeys = new Set();
const uniqueLines = [];

for (const line of objLines) {
  const match = line.match(/^\s*"([^"]+)"\s*:/) || line.match(/^\s*'([^']+)'\s*:/);
  if (match) {
    const key = match[1];
    if (seenKeys.has(key)) {
      console.log('Removing duplicate key:', key);
      continue;
    }
    seenKeys.add(key);
  }
  uniqueLines.push(line);
}

const newContent = [...header, ...uniqueLines, ...footer].join('\n');
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Deduplication completed successfully!');
