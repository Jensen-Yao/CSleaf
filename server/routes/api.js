'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getSettings, saveSettings, WORKSPACE_DIR } = require('../config');
const tex = require('../services/tex');
const projects = require('../services/projects');
const files = require('../services/files');
const templatesSvc = require('../services/templates');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const router = express.Router();

// ---------- system ----------
router.get('/system/tex', (req, res) => {
  const det = tex.detectTeX(req.query.force === '1');
  res.json(det);
});

router.get('/settings', (req, res) => res.json(getSettings()));
router.put('/settings', (req, res) => {
  const allowed = ['texPath', 'compiler', 'timeoutMs', 'autoCompile', 'autoOpenBrowser'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  res.json(saveSettings(patch));
});

// ---------- templates ----------
router.get('/templates', (req, res) => res.json(templatesSvc.listTemplates()));

router.get('/templates/:id/detail', (req, res) => {
  const t = templatesSvc.findTemplate(req.params.id);
  if (!t || !t.available) return res.status(404).json({ error: 'Template not found' });
  res.json({ ...t, files: templatesSvc.listFiles(req.params.id) });
});

router.get('/templates/:id/file', (req, res) => {
  try {
    const content = templatesSvc.readFile(req.params.id, req.query.path);
    if (content == null) return res.status(404).json({ error: 'File not found' });
    res.json({ content });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/templates/:id/preview.pdf', async (req, res) => {
  try {
    const pdfPath = await templatesSvc.previewPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(fs.readFileSync(pdfPath));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/templates/custom', (req, res) => {
  const p = projects.getProject(req.body?.projectId);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    res.json(templatesSvc.saveCustomTemplate(p, { name: req.body.name, desc: req.body.desc }));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/templates/custom/:id', (req, res) => {
  try {
    templatesSvc.deleteCustomTemplate(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/templates/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json(templatesSvc.importTemplateFromZip(req.file.buffer, req.body?.name));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- projects ----------
router.get('/projects', (req, res) => res.json(projects.listProjects()));

router.post('/projects', (req, res) => {
  try {
    const { name, template, compiler } = req.body || {};
    const p = projects.createProject({ name, template, compiler });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/projects/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const p = projects.importProjectFromZip(req.file.buffer, req.body?.name);
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch('/projects/:id', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    if (req.body?.name) projects.renameProject(p, req.body.name);
    if (req.body?.mainFile !== undefined || req.body?.compiler !== undefined) {
      projects.updateProjectConfig(p, { mainFile: req.body.mainFile, compiler: req.body.compiler });
    }
    res.json(projects.getProject(req.params.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/projects/:id/duplicate', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(projects.duplicateProject(p));
});

router.delete('/projects/:id', async (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    tex.cancelCompile(p.id);
    // wait for the in-flight compile to fully exit (releases file handles on Windows)
    for (let i = 0; i < 20 && tex.isCompiling(p.id); i++) {
      await new Promise(r => setTimeout(r, 150));
    }
    projects.deleteProject(p);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- files ----------
router.get('/projects/:id/tree', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json({ name: p.name, mainFile: p.mainFile, compiler: p.compiler, tree: files.buildTree(p) });
});

router.get('/projects/:id/file', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    const f = files.readFile(p, req.query.path);
    if (!f) return res.status(404).json({ error: 'File not found' });
    res.json(f);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/projects/:id/file', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    files.writeFile(p, req.body.path, req.body.content);
    projects.touchProject(p);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/projects/:id/file', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    files.createEntry(p, req.body.path, req.body.type || 'file');
    projects.touchProject(p);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch('/projects/:id/file', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    files.renameEntry(p, req.body.path, req.body.newName);
    projects.touchProject(p);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/projects/:id/file', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    files.deleteEntry(p, req.query.path);
    projects.touchProject(p);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/projects/:id/upload', upload.array('files', 20), (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    const saved = (req.files || []).map(f => files.saveUploaded(p, req.body.targetDir, f));
    projects.touchProject(p);
    res.json({ ok: true, saved });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/projects/:id/export', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const buf = files.exportZip(p);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(p.name)}.zip"`);
  res.send(buf);
});

router.post('/projects/:id/clean', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json({ ok: true, removed: files.cleanArtifacts(p) });
});

// ---------- bibliography ----------
router.get('/projects/:id/bib', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const rel = req.query.path;
  const abs = files.safePath(p, rel);
  if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: 'bib file not found' });
  const entries = files.parseBibFile(fs.readFileSync(abs, 'utf8'));
  res.json({ entries });
});

// ---------- compile ----------
router.post('/projects/:id/compile', async (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  if (tex.isCompiling(p.id)) return res.status(409).json({ error: 'A compile is already running', compiling: true });
  const rootFile = req.body?.root || p.mainFile || 'main.tex';
  const compiler = req.body?.compiler || p.compiler || 'latexmk';
  try {
    const result = await tex.compileProject(p, { rootFile, compiler },
      (phase, message) => broadcast({ type: 'compile', projectId: p.id, phase, message }));
    projects.touchProject(p);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Compile failed' });
  }
});

router.post('/projects/:id/compile/cancel', (req, res) => {
  res.json({ ok: tex.cancelCompile(req.params.id) });
});

router.get('/projects/:id/compile/status', (req, res) => {
  res.json({ compiling: tex.isCompiling(req.params.id) });
});

// ---------- synctex ----------
router.post('/projects/:id/synctex/view', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(tex.synctexView(p, req.body.pdf, req.body.file, req.body.line, req.body.col));
});

router.post('/projects/:id/synctex/edit', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(tex.synctexEdit(p, req.body.pdf, req.body.page, req.body.x, req.body.y));
});

// ---------- pdf / raw file download ----------
router.get('/projects/:id/pdf', (req, res) => {
  const p = projects.getProject(req.params.id);
  if (!p) return res.status(404).end();
  const abs = files.safePath(p, req.query.file || p.mainFile.replace(/\.tex$/, '.pdf'));
  if (!abs || !abs.toLowerCase().endsWith('.pdf') || !fs.existsSync(abs)) return res.status(404).end();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'no-store');
  res.send(fs.readFileSync(abs));
});

// websocket broadcast helper (wired by index.js)
let broadcast = () => {};
function setBroadcaster(fn) { broadcast = fn; }

module.exports = { router, setBroadcaster };
