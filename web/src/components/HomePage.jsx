import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import {
  PlusIcon, UploadIcon, TrashIcon, CopyIcon, EditIcon, DownloadIcon,
  SettingsIcon, SunIcon, MoonIcon, LangIcon, FolderIcon,
} from './Icons.jsx';

const TPL_LETTERS = {
  blank: 'λ', article: 'A', 'article-zh': '文', 'ieee-conference': 'IEEE', 'ieee-journal': 'IEEE',
  'acm-conf': 'ACM', 'springer-lncs': 'LNCS', elsevier: 'EV', beamer: '▶', 'beamer-zh': '▶',
  'thesis-zh': '论', 'thesis-en': 'PhD', cv: 'CV', 'math-notes': '∑', 'lab-report-zh': '实',
  'group-meeting-zh': '组', 'review-response': 'R', homework: 'HW', poster: 'P',
};

export default function HomePage() {
  const t = useStore(s => s.t);
  const projects = useStore(s => s.projects);
  const texInfo = useStore(s => s.texInfo);
  const lang = useStore(s => s.lang);
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const toggleLang = useStore(s => s.toggleLang);
  const openModal = useStore(s => s.openModal);
  const openProject = useStore(s => s.openProject);
  const loadProjects = useStore(s => s.loadProjects);
  const removeProject = useStore(s => s.removeProject);
  const duplicateProject = useStore(s => s.duplicateProject);
  const renameProject = useStore(s => s.renameProject);
  const importZip = useStore(s => s.importZip);
  const toast = useStore(s => s.toast);
  const fileRef = useRef(null);

  useEffect(() => { loadProjects(); }, []);

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const p = await importZip(file, file.name.replace(/\.zip$/i, ''));
      toast(`${lang === 'zh' ? '已导入' : 'Imported'}: ${p.name}`, 'success');
    } catch (err) {
      toast(`${lang === 'zh' ? '导入失败' : 'Import failed'}: ${err.message}`, 'error');
    }
  }

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-hero">
          <img src="/leaf.svg" alt="CSleaf" />
          <div>
            <h1>CS<b>leaf</b></h1>
          </div>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" title={t('language')} onClick={toggleLang}><LangIcon /></button>
          <button className="icon-btn" title={t('theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button className="icon-btn" title={t('settings')} onClick={() => openModal('settings')}><SettingsIcon /></button>
        </div>
        <p className="home-sub">
          {t('tagline')}
          {texInfo && (
            <span className="badge" style={{ marginLeft: 10, verticalAlign: 'middle' }}>
              {texInfo.available ? `● ${texInfo.distro}` : `○ ${t('noTex')}`}
            </span>
          )}
        </p>

        <div className="home-toolbar">
          <h2 style={{ margin: 0, fontSize: 16 }}>{t('myProjects')}</h2>
          <span className="badge">{projects.length}</span>
          <div className="grow" />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <UploadIcon width={14} height={14} /> {t('importZip')}
          </button>
          <input ref={fileRef} type="file" accept=".zip" hidden onChange={handleImport} />
          <button className="btn primary" onClick={() => openModal('newproject')}>
            <PlusIcon width={14} height={14} /> {t('newProject')}
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="project-grid">
            <div className="new-card" onClick={() => openModal('newproject')}>
              <PlusIcon width={18} height={18} /> {t('emptyProjects')}
            </div>
          </div>
        ) : (
          <div className="project-grid">
            <div className="new-card" onClick={() => openModal('newproject')}>
              <PlusIcon width={18} height={18} /> {t('newProject')}
            </div>
            {projects.map(p => (
              <div key={p.id} className="project-card" onClick={() => openProject(p.id)}>
                <div className="top">
                  <div className="cover">{TPL_LETTERS[p.template] || 'λ'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="title">{p.name}</div>
                    <div className="meta">
                      <span>{fmtDate(p.updatedAt)}</span>
                      <span>·</span>
                      <span className="badge">{p.mainFile}</span>
                      <span className="badge green">{p.compiler}</span>
                    </div>
                  </div>
                </div>
                <div className="actions" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" title={t('rename')} onClick={() => {
                    openDialog({
                      kind: 'input', title: t('rename'), value: p.name, okText: t('rename'),
                      onOk: (name) => { if (name) renameProject(p.id, name); },
                    });
                  }}><EditIcon /></button>
                  <button className="icon-btn" title={t('duplicate')} onClick={() => duplicateProject(p.id)}><CopyIcon /></button>
                  <a className="icon-btn" title={t('export')} href={`/api/projects/${p.id}/export`} download><DownloadIcon /></a>
                  <button className="icon-btn" title={t('delete')} onClick={() => {
                    openDialog({
                      kind: 'confirm', title: t('confirmDelete'), danger: true,
                      message: `${t('confirmDeleteMsg')} (${p.name})`, okText: t('delete'),
                      onOk: () => removeProject(p.id),
                    });
                  }}><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <NewProjectModal />
    </div>
  );
}

function NewProjectModal() {
  const modal = useStore(s => s.modal);
  const closeModal = useStore(s => s.closeModal);
  const templates = useStore(s => s.templates);
  const createProject = useStore(s => s.createProject);
  const openProject = useStore(s => s.openProject);
  const lang = useStore(s => s.lang);
  const t = useStore(s => s.t);
  const toast = useStore(s => s.toast);

  const [selected, setSelected] = useState('article');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  if (modal !== 'newproject') return null;

  const tname = (tpl) => lang === 'zh' ? tpl.name : (tpl.nameEn || tpl.name);
  const tdesc = (tpl) => lang === 'zh' ? tpl.desc : (tpl.descEn || tpl.desc);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const p = await createProject({ name: name.trim(), template: selected });
      closeModal();
      openProject(p.id);
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal" style={{ width: 'min(860px, calc(100vw - 48px))' }}>
        <div className="modal-head">
          <h3>{t('chooseTemplate')}</h3>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>{t('projectName')}</label>
            <input
              autoFocus
              placeholder={lang === 'zh' ? '例如：My-NeurIPS-Paper' : 'e.g. My-NeurIPS-Paper'}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); }}
            />
          </div>
          <div className="tpl-grid">
            {templates.map(tpl => (
              <div key={tpl.id} className={`tpl-card ${selected === tpl.id ? 'selected' : ''}`} onClick={() => setSelected(tpl.id)}>
                <div className="icon">{TPL_LETTERS[tpl.id] || 'λ'}</div>
                <div className="name">{tname(tpl)}</div>
                <div className="desc">{tdesc(tpl)}</div>
                <div className="tags">
                  {(tpl.tags || []).map(tag => <span key={tag} className="badge">{tag}</span>)}
                  <span className="badge green">{tpl.compiler}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={closeModal}>{t('cancel')}</button>
          <button className="btn primary" disabled={!name.trim() || busy} onClick={create}>
            <FolderIcon width={14} height={14} /> {busy ? t('loading') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
