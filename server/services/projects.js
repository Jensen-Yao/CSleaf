'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { WORKSPACE_DIR, TEMPLATES_DIR } = require('../config');

function id() { return crypto.randomBytes(6).toString('hex'); }

function validName(name) {
  return !!name && name.length <= 80 && !/[\\/:*?"<>|]/.test(name);
}

function projectMetaFile(dir) { return path.join(dir, '.csleaf.json'); }

function readMeta(dir) {
  try { return JSON.parse(fs.readFileSync(projectMetaFile(dir), 'utf8')); } catch { return null; }
}
function writeMeta(dir, meta) {
  fs.writeFileSync(projectMetaFile(dir), JSON.stringify(meta, null, 2), 'utf8');
}

/** List all projects (scan workspace folders containing .csleaf.json). */
function listProjects() {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  const projects = [];
  for (const entry of fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(WORKSPACE_DIR, entry.name);
    const meta = readMeta(dir);
    if (!meta) continue;
    projects.push({
      id: meta.id, name: meta.name, template: meta.template || 'blank',
      mainFile: meta.mainFile || 'main.tex', compiler: meta.compiler || 'latexmk',
      createdAt: meta.createdAt, updatedAt: meta.updatedAt,
    });
  }
  projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return projects;
}

function getProject(projectId) {
  const dir = path.join(WORKSPACE_DIR, projectId);
  // id doubles as folder name — refuse anything path-like
  if (path.dirname(dir) !== WORKSPACE_DIR || projectId.includes('\\') || projectId.includes('/')) return null;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const meta = readMeta(dir);
  if (!meta || meta.id !== projectId) return null;
  return { id: projectId, dir, ...meta };
}

function findMainTex(dir) {
  // prefer a top-level file with \documentclass; fall back to any .tex with one
  const top = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.tex'));
  for (const e of top) {
    try {
      if (fs.readFileSync(path.join(dir, e.name), 'utf8').includes('\\documentclass')) return e.name;
    } catch {}
  }
  if (top.length) return top[0].name;
  // search one level of subfolders
  const subdirs = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory());
  for (const sd of subdirs) {
    try {
      for (const e of fs.readdirSync(path.join(dir, sd.name))) {
        if (e.endsWith('.tex') && fs.readFileSync(path.join(dir, sd.name, e), 'utf8').includes('\\documentclass')) {
          return path.join(sd.name, e).replace(/\\/g, '/');
        }
      }
    } catch {}
  }
  return null;
}

const TEMPLATE_INFO = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, 'templates.json'), 'utf8'));
  } catch { return []; }
})();

function listTemplates() {
  return TEMPLATE_INFO.map(t => {
    const exists = fs.existsSync(path.join(TEMPLATES_DIR, t.id, 'main.tex'));
    return { ...t, available: exists };
  });
}

function createProject({ name, template = 'blank', compiler }) {
  if (!validName(name)) throw new Error('Invalid project name');
  const pid = id();
  const dir = path.join(WORKSPACE_DIR, pid);
  fs.mkdirSync(dir, { recursive: true });

  const tplId = TEMPLATE_INFO.some(t => t.id === template) ? template : 'blank';
  const tplDir = path.join(TEMPLATES_DIR, tplId);
  if (fs.existsSync(tplDir)) {
    copyDir(tplDir, dir, ['.csleaf.json']);
  }
  const metaTpl = readMeta(tplDir) || {};
  const mainFile = metaTpl.mainFile || findMainTex(dir) || 'main.tex';
  const now = Date.now();
  writeMeta(dir, {
    id: pid, name, template: tplId, mainFile,
    compiler: compiler || metaTpl.compiler || 'latexmk',
    createdAt: now, updatedAt: now,
  });
  return { id: pid, name, template: tplId, mainFile, compiler: compiler || metaTpl.compiler || 'latexmk', createdAt: now, updatedAt: now };
}

function copyDir(src, dest, skipNames = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipNames.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, skipNames);
    else fs.copyFileSync(s, d);
  }
}

function importProjectFromZip(zipBuffer, name) {
  const zip = new AdmZip(zipBuffer);
  const pid = id();
  const dir = path.join(WORKSPACE_DIR, pid);
  fs.mkdirSync(dir, { recursive: true });

  let count = 0;
  for (const entry of zip.getEntries()) {
    const entryName = entry.entryName.replace(/\\/g, '/');
    if (entry.isDirectory) continue;
    if (entryName.includes('__MACOSX') || entryName.split('/').some(p => p.startsWith('.') && p !== '.')) continue;
    // flatten a single top-level wrapper folder (common in GitHub zips)
    const parts = entryName.split('/').filter(Boolean);
    if (!parts.length) continue;
    let rel = parts.join('/');
    const topDirs = new Set(
      zip.getEntries()
        .map(e => e.entryName.replace(/\\/g, '/').split('/').filter(Boolean)[0])
        .filter(p => zip.getEntries().some(e2 => e2.entryName.replace(/\\/g, '/').split('/').filter(Boolean).length > 1 && e2.entryName.startsWith(p + '/')))
    );
    if (topDirs.size === 1 && parts[0] === [...topDirs][0]) rel = parts.slice(1).join('/');
    if (!rel || rel.startsWith('..')) continue;
    const dest = path.join(dir, rel);
    if (path.dirname(dest) !== dir && !path.dirname(dest).startsWith(dir)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
    count++;
  }
  if (count === 0) { fs.rmSync(dir, { recursive: true, force: true }); throw new Error('Zip archive is empty'); }

  const mainFile = findMainTex(dir) || 'main.tex';
  const now = Date.now();
  const projName = validName(name) ? name : `Imported ${new Date().toISOString().slice(0, 10)}`;
  writeMeta(dir, { id: pid, name: projName, template: 'imported', mainFile, compiler: 'latexmk', createdAt: now, updatedAt: now });
  return { id: pid, name: projName, mainFile };
}

function renameProject(project, newName) {
  if (!validName(newName)) throw new Error('Invalid project name');
  const meta = readMeta(project.dir);
  meta.name = newName;
  meta.updatedAt = Date.now();
  writeMeta(project.dir, meta);
}

function touchProject(project) {
  try {
    const meta = readMeta(project.dir);
    if (meta) { meta.updatedAt = Date.now(); writeMeta(project.dir, meta); }
  } catch {}
}

function deleteProject(project) {
  fs.rmSync(project.dir, { recursive: true, force: true });
}

function duplicateProject(project) {
  const pid = id();
  const dir = path.join(WORKSPACE_DIR, pid);
  copyDir(project.dir, dir, ['.csleaf.json']);
  const now = Date.now();
  writeMeta(dir, { id: pid, name: `${project.name} (copy)`, template: project.template, mainFile: project.mainFile, compiler: project.compiler, createdAt: now, updatedAt: now });
  return { id: pid, name: `${project.name} (copy)` };
}

function updateProjectConfig(project, patch) {
  const meta = readMeta(project.dir);
  if (patch.mainFile !== undefined) meta.mainFile = patch.mainFile;
  if (patch.compiler !== undefined) meta.compiler = patch.compiler;
  meta.updatedAt = Date.now();
  writeMeta(project.dir, meta);
}

module.exports = {
  listProjects, getProject, createProject, importProjectFromZip,
  renameProject, deleteProject, duplicateProject, updateProjectConfig,
  listTemplates, findMainTex, touchProject, validName,
};
