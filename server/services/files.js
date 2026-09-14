'use strict';
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { BUILD_ARTIFACTS } = require('../config');
const { validName } = require('./projects');

/** Resolve a project-relative path safely (no escapes, no absolute parts). */
function safePath(project, rel) {
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (clean.includes('..') || path.isAbsolute(clean)) return null;
  const abs = path.join(project.dir, clean);
  if (!abs.startsWith(project.dir)) return null;
  return abs;
}

function isArtifact(name) {
  const ext = path.extname(name).toLowerCase();
  if (/\.(synctex\.gz|fdb_latexmk)$/i.test(name)) return true;
  return BUILD_ARTIFACTS.has(ext);
}

/** Build a nested file tree, hiding TeX build artifacts. */
function buildTree(project) {
  const node = { name: project.name || project.id, type: 'folder', children: readDir(project, project.dir) };
  return node;
}

function readDir(project, absDir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === '.csleaf.json' || isArtifact(e.name)) continue;
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      out.push({ name: e.name, path: relPath(project, abs), type: 'folder', children: readDir(project, abs) });
    } else if (e.isFile()) {
      let size = 0, mtime = 0;
      try { const st = fs.statSync(abs); size = st.size; mtime = st.mtimeMs; } catch {}
      out.push({ name: e.name, path: relPath(project, abs), type: 'file', size, mtime });
    }
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

function relPath(project, abs) { return path.relative(project.dir, abs).replace(/\\/g, '/'); }

function readFile(project, rel) {
  const abs = safePath(project, rel);
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  const buf = fs.readFileSync(abs);
  const isText = isTextFile(rel) || looksLikeText(buf);
  if (!isText) return { binary: true, base64: buf.toString('base64'), size: buf.length };
  return { binary: false, content: buf.toString('utf8') };
}

function looksLikeText(buf) {
  const sample = buf.slice(0, 4096);
  let suspicious = 0;
  const n = Math.min(sample.length, 4096);
  for (let i = 0; i < n; i++) {
    const b = sample[i];
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) suspicious++;
  }
  return suspicious / Math.max(n, 1) < 0.05;
}

const TEXT_EXTS = new Set([
  '.tex', '.bib', '.sty', '.cls', '.txt', '.md', '.json', '.yaml', '.yml',
  '.csv', '.tsv', '.tikz', '.lua', '.py', '.dat', '.dtx', '.ins', '.bbx', '.cbx', '.xml',
]);
function isTextFile(name) { return TEXT_EXTS.has(path.extname(name).toLowerCase()); }

function writeFile(project, rel, content) {
  const abs = safePath(project, rel);
  if (!abs) throw new Error('Invalid path');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content ?? '', 'utf8');
}

function createEntry(project, rel, type) {
  const abs = safePath(project, rel);
  if (!abs) throw new Error('Invalid path');
  const name = path.basename(rel);
  if (!validName(name)) throw new Error('Invalid name');
  if (fs.existsSync(abs)) throw new Error('Already exists');
  if (type === 'folder') { fs.mkdirSync(abs, { recursive: true }); return; }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '% New file\n', 'utf8');
}

function renameEntry(project, rel, newName) {
  const abs = safePath(project, rel);
  if (!abs || !fs.existsSync(abs)) throw new Error('Not found');
  if (!validName(newName)) throw new Error('Invalid name');
  const dest = path.join(path.dirname(abs), newName);
  if (fs.existsSync(dest)) throw new Error('Already exists');
  fs.renameSync(abs, dest);
}

function deleteEntry(project, rel) {
  const abs = safePath(project, rel);
  if (!abs || abs === project.dir || !fs.existsSync(abs)) throw new Error('Not found');
  fs.rmSync(abs, { recursive: true, force: true });
}

function saveUploaded(project, targetDirRel, file) {
  const dirAbs = safePath(project, targetDirRel || '');
  if (!dirAbs) throw new Error('Invalid target');
  const name = file.originalname.replace(/[\\/:*?"<>|]/g, '_');
  fs.mkdirSync(dirAbs, { recursive: true });
  fs.writeFileSync(path.join(dirAbs, name), file.buffer);
  return path.join(targetDirRel || '', name).replace(/\\/g, '/');
}

function exportZip(project) {
  const zip = new AdmZip();
  addDirToZip(project, project.dir, '', zip);
  return zip.toBuffer();
}

function addDirToZip(project, absDir, relPrefix, zip) {
  for (const e of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (e.name === '.csleaf.json' || isArtifact(e.name)) continue;
    const abs = path.join(absDir, e.name);
    const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
    if (e.isDirectory()) addDirToZip(project, abs, rel, zip);
    else zip.addLocalFile(abs, relPrefix || '');
  }
}

/** Remove TeX build artifacts (clean project). Returns count. */
function cleanArtifacts(project) {
  let removed = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { walk(abs); continue; }
      if (isArtifact(e.name)) { fs.rmSync(abs); removed++; }
    }
  };
  walk(project.dir);
  return removed;
}

// ---- .bib parsing for the citation helper ----
function parseBibFile(content) {
  const entries = [];
  const re = /@(\w+)\s*[{(]\s*([^,\s]+)\s*,([^@}]*)/g;
  let m;
  while ((m = re.exec(content))) {
    const type = m[1].toLowerCase();
    if (type === 'comment' || type === 'preamble' || type === 'string') continue;
    const body = m[3];
    const field = (name) => {
      const fm = body.match(new RegExp(`${name}\\s*=\\s*([{"])([\\s\\S]*?)\\1`, 'i'));
      return fm ? fm[2].replace(/\s+/g, ' ').trim() : '';
    };
    entries.push({
      key: m[2],
      type,
      title: field('title').replace(/[{}]/g, ''),
      author: field('author').replace(/[{}]/g, ''),
      year: field('year'),
      journal: (field('journal') || field('booktitle')).replace(/[{}]/g, ''),
    });
  }
  return entries;
}

module.exports = {
  buildTree, readFile, writeFile, createEntry, renameEntry, deleteEntry,
  saveUploaded, exportZip, cleanArtifacts, parseBibFile, safePath, isArtifact,
};
