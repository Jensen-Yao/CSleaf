import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { parseOutline } from '../lib/latex/analyze.js';
import {
  FileIcon, FolderIcon, ChevronIcon, FilePlusIcon, FolderPlusIcon, UploadIcon,
  ListIcon, BibIcon, TrashIcon, EditIcon, DownloadIcon, CloseIcon,
} from './Icons.jsx';

export default function SideBar() {
  const [tab, setTab] = useState('files');
  const t = useStore(s => s.t);
  const tabs = [
    { id: 'files', label: t('files'), Icon: FileIcon },
    { id: 'outline', label: t('outline'), Icon: ListIcon },
    { id: 'bib', label: t('citations'), Icon: BibIcon },
  ];
  return (
    <>
      <div className="sidebar-tabs">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} className={`sidebar-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon width={13} height={13} /> {label}
          </button>
        ))}
      </div>
      <div className="sidebar-content">
        {tab === 'files' && <FileTreePanel />}
        {tab === 'outline' && <OutlinePanel />}
        {tab === 'bib' && <BibPanel />}
      </div>
    </>
  );
}

/* ================= file tree ================= */
function FileTreePanel() {
  const tree = useStore(s => s.tree);
  const refreshTree = useStore(s => s.refreshTree);
  const uploadFiles = useStore(s => s.uploadFiles);
  const t = useStore(s => s.t);
  const fileInputRef = React.useRef(null);
  const [uploadDir, setUploadDir] = useState('');

  if (!tree) return <div className="log-empty">{t('loading')}</div>;

  return (
    <div onContextMenu={e => { if (e.target === e.currentTarget) { e.preventDefault(); } }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 6, justifyContent: 'flex-end' }}>
        <button className="icon-btn" style={{ width: 25, height: 25 }} title={t('newFile')}
          onClick={() => NewEntryPrompt('file', '')}>
          <FilePlusIcon width={13} height={13} />
        </button>
        <button className="icon-btn" style={{ width: 25, height: 25 }} title={t('newFolder')}
          onClick={() => NewEntryPrompt('folder', '')}>
          <FolderPlusIcon width={13} height={13} />
        </button>
        <button className="icon-btn" style={{ width: 25, height: 25 }} title={t('upload')}
          onClick={() => { setUploadDir(''); fileInputRef.current?.click(); }}>
          <UploadIcon width={13} height={13} />
        </button>
        <input hidden multiple type="file" ref={fileInputRef}
          onChange={e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) uploadFiles(uploadDir, files); }} />
      </div>
      <TreeNode node={tree} depth={0} />
    </div>
  );
}

async function NewEntryPrompt(type, parentPath) {
  const s = useStore.getState();
  const t = s.t;
  const name = prompt(type === 'file' ? `${t('newFile')} — ${t('name')}` : `${t('newFolder')} — ${t('name')}`);
  if (!name) return;
  const path = parentPath ? `${parentPath}/${name}` : name;
  try { await s.createEntry(path, type); }
  catch (e) { s.toast(e.message, 'error'); }
}

function fileIconClass(name) {
  if (/\.tex$/i.test(name)) return '#5ec8a0';
  if (/\.bib$/i.test(name)) return '#d8a657';
  if (/\.(png|jpe?g|gif|eps|pdf|svg)$/i.test(name)) return '#7dd3fc';
  return 'var(--text2)';
}

function TreeNode({ node, depth }) {
  const [open, setOpen] = useState(depth < 2);
  const [ctx, setCtx] = useState(null);
  const s = useStore();
  const t = useStore(st => st.t);
  const activePath = useStore(st => st.activePath);
  const isRoot = depth === 0;

  const isDir = node.type === 'folder' || isRoot;

  async function onEntryAction(action, node, parentPath) {
    const st = useStore.getState();
    setCtx(null);
    try {
      if (action === 'rename') {
        const newName = prompt(t('rename'), node.name);
        if (newName) await st.renameEntry(node.path, newName);
      } else if (action === 'delete') {
        if (confirm(`${t('delete')} ${node.path}?`)) await st.deleteEntry(node.path);
      } else if (action === 'newfile') {
        NewEntryPrompt('file', isRoot ? '' : node.path);
      } else if (action === 'newfolder') {
        NewEntryPrompt('folder', isRoot ? '' : node.path);
      } else if (action === 'setmain') {
        await st.setMainFile(node.path);
      }
    } catch (e) { st.toast(e.message, 'error'); }
  }

  if (isDir) {
    return (
      <div>
        <div className={`tree-item ${isRoot ? 'is-main' : ''}`}
          style={{ paddingLeft: 8 + depth * 13 }}
          onClick={() => setOpen(o => !o)}
          onContextMenu={e => { if (isRoot) return; e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, node, action: onEntryAction }); }}>
          {!isRoot && <ChevronIcon className={`tree-caret ${open ? 'open' : ''}`} />}
          <FolderIcon open={open} style={{ color: 'var(--accent)' }} />
          <span className="tree-name">{node.name}</span>
        </div>
        {open && (node.children || []).map(child =>
          <TreeNode key={child.path} node={child} depth={depth + 1} />)}
        {ctx && <TreeContextMenu {...ctx} onClose={() => setCtx(null)} />}
      </div>
    );
  }

  const active = node.path === activePath;
  const isMain = node.path === s.project?.mainFile;

  return (
    <div>
      <div className={`tree-item ${active ? 'active' : ''} ${isMain ? 'is-main' : ''}`}
        style={{ paddingLeft: 8 + depth * 13 }}
        onClick={() => s.openFile(node.path)}
        onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, node, action: onEntryAction }); }}>
        <FileIcon style={{ color: fileIconClass(node.name) }} />
        <span className="tree-name">{node.name}</span>
      </div>
      {ctx && <TreeContextMenu {...ctx} onClose={() => setCtx(null)} />}
    </div>
  );
}

function TreeContextMenu({ x, y, node, action, onClose }) {
  const ref = React.useRef(null);
  const t = useStore(st => st.t);
  const isRoot = node.type === 'folder' && !node.path;
  const isTex = /\.tex$/i.test(node.name);

  React.useEffect(() => {
    const onAny = () => onClose();
    const t0 = setTimeout(() => window.addEventListener('mousedown', onAny), 10);
    return () => { clearTimeout(t0); window.removeEventListener('mousedown', onAny); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const items = isRoot ? [
    ['newfile', <><FilePlusIcon width={13} height={13} /> {t('newFile')}</>],
    ['newfolder', <><FolderPlusIcon width={13} height={13} /> {t('newFolder')}</>],
  ] : [
    ...(node.type === 'folder' ? [
      ['newfile', <><FilePlusIcon width={13} height={13} /> {t('newFile')}</>],
      ['newfolder', <><FolderPlusIcon width={13} height={13} /> {t('newFolder')}</>],
    ] : [
      ...(isTex ? [['setmain', <><StarIcon width={13} height={13} /> {t('mainFile')}</>]] : []),
      ['rename', <><EditIcon width={13} height={13} /> {t('rename')}</>],
    ]),
    ['delete', <><TrashIcon width={13} height={13} /> {t('delete')}</>],
  ];

  return (
    <div className="dropdown-menu" style={{ position: 'fixed', left: x, top: y, zIndex: 300 }}
      onMouseDown={e => e.stopPropagation()}>
      {items.map(([id, label]) => (
        <button key={id} className="dropdown-item" onClick={() => action(id, node, node.path)}>{label}</button>
      ))}
    </div>
  );
}

function StarIcon(p) {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>;
}

/* ================= outline ================= */
function OutlinePanel() {
  const tabs = useStore(s => s.tabs);
  const activePath = useStore(s => s.activePath);
  const openFile = useStore(s => s.openFile);
  const t = useStore(s => s.t);

  const activeTab = tabs.find(tb => tb.path === activePath);
  const items = activeTab && !activeTab.binary ? parseOutline(activeTab.content) : [];

  if (!items.length) return <div className="log-empty">{t('noOutline')}</div>;

  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className={`outline-item lv${Math.min(it.level, 4)}`}
          onClick={() => {
            openFile(activePath, true).then(() => {
              window.dispatchEvent(new CustomEvent('csleaf:reveal-line', { detail: it.line }));
            });
          }}>
          <span className="s"><span className="kind">{it.label}</span> · L{it.line}</span>
          <span className="t">{it.title}</span>
        </div>
      ))}
    </div>
  );
}

/* ================= bibliography ================= */
function BibPanel() {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const project = useStore(s => s.project);
  const tree = useStore(s => s.tree);
  const toast = useStore(s => s.toast);
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('');

  const bibFiles = [];
  (function walk(node) {
    for (const c of node?.children || []) {
      if (c.type === 'file' && /\.bib$/i.test(c.name)) bibFiles.push(c.path);
      else if (c.type === 'folder') walk(c);
    }
  })(tree);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const all = [];
      for (const f of bibFiles) {
        try {
          const { entries: es } = await api.bibEntries(project.id, f);
          if (!cancel) all.push(...es.map(e => ({ ...e, file: f })));
        } catch {}
      }
      if (!cancel) setEntries(all);
    })();
    return () => { cancel = true; };
  }, [tree, project?.id]);

  if (!bibFiles.length) return <div className="log-empty">{t('noBib')}</div>;

  const q = filter.toLowerCase();
  const shown = q ? entries.filter(e => `${e.key} ${e.title} ${e.author}`.toLowerCase().includes(q)) : entries;

  return (
    <div>
      <input placeholder={`${t('citations')}… (${entries.length})`} value={filter}
        onChange={e => setFilter(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      {shown.map(e => (
        <div key={e.key + e.file} className="bib-entry" title={t('rootlessTitle') + `\\cite{${e.key}}`}
          onClick={() => {
            navigator.clipboard?.writeText(`\\cite{${e.key}}`);
            toast(`\\cite{${e.key}} ${lang === 'zh' ? '已复制到剪贴板' : 'copied'}`, 'success', 1600);
          }}>
          <div className="key">{e.key}</div>
          <div className="title">{e.title || `@${e.type}`}</div>
          <div className="meta">{[e.author?.split(' and ')[0], e.year, e.journal].filter(Boolean).join(' · ')}</div>
        </div>
      ))}
    </div>
  );
}
