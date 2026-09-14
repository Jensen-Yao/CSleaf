'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_DIR = process.env.CSLEAF_WORKSPACE || path.join(ROOT, 'workspace');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const WEB_DIST = path.join(ROOT, 'web', 'dist');
const SETTINGS_FILE = path.join(WORKSPACE_DIR, 'settings.json');

// Files produced by TeX compilers / bibTeX / latexmk — hidden from the file tree
const BUILD_ARTIFACTS = new Set([
  '.aux', '.log', '.out', '.synctex.gz', '.fls', '.fdb_latexmk', '.bbl', '.blg',
  '.toc', '.lof', '.lot', '.nav', '.snm', '.vrb', '.bcf', '.run.xml', '.xdv',
  '.idx', '.ilg', '.ind', '.glo', '.gls', '.acn', '.acr', '.alg', '.spl', '.tif',
]);

const DEFAULT_SETTINGS = {
  texPath: '',            // optional manual path to a directory containing the engines
  compiler: 'latexmk',    // latexmk | pdflatex | xelatex
  timeoutMs: 120000,      // compile timeout
  autoCompile: true,      // compile on save
  autoOpenBrowser: true,
  port: process.env.PORT || 4513,
};

function ensureDirs() {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

function loadSettings() {
  ensureDirs();
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settingsCache = null;
function getSettings() {
  if (!settingsCache) settingsCache = loadSettings();
  return settingsCache;
}
function saveSettings(patch) {
  settingsCache = { ...getSettings(), ...patch };
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsCache, null, 2), 'utf8');
  return settingsCache;
}

module.exports = {
  ROOT, WORKSPACE_DIR, TEMPLATES_DIR, WEB_DIST, SETTINGS_FILE,
  BUILD_ARTIFACTS, DEFAULT_SETTINGS,
  ensureDirs, getSettings, saveSettings,
  isWin: os.platform() === 'win32',
};
