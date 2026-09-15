'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getSettings } = require('../config');
const { parseLog } = require('../utils/logParser');

const IS_WIN = os.platform() === 'win32';
const ENGINES = ['pdflatex', 'xelatex', 'lualatex', 'latexmk', 'bibtex', 'biber', 'synctex'];

let detectionCache = null;

function existsWin(file) {
  try { fs.accessSync(file, fs.constants.X_OK); return true; } catch { return false; }
}

function which(bin) {
  const dirs = (process.env.PATH || '').split(IS_WIN ? ';' : ':');
  for (const d of dirs) {
    if (!d) continue;
    const p = path.join(d.trim(), IS_WIN ? `${bin}.exe` : bin);
    if (existsWin(p)) return p;
  }
  return null;
}

/** Scan every fixed drive letter for TeX Live installs (e.g. E:\texlive\2026\bin\windows). */
function scanDrivesForTexLive() {
  if (!IS_WIN) return [];
  const dirs = [];
  const years = ['2026', '2025', '2024', '2023', '2022'];
  for (let c = 67; c <= 90; c++) { // 'B'..'Z'
    const drive = `${String.fromCharCode(c)}:`;
    try { fs.accessSync(`${drive}\\`); } catch { continue; }
    for (const year of years) {
      for (const arch of ['windows', 'win32']) {
        const p = `${drive}\\texlive\\${year}\\bin\\${arch}`;
        if (fs.existsSync(path.join(p, IS_WIN ? 'pdflatex.exe' : 'pdflatex'))) dirs.push(p);
      }
    }
  }
  return dirs;
}

function candidateDirs() {
  const home = os.homedir();
  const dirs = [];
  const custom = (getSettings().texPath || '').trim();
  if (custom) dirs.push(custom);
  if (IS_WIN) {
    dirs.push(
      ...scanDrivesForTexLive(),
      path.join(home, 'AppData', 'Roaming', 'TinyTeX', 'bin', 'windows'),
      path.join(home, 'AppData', 'Roaming', 'TinyTeX', 'bin'),
      path.join(home, 'AppData', 'Local', 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
      'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
      'C:\\Program Files\\MiKTeX 2.9\\miktex\\bin\\x64',
    );
  } else if (os.platform() === 'darwin') {
    dirs.push(
      path.join(home, 'Library', 'TinyTeX', 'bin', 'universal-darwin'),
      '/usr/local/bin', '/Library/TeX/texbin',
    );
  } else {
    dirs.push(
      path.join(home, '.TinyTeX', 'bin', 'x86_64-linux'),
      path.join(home, 'bin', 'tinytex', 'bin'),
      '/usr/local/bin', '/usr/bin',
    );
  }
  return dirs;
}

/** Locate the TeX distribution. Result is cached until re-detected. */
function detectTeX(force = false) {
  if (detectionCache && !force) return detectionCache;

  const found = {};
  const searchDirs = candidateDirs();
  for (const engine of ENGINES) {
    let bin = which(engine);
    if (!bin) {
      for (const d of searchDirs) {
        const p = path.join(d, IS_WIN ? `${engine}.exe` : engine);
        if (fs.existsSync(p)) { bin = p; break; }
      }
    }
    found[engine] = bin;
  }

  const any = found.pdflatex || found.xelatex || found.lualatex;
  let distro = null;
  let version = null;
  if (any) {
    const binDir = path.dirname(any);
    const norm = binDir.toLowerCase();
    if (norm.includes('tinytex')) distro = 'TinyTeX';
    else if (norm.includes('miktex')) distro = 'MiKTeX';
    else if (norm.includes('texlive') || norm.includes('tex\\')) distro = 'TeX Live';
    else distro = 'TeX';
    try {
      version = require('child_process').execFileSync(any, ['--version'], { encoding: 'utf8', timeout: 8000 }).split('\n')[0];
    } catch { /* ignore */ }
  }

  detectionCache = {
    available: !!any,
    distro,
    version,
    engines: found,
    binDir: any ? path.dirname(any) : null,
    hasLatexmk: !!found.latexmk,
    hasSynctex: !!found.synctex,
    searched: searchDirs,
  };
  return detectionCache;
}

/** Extend PATH for spawned compilers so bundled engines resolve each other. */
function spawnEnv() {
  const det = detectTeX();
  const env = { ...process.env };
  if (det.binDir) env.PATH = det.binDir + path.delimiter + (env.PATH || '');
  return env;
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode) return;
  if (IS_WIN) {
    try { spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']); } catch { try { proc.kill(); } catch {} }
  } else {
    try { proc.kill('SIGKILL'); } catch {}
  }
}

/**
 * Run one TeX pass. Returns a promise with {code, stdout tail}.
 */
function runPass(bin, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, env: spawnEnv(), windowsHide: true });
    let out = '';
    const timer = setTimeout(() => { killTree(child); }, timeoutMs);
    child.stdout.on('data', d => { out += d.toString(); if (out.length > 400000) out = out.slice(-200000); });
    child.stderr.on('data', d => { out += d.toString(); if (out.length > 400000) out = out.slice(-200000); });
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: -1, out: String(err) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? -1, out }); });
  });
}

