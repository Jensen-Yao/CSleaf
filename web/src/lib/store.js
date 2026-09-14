import { create } from 'zustand';
import { api } from './api';
import { makeT, detectLang } from './i18n';

const LS = {
  get(key, def) {
    try { const v = localStorage.getItem(`csleaf.${key}`); return v == null ? def : JSON.parse(v); }
    catch { return def; }
  },
  set(key, val) { try { localStorage.setItem(`csleaf.${key}`, JSON.stringify(val)); } catch {} },
};

let saveTimers = new Map(); // path -> timer
let compileTimer = null;

export const useStore = create((set, get) => ({
  // ---------- modals ----------
  modal: null, // 'settings' | 'palette' | 'quickopen' | 'shortcuts' | null
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  // ---------- ui ----------
  lang: detectLang(),
  theme: LS.get('theme', 'dark'),
  t(key) { return makeT(get().lang)(key); },
  setLang: (lang) => { LS.set('lang', lang); set({ lang }); },
  toggleLang: () => get().setLang(get().lang === 'zh' ? 'en' : 'zh'),
  setTheme: (theme) => { LS.set('theme', theme); document.documentElement.dataset.theme = theme; set({ theme }); },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  editor: { fontSize: LS.get('fontSize', 14), wordWrap: LS.get('wordWrap', true), minimap: LS.get('minimap', false) },
  setEditorPref: (patch) => {
    const editor = { ...get().editor, ...patch };
    Object.entries(patch).forEach(([k, v]) => LS.set(k, v));
    set({ editor });
  },

  sidebarWidth: LS.get('sidebarWidth', 250),
  previewWidth: LS.get('previewWidth', 520),
  logHeight: LS.get('logHeight', 200),
  sidebarOpen: LS.get('sidebarOpen', true),
  previewOpen: LS.get('previewOpen', true),
  logOpen: LS.get('logOpen', false),
  layout: LS.get('layout', { sidebarWidth: 250, previewWidth: 520, logHeight: 200 }),
  setLayout: (patch) => {
    const layout = { ...get().layout, ...patch };
    LS.set('layout', layout);
    set({ layout, sidebarWidth: layout.sidebarWidth, previewWidth: layout.previewWidth, logHeight: layout.logHeight });
  },
  togglePanel: (name) => set((s) => ({ [`${name}Open`]: !s[`${name}Open`] })),

  // ---------- toasts ----------
  toasts: [],
  toast(message, kind = 'info', ms = 2600) {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), ms);
  },

  // ---------- system ----------
  texInfo: null,
  serverSettings: { autoCompile: true, timeoutMs: 120, texPath: '' },
  loadSystem: async () => {
    try {
      const [texInfo, serverSettings] = await Promise.all([api.texInfo(), api.getSettings()]);
      set({ texInfo, serverSettings });
    } catch (e) { console.error(e); }
  },
  reDetectTex: async () => {
    const texInfo = await api.texInfo(true);
    set({ texInfo });
    return texInfo;
  },

  // ---------- home ----------
  projects: [],
  templates: [],
  loadProjects: async () => {
    const [projects, templates] = await Promise.all([api.projects(), api.templates()]);
    set({ projects, templates });
  },
  createProject: async (body) => {
    const p = await api.createProject(body);
    set((s) => ({ projects: [p, ...s.projects] }));
    return p;
  },
  importZip: async (file, name) => {
    const p = await api.importProject(file, name);
    set((s) => ({ projects: [p, ...s.projects] }));
    return p;
  },
  removeProject: async (id) => {
    await api.deleteProject(id);
    set((s) => ({ projects: s.projects.filter(p => p.id !== id) }));
  },
  duplicateProject: async (id) => {
    const p = await api.duplicateProject(id);
    set((s) => ({ projects: [p, ...s.projects] }));
  },
  renameProject: async (id, name) => {
    await api.patchProject(id, { name });
    set((s) => ({ projects: s.projects.map(p => p.id === id ? { ...p, name } : p) }));
  },

  // ---------- workspace ----------
  view: 'home',
  project: null,       // {id, name, mainFile, compiler, ...}
  tree: null,
  tabs: [],            // [{path, name, dirty, content, binary}]
  activePath: null,
  cursor: { line: 1, col: 1 },
  outline: [],
  wordCount: { cjk: 0, words: 0 },

  openProject: async (id) => {
    set({ view: 'project', project: null, tree: null, tabs: [], activePath: null });
    const meta = await api.tree(id);
    const project = {
      id, name: meta.name || id, mainFile: meta.mainFile, compiler: meta.compiler || 'latexmk',
    };
    set({ project, tree: meta.tree });
    // restore last open tabs for this project
    const saved = LS.get(`tabs.${id}`, null);
    const flatFiles = flattenFiles(meta.tree).filter(f => /\.(tex|bib|sty|cls|txt|md)$/i.test(f.path));
    const toOpen = (saved && saved.length ? saved : flatFiles.slice(0, 1).map(f => f.path))
      .filter(p2 => flatFiles.some(f => f.path === p2)).slice(0, 8);
    for (const path of toOpen) await get().openFile(path, false);
    if (toOpen.length) set({ activePath: toOpen[0] });
    if (get().texInfo?.available) get().compile(true);
  },
  goHome: () => {
    get().saveAll();
    set({ view: 'home', project: null, tree: null, tabs: [], activePath: null, compile: null });
    get().loadProjects();
  },

  setMainFile: async (mainFile) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, mainFile } });
    await api.patchProject(project.id, { mainFile });
  },
  setCompiler: async (compiler) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, compiler } });
    await api.patchProject(project.id, { compiler });
  },

  refreshTree: async () => {
    const { project } = get();
    if (!project) return;
    const meta = await api.tree(project.id);
    set({ tree: meta.tree, project: { ...get().project, mainFile: meta.mainFile, compiler: meta.compiler } });
  },

  openFile: async (path, activate = true) => {
    const { tabs } = get();
    const existing = tabs.find(t => t.path === path);
    if (existing) { if (activate) set({ activePath: path }); return; }
    const data = await api.readFile(get().project.id, path);
    const name = path.split('/').pop();
    const tab = {
      path, name,
      binary: data.binary || false,
      base64: data.base64 || null,
      content: data.binary ? '' : data.content,
      original: data.binary ? '' : data.content,
      dirty: false,
    };
    set((s) => {
      const next = [...s.tabs, tab].slice(-12);
      persistTabs(next, s.project.id);
      return { tabs: next, activePath: activate ? path : s.activePath };
    });
  },
  closeTab: (path) => {
    set((s) => {
      const idx = s.tabs.findIndex(t => t.path === path);
      if (idx === -1) return {};
      const tab = s.tabs[idx];
      if (tab.dirty && !confirm(`${path} ${s.lang === 'zh' ? '有未保存的修改，确定关闭？' : 'has unsaved changes. Close anyway?'}`)) return {};
      const next = s.tabs.filter(t => t.path !== path);
      const activePath = s.activePath === path
        ? (next[Math.min(idx, next.length - 1)]?.path ?? null)
        : s.activePath;
      persistTabs(next, s.project.id);
      return { tabs: next, activePath };
    });
  },
  setActive: (path) => set({ activePath: path }),

  updateContent: (path, content) => {
    set((s) => {
      const tabs = s.tabs.map(t => t.path === path ? { ...t, content, dirty: content !== t.original } : t);
      return { tabs };
    });
    // debounced autosave
    clearTimeout(saveTimers.get(path));
    saveTimers.set(path, setTimeout(() => get().saveFile(path), 900));
  },

  saveFile: async (path) => {
    const tab = get().tabs.find(t => t.path === path);
    if (!tab || tab.binary || !tab.dirty) return;
    try {
      await api.writeFile(get().project.id, path, tab.content);
      set((s) => ({
        tabs: s.tabs.map(t => t.path === path ? { ...t, original: t.content, dirty: false } : t),
      }));
      const { serverSettings } = get();
      if (serverSettings.autoCompile) {
        clearTimeout(compileTimer);
        compileTimer = setTimeout(() => get().compile(true), 1600);
      }
    } catch (e) {
      get().toast(`Save failed: ${e.message}`, 'error');
    }
  },
  saveAll: async () => {
    const dirty = get().tabs.filter(t => t.dirty);
    await Promise.all(dirty.map(t => get().saveFile(t.path)));
  },

  // file ops
  createEntry: async (path, type) => {
    await api.createEntry(get().project.id, path, type);
    await get().refreshTree();
    if (type === 'file') { await get().openFile(path); }
    get().toast(`${type === 'file' ? 'File' : 'Folder'} created: ${path}`, 'success');
  },
  renameEntry: async (path, newName) => {
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    const newPath = parent + newName;
    await api.renameEntry(get().project.id, path, newName);
    set((s) => ({
      tabs: s.tabs.map(t => t.path === path ? { ...t, path: newPath, name: newName } : t),
      activePath: s.activePath === path ? newPath : s.activePath,
    }));
    await get().refreshTree();
  },
  deleteEntry: async (path) => {
    await api.deleteEntry(get().project.id, path);
    set((s) => {
      const tabs = s.tabs.filter(t => t.path !== path && !t.path.startsWith(path + '/'));
      const activePath = s.activePath === path ? (tabs[0]?.path ?? null) : s.activePath;
      return { tabs, activePath };
    });
    await get().refreshTree();
  },
  uploadFiles: async (targetDir, files) => {
    await api.uploadFiles(get().project.id, targetDir, files);
    await get().refreshTree();
    get().toast(`Uploaded ${files.length} file(s)`, 'success');
  },
  cleanProject: async () => {
    const r = await api.cleanProject(get().project.id);
    get().toast(`Removed ${r.removed} aux file(s)`, 'success');
  },

  // outline / cursor / counts (called by editor)
  setOutline: (outline) => set({ outline }),
  setCursor: (cursor) => set({ cursor }),
  setWordCount: (wordCount) => set({ wordCount }),

  // ---------- compile ----------
  compileState: { running: false, phase: '', message: '', result: null },
  pdfVersion: 0,
  pdfFile: null,
  logOpenTab: 'issues',

  bumpPdf: (pdfFile) => set((s) => ({ pdfFile: pdfFile || s.pdfFile, pdfVersion: s.pdfVersion + 1 })),
  setLogTab: (tab) => set({ logOpenTab: tab }),

  compile: async (silent = false) => {
    const { project, compileState } = get();
    if (!project || compileState.running) return;
    set({ compileState: { running: true, phase: 'starting', message: '', result: null } });
    if (!silent) set((s) => ({ logOpen: true, logOpenTab: 'issues' }));
    try {
      const result = await api.compile(project.id, {
        root: project.mainFile,
        compiler: project.compiler,
      });
      set({ compileState: { running: false, phase: 'done', message: '', result } });
      if (result.pdf) get().bumpPdf(result.pdf);
      if (!silent) {
        if (result.ok) get().toast(makeT(get().lang)('compileOk'), 'success');
        else if (result.status === 'success-with-errors') get().toast(makeT(get().lang)('compileWarn'), 'warn');
        else get().toast(`${makeT(get().lang)('compileFailed')}${result.message ? ': ' + result.message : ''}`, 'error', 4200);
      }
      if (!result.ok || result.log?.errors?.length) {
        set((s) => ({ logOpen: s.logOpen || true }));
      }
    } catch (e) {
      set({ compileState: { running: false, phase: 'error', message: e.message, result: null } });
      get().toast(`${makeT(get().lang)('compileFailed')}: ${e.message}`, 'error', 4200);
    }
  },
  cancelCompile: async () => {
    try { await api.cancelCompile(get().project.id); } catch {}
  },
}));

function flattenFiles(node, out = []) {
  if (!node) return out;
  for (const child of node.children || []) {
    if (child.type === 'file') out.push(child);
    else flattenFiles(child, out);
  }
  return out;
}

function persistTabs(tabs, projectId) {
  if (projectId) LS.set(`tabs.${projectId}`, tabs.map(t => t.path));
}
