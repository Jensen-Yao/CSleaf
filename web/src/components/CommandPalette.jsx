import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import {
  PlayIcon, SettingsIcon, SunIcon, LangIcon, FilePlusIcon, DownloadIcon,
  BroomIcon, HomeIcon, KeyboardIcon, SidebarIcon, PanelRightIcon, FileIcon, CommandIcon, UploadIcon,
} from './Icons.jsx';

export default function CommandPalette({ mode }) {
  const t = useStore(s => s.t);
  const closeModal = useStore(s => s.closeModal);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands = useMemo(() => {
    const s = useStore.getState();
    return [
      { id: 'compile', label: t('cmdCompile'), Icon: PlayIcon, run: () => s.compile(), hint: 'Ctrl+Enter' },
      { id: 'saveall', label: t('cmdSaveAll'), Icon: FileIcon, run: () => s.saveAll(), hint: 'Ctrl+S' },
      { id: 'newfile', label: t('cmdNewFile'), Icon: FilePlusIcon, run: () => import('./SideBar.jsx').then(() => s.refreshTree()) },
      { id: 'sidebar', label: t('cmdToggleSidebar'), Icon: SidebarIcon, run: () => s.togglePanel('sidebar'), hint: 'Ctrl+B' },
      { id: 'preview', label: t('cmdTogglePreview'), Icon: PanelRightIcon, run: () => s.togglePanel('preview'), hint: 'Ctrl+Shift+E' },
      { id: 'log', label: t('output'), Icon: FileIcon, run: () => s.togglePanel('log'), hint: 'Ctrl+J' },
      { id: 'theme', label: t('cmdToggleTheme'), Icon: SunIcon, run: () => s.toggleTheme() },
      { id: 'lang', label: t('cmdToggleLang'), Icon: LangIcon, run: () => s.toggleLang() },
      { id: 'exportzip', label: t('cmdExportZip'), Icon: DownloadIcon, run: () => { const a = document.createElement('a'); a.href = `/api/projects/${s.project.id}/export`; a.download = `${s.project.name}.zip`; a.click(); } },
      { id: 'pdf', label: t('cmdDownloadPdf'), Icon: DownloadIcon, run: () => { if (s.pdfFile) { const a = document.createElement('a'); a.href = `/api/projects/${s.project.id}/pdf?file=${encodeURIComponent(s.pdfFile)}&v=${s.pdfVersion}`; a.download = s.pdfFile; a.click(); } } },
      { id: 'clean', label: t('cmdClean'), Icon: BroomIcon, run: () => s.cleanProject() },
      { id: 'upload', label: t('upload'), Icon: UploadIcon, run: () => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.onchange = async () => { if (input.files.length) await s.uploadFiles('', [...input.files]); await s.refreshTree(); }; input.click(); } },
      { id: 'home', label: t('cmdGoHome'), Icon: HomeIcon, run: () => s.goHome() },
      { id: 'settings', label: t('cmdSettings'), Icon: SettingsIcon, run: () => s.openModal('settings') },
      { id: 'shortcuts', label: t('cmdShortcuts'), Icon: KeyboardIcon, run: () => setTimeout(() => s.openModal('shortcuts'), 0) },
    ];
  }, [t]);

  const files = useMemo(() => {
    const s = useStore.getState();
    const out = [];
    (function walk(node, prefix) {
      for (const c of node?.children || []) {
        const p = prefix ? `${prefix}/${c.name}` : c.name;
        if (c.type === 'file') out.push({ path: p, name: c.name });
        else walk(c, p);
      }
    })(s.tree, '');
    return out;
  }, []);

  const items = mode === 'commands'
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : files.filter(f => f.path.toLowerCase().includes(query.toLowerCase()));

  const pick = (item) => {
    closeModal();
    if (mode === 'commands') item.run();
    else useStore.getState().openFile(item.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(v => Math.min(v + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[selected]) pick(items[selected]); }
  };

  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal palette" onMouseDown={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder={mode === 'commands'
            ? `${t('commandPalette')}…`
            : `${t('quickOpen')}…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">—</div>}
          {items.map((item, i) => {
            const Icon = mode === 'commands' ? item.Icon : FileIcon;
            return (
              <div key={mode === 'commands' ? item.id : item.path}
                className={`palette-item ${i === selected ? 'selected' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => pick(item)}>
                <span className="icon"><Icon width={14} height={14} /></span>
                <span>{mode === 'commands' ? item.label : item.path}</span>
                {mode === 'commands' && item.hint && <span className="hint"><kbd>{item.hint}</kbd></span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
