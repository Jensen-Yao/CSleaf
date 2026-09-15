import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../lib/store';
import {
  PlayIcon, StopIcon, SettingsIcon, SunIcon, MoonIcon, LangIcon, HomeIcon,
  ChevronIcon, RefreshIcon, BroomIcon, CommandIcon, KeyboardIcon, TerminalIcon,
} from './Icons.jsx';

export default function TopBar() {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const project = useStore(s => s.project);
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const toggleLang = useStore(s => s.toggleLang);
  const goHome = useStore(s => s.goHome);
  const openModal = useStore(s => s.openModal);
  const compile = useStore(s => s.compile);
  const cancelCompile = useStore(s => s.cancelCompile);
  const compileState = useStore(s => s.compileState);
  const setCompiler = useStore(s => s.setCompiler);
  const setMainFile = useStore(s => s.setMainFile);
  const cleanProject = useStore(s => s.cleanProject);
  const refreshTree = useStore(s => s.refreshTree);
  const tree = useStore(s => s.tree);
  const texFiles = useMemo(() => collectTexFiles(tree), [tree]);

  const [menu, setMenu] = useState(null); // 'compiler' | 'main' | 'more'
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null); };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  if (!project) return <div className="topbar" />;

  const running = compileState.running;

  return (
    <div className="topbar" ref={menuRef}>
      <div className="brand" onClick={goHome} title={t('backToProjects')}>
        <img src="/leaf.svg" alt="" />
        <span className="name">CS<b>leaf</b></span>
      </div>
      <div className="divider" />
      <div className="project-title">
        <span>{project.name}</span>
        <span className="path">/ {project.mainFile}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* main file selector */}
      <div className="dropdown">
        <button className="btn small" onClick={() => setMenu(menu === 'main' ? null : 'main')} title={t('mainFile')}>
          {project.mainFile.split('/').pop()} <ChevronIcon width={12} height={12} style={{ transform: 'rotate(90deg)' }} />
        </button>
        {menu === 'main' && (
          <div className="dropdown-menu" style={{ left: 0, right: 'auto' }}>
            <div className="dropdown-label">{t('mainFile')}</div>
            {texFiles.map(f => (
              <button key={f} className={`dropdown-item ${f === project.mainFile ? 'selected' : ''}`}
                onClick={() => { setMainFile(f); setMenu(null); }}>
                {f} <span className="check">✓</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* compiler selector */}
      <div className="dropdown">
        <button className="btn small" onClick={() => setMenu(menu === 'compiler' ? null : 'compiler')} title={t('compiler')}>
          {project.compiler} <ChevronIcon width={12} height={12} style={{ transform: 'rotate(90deg)' }} />
        </button>
        {menu === 'compiler' && (
          <div className="dropdown-menu" style={{ width: 270 }}>
            <div className="dropdown-label">{t('compiler')}</div>
            {[
              ['latexmk', lang === 'zh' ? '推荐 · 自动多轮编译 + 参考文献' : 'Recommended · auto reruns + BibTeX'],
              ['pdflatex', lang === 'zh' ? '经典引擎 · 纯英文文档' : 'Classic engine · English-only docs'],
              ['xelatex', lang === 'zh' ? '中文论文选这个（系统字体）' : 'For Chinese documents (system fonts)'],
              ['lualatex', lang === 'zh' ? '新一代引擎 · 稍慢' : 'Modern engine · slightly slower'],
            ].map(([c, hint]) => (
              <button key={c} className={`dropdown-item ${c === project.compiler ? 'selected' : ''}`}
                onClick={() => { setCompiler(c); setMenu(null); }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: c === project.compiler ? 700 : 500 }}>{c}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text2)' }}>{hint}</span>
                </span>
                <span className="check">✓</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* compile button */}
      {running ? (
        <button className="btn primary" onClick={cancelCompile} style={{ minWidth: 96 }}>
          <span className="spin"><StopIcon width={13} height={13} /></span> {t('compiling')}…
        </button>
      ) : (
        <button className="btn primary" onClick={() => compile()} style={{ minWidth: 96 }}>
          <PlayIcon width={13} height={13} /> {t('compile')}
        </button>
      )}

      <button className="icon-btn" title={t('quickOpen')} onClick={() => openModal('quickopen')}>
        <TerminalIcon />
      </button>
      <button className="icon-btn" title={t('commandPalette')} onClick={() => openModal('palette')}>
        <CommandIcon />
      </button>
      <button className="icon-btn" title={t('clean')} onClick={cleanProject}><BroomIcon /></button>
      <button className="icon-btn" title={t('files')} onClick={refreshTree}><RefreshIcon /></button>

      <div style={{ width: 1 }} />
      <button className="icon-btn" title={t('language')} onClick={toggleLang}><LangIcon /></button>
      <button className="icon-btn" title={t('theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <button className="icon-btn" title={t('settings')} onClick={() => openModal('settings')}><SettingsIcon /></button>
    </div>
  );
}

function collectTexFiles(node, out = [], prefix = '') {
  if (!node) return out;
  for (const c of node.children || []) {
    const p = prefix ? `${prefix}/${c.name}` : c.name;
    if (c.type === 'file') { if (/\.tex$/i.test(c.name)) out.push(p); }
    else collectTexFiles(c, out, p);
  }
  return out;
}
