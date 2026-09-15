'use strict';
/**
 * Template service: built-in templates (templates/) + user templates
 * (workspace/.my-templates/), detail/source access and compile previews.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TEMPLATES_DIR, WORKSPACE_DIR, BUILD_ARTIFACTS } = require('../config');
const tex = require('./tex');

const CUSTOM_DIR = path.join(WORKSPACE_DIR, '.my-templates');
const PREVIEW_DIR = path.join(WORKSPACE_DIR, '.preview-cache');
const previewLocks = new Set();

function isArtifact(name) {
  if (/\.(synctex\.gz|fdb_latexmk)$/i.test(name)) return true;
  return BUILD_ARTIFACTS.has(path.extname(name).toLowerCase());
}

function safeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : null;
}

function readTemplateInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, 'templates.json'), 'utf8'));
  } catch { return []; }
}

function readCustomMeta(dir) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, '.csleaf-template.json'), 'utf8'));
    return meta && meta.id ? meta : null;
  } catch { return null; }
}

/** All templates: built-ins + user templates. */
function listTemplates() {
  const builtins = readTemplateInfo().map(t => {
    const dir = path.join(TEMPLATES_DIR, t.id);
    return { ...t, builtin: true, custom: false, available: fs.existsSync(path.join(dir, 'main.tex')) };
  });
  const customs = [];
  try {
    for (const e of fs.readdirSync(CUSTOM_DIR, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const meta = readCustomMeta(path.join(CUSTOM_DIR, e.name));
      if (meta) customs.push({ ...meta, builtin: false, custom: true, available: true, template: 'custom' });
    }
  } catch {}
  customs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return [...customs, ...builtins];
}

function findTemplate(id) {
  const sid = safeId(id);
  if (!sid) return null;
  return listTemplates().find(t => t.id === sid) || null;
}

function templateDir(id) {
  const t = findTemplate(id);
  if (!t || !t.available) return null;
  return t.custom ? path.join(CUSTOM_DIR, id) : path.join(TEMPLATES_DIR, id);
}

/** Recursive file list (relative, forward slashes). */
function listFiles(id) {
  const dir = templateDir(id);
  if (!dir) return [];
  const out = [];
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(abs, e.name), r);
      else {
        let size = 0;
        try { size = fs.statSync(path.join(abs, e.name)).size; } catch {}
        out.push({ path: r, size });
      }
    }
  };
  try { walk(dir, ''); } catch {}
  return out;
}

function readFile(id, rel) {
  const dir = templateDir(id);
  if (!dir) return null;
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('..')) return null;
  const abs = path.join(dir, clean);
  if (!abs.startsWith(dir) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  if (!isArtifact(path.basename(clean))) return fs.readFileSync(abs, 'utf8');
  return null;
}

/** Compile the template once and cache page-ready PDF (workspace/.preview-cache). */
async function previewPdf(id) {
  const t = findTemplate(id);
  const dir = templateDir(id);
  if (!t || !dir) throw new Error('template not found');
  const sid = safeId(id);

  const mainPath = path.join(dir, t.mainFile || 'main.tex');
  const mtime = fs.existsSync(mainPath) ? fs.statSync(mainPath).mtimeMs : 0;
  const sig = crypto.createHash('md5').update(`${sid}|${mtime}|${t.compiler}`).digest('hex').slice(0, 10);
  const cached = path.join(PREVIEW_DIR, `${sid}-${sig}.pdf`);
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });

  if (fs.existsSync(cached)) return cached;

  if (previewLocks.has(sid)) {
    // another request is already compiling this template — wait for it
    for (let i = 0; i < 120 && previewLocks.has(sid); i++) await new Promise(r => setTimeout(r, 250));
    if (fs.existsSync(cached)) return cached;
    throw new Error('preview generation failed');
  }
  previewLocks.add(sid);
  try {
    const work = path.join(PREVIEW_DIR, `work-${sid}`);
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    copyTemplateDir(dir, work);
    const compiler = t.compiler || 'latexmk';
    const result = await tex.compileProject(
      { id: `tpl-preview-${sid}`, dir: work },
      { rootFile: t.mainFile || 'main.tex', compiler },
      null,
    );
    if (!result.pdf) throw new Error(result.message || 'preview compile failed');
    fs.copyFileSync(path.join(work, result.pdf), cached);
    fs.rmSync(work, { recursive: true, force: true });
    // prune old cache files for this template
    for (const f of fs.readdirSync(PREVIEW_DIR)) {
      if (f.startsWith(`${sid}-`) && f.endsWith('.pdf') && f !== path.basename(cached)) {
        try { fs.rmSync(path.join(PREVIEW_DIR, f)); } catch {}
      }
    }
    return cached;
  } finally {
    previewLocks.delete(sid);
  }
}

function copyTemplateDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.') || isArtifact(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyTemplateDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Save a project as a reusable user template. */
function saveCustomTemplate(project, { name, desc }) {
  fs.mkdirSync(CUSTOM_DIR, { recursive: true });
  const id = crypto.randomBytes(5).toString('hex');
  const dir = path.join(CUSTOM_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  // copy project contents, skipping metadata + build artifacts
  copyProjectDir(project.dir, dir);
  const meta = {
    id, name: (name || `${project.name} template`).slice(0, 60),
    desc: (desc || '').slice(0, 200),
    compiler: project.compiler || 'latexmk',
    mainFile: project.mainFile || 'main.tex',
    createdAt: Date.now(),
    custom: true,
  };
  fs.writeFileSync(path.join(dir, '.csleaf-template.json'), JSON.stringify(meta, null, 2), 'utf8');
  return meta;
}

function copyProjectDir(src, dest) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.csleaf.json' || e.name.startsWith('.')) continue;
    if (e.isFile() && isArtifact(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyProjectDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function deleteCustomTemplate(id) {
  const sid = safeId(id);
  if (!sid) throw new Error('invalid id');
  const dir = path.join(CUSTOM_DIR, sid);
  if (!dir.startsWith(CUSTOM_DIR) || !fs.existsSync(dir)) throw new Error('not found');
  const meta = readCustomMeta(dir);
  if (!meta) throw new Error('not a user template');
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = {
  listTemplates, findTemplate, templateDir, listFiles, readFile,
  previewPdf, saveCustomTemplate, deleteCustomTemplate, copyTemplateDir,
};