function readLogSafe(logFile) {
  try {
    const buf = fs.readFileSync(logFile);
    // TeX logs are ASCII-ish; latin1 never throws on binary junk
    let text = buf.toString('utf8');
    if (text.includes('\uFFFD')) text = buf.toString('latin1');
    return text;
  } catch { return ''; }
}

// ---- compile lock: one compile per project at a time ----
const runningJobs = new Map(); // projectId -> cancel fn

function isCompiling(projectId) { return runningJobs.has(projectId); }
function cancelCompile(projectId) {
  const job = runningJobs.get(projectId);
  if (job) { job.cancelled = true; killTree(job.proc); return true; }
  return false;
}

async function compileProject(project, options, onPhase) {
  const { rootFile, compiler } = options;
  const dir = project.dir;
  const settings = getSettings();
  const det = detectTeX();
  if (!det.available) {
    return { ok: false, reason: 'no-tex', message: 'No TeX distribution found. Install TinyTeX / MiKTeX / TeX Live and restart CSleaf.' };
  }

  // cancel any in-flight compile for this project
  cancelCompile(project.id);
  const job = { cancelled: false, proc: null };
  runningJobs.set(project.id, job);

  const startedAt = Date.now();
  const baseName = path.basename(rootFile, path.extname(rootFile));
  const logFile = path.join(dir, `${baseName}.log`);
  const pdfFile = path.join(dir, `${baseName}.pdf`);
  const timeoutMs = settings.timeoutMs || 120000;

  const emit = (phase, message) => { if (!job.cancelled && onPhase) onPhase(phase, message); };

  try {
    emit('starting', compiler);
    let passes = [];
    if (compiler === 'latexmk' && det.hasLatexmk) {
      passes = [['latexmk', ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', '-pdf', rootFile]]];
    } else {
      // manual multi-pass for pdflatex / xelatex (or latexmk missing)
      const engine = (compiler === 'xelatex' && det.engines.xelatex) ? 'xelatex'
        : (compiler === 'lualatex' && det.engines.lualatex) ? 'lualatex' : 'pdflatex';
      const args = ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', rootFile];
      passes = [[engine, args], [engine, args]];
      if (compiler === 'xelatex' && !det.engines.xelatex) {
        return { ok: false, reason: 'no-engine', message: 'xelatex not found in the detected TeX distribution.' };
      }
    }

    let lastOut = '';
    let passIdx = 0;
    for (const [bin0, args] of passes) {
      if (job.cancelled) return { ok: false, reason: 'cancelled' };
      const bin = det.engines[bin0] || which(bin0) || bin0;
      emit('compiling', `pass ${passIdx + 1}/${passes.length} · ${path.basename(bin)}`);
      const { code, out } = await runPass(bin, args, dir, timeoutMs);
      lastOut = out || lastOut;
      passIdx++;
      if (code !== 0) break;
    }

    // bibtex support when not using latexmk: detect \bibliography{...} + .aux
    if (compiler !== 'latexmk' || !det.hasLatexmk) {
      const log = readLogSafe(logFile);
      const mainTex = fs.readFileSync(path.join(dir, rootFile), 'utf8').catch?.(() => '') ?? '';
      let src = '';
      try { src = fs.readFileSync(path.join(dir, rootFile), 'utf8'); } catch {}
      const needsBib = src.includes('\\bibliography{') || src.includes('\\addbibresource');
      if (needsBib && det.engines.bibtex && fs.existsSync(path.join(dir, `${baseName}.aux`))) {
        emit('compiling', 'bibtex');
        await runPass(det.engines.bibtex, [baseName], dir, timeoutMs);
        const engine = (compiler === 'xelatex' ? 'xelatex' : 'pdflatex');
        const args = ['-interaction=nonstopmode', '-file-line-error', rootFile];
        if (!job.cancelled) await runPass(det.engines[engine] || engine, args, dir, timeoutMs);
        if (!job.cancelled) await runPass(det.engines[engine] || engine, args, dir, timeoutMs);
      }
    }

    if (job.cancelled) return { ok: false, reason: 'cancelled' };

    const logText = readLogSafe(logFile);
    const parsed = parseLog(logText);
    const pdfExists = fs.existsSync(pdfFile);
    const elapsed = Date.now() - startedAt;

    const ok = pdfExists && parsed.errors.length === 0;
    const status = !pdfExists ? 'failed'
      : parsed.errors.length === 0 ? 'success' : 'success-with-errors';

    runningJobs.delete(project.id);
    return {
      ok,
      status,
      elapsed,
      pdf: pdfExists ? path.basename(pdfFile) : null,
      log: parsed,
      output: (lastOut || '').split('\n').slice(-150).join('\n'),
    };
  } finally {
    runningJobs.delete(project.id);
  }
}

// ---- SyncTeX ----
function synctexView(project, pdfName, file, line, col) {
  const det = detectTeX();
  if (!det.hasSynctex) return { available: false };
  const args = ['view', '-i', `${line}:${col || 0}:${file}`, '-o', path.join(project.dir, pdfName)];
  const out = require('child_process').spawnSync(det.engines.synctex, args, {
    cwd: project.dir, env: spawnEnv(), encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  if (out.status !== 0) return { available: true, match: false };
  const text = out.stdout || '';
  const page = text.match(/^Page:\s*(\d+)/m);
  const fx = text.match(/^h:\s*([\d.]+)/m);          // horizontal origin of the box
  const fv = text.match(/^v:\s*([\d.]+)/m);          // vertical position (baseline)
  const fW = text.match(/^W:\s*([\d.]+)/m);          // box width
  const fH = text.match(/^H:\s*([\d.]+)/m);          // box height
  if (!page) return { available: true, match: false };
  const h = parseFloat((fx || [0, '0'])[1]);
  const v = parseFloat((fv || [0, '0'])[1]);
  const W = parseFloat((fW || [0, '0'])[1]);
  const H = parseFloat((fH || [0, '0'])[1]);
  return {
    available: true, match: true,
    page: parseInt(page[1], 10),
    left: h,
    top: Math.max(v - H, v - 8),   // top edge of the text box
    width: W,
    height: Math.max(H, 7),
  };
}

function synctexEdit(project, pdfName, page, x, y) {
  const det = detectTeX();
  if (!det.hasSynctex) return { available: false };
  const args = ['edit', '-o', `${page}:${x}:${y}:${path.join(project.dir, pdfName)}`];
  const out = require('child_process').spawnSync(det.engines.synctex, args, {
    cwd: project.dir, env: spawnEnv(), encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  if (out.status !== 0) return { available: true, match: false };
  const text = out.stdout || '';
  const input = text.match(/^Input:\s*(.*)$/m);
  const line = text.match(/^Line:\s*(\d+)/m);
  const col = text.match(/^Column:\s*(\d+)/m);
  if (!input || !line) return { available: true, match: false };
  // normalize absolute path → project-relative
  let file = input[1].trim().replace(/\\/g, '/');
  const dirNorm = project.dir.replace(/\\/g, '/').replace(/\/$/, '') + '/';
  if (file.toLowerCase().startsWith(dirNorm.toLowerCase())) file = file.slice(dirNorm.length);
  file = file.replace(/^\.\//, '');
  return {
    available: true, match: true,
    file,
    line: parseInt(line[1], 10),
    col: parseInt((col || [0, '0'])[1], 10) || 0,
  };
}

module.exports = {
  detectTeX, compileProject, isCompiling, cancelCompile,
  synctexView, synctexEdit,
};
