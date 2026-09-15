import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import TemplateDetailModal from './TemplateDetailModal.jsx';
import {
  PlusIcon, UploadIcon, TrashIcon, CopyIcon, EditIcon, DownloadIcon,
  SettingsIcon, SunIcon, MoonIcon, LangIcon, FolderIcon, CommandIcon,
  CheckIcon, AlertIcon, BookmarkIcon,
} from './Icons.jsx';

// per-template cover: single letter + gradient
export const TPL_STYLE = {
  blank: { letter: 'λ', g: 'linear-gradient(135deg,#64748b,#334155)' },
  article: { letter: 'A', g: 'linear-gradient(135deg,#34d399,#059669)' },
  'article-zh': { letter: '文', g: 'linear-gradient(135deg,#f87171,#dc2626)' },
  'ieee-conference': { letter: 'IEEE', g: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
  'ieee-journal': { letter: 'IEEE', g: 'linear-gradient(135deg,#818cf8,#4f46e5)' },
  'acm-conf': { letter: 'ACM', g: 'linear-gradient(135deg,#38bdf8,#0284c7)' },
  'springer-lncs': { letter: 'LNCS', g: 'linear-gradient(135deg,#2dd4bf,#0d9488)' },
  elsevier: { letter: 'EV', g: 'linear-gradient(135deg,#fb923c,#ea580c)' },
  beamer: { letter: '▶', g: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  'beamer-zh': { letter: '▶', g: 'linear-gradient(135deg,#e879f9,#c026d3)' },
  'thesis-zh': { letter: '论', g: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  'thesis-en': { letter: 'PhD', g: 'linear-gradient(135deg,#22d3ee,#0891b2)' },
  'lab-report-zh': { letter: '实', g: 'linear-gradient(135deg,#a3e635,#65a30d)' },
  'group-meeting-zh': { letter: '组', g: 'linear-gradient(135deg,#fb7185,#e11d48)' },
  'review-response': { letter: 'R', g: 'linear-gradient(135deg,#4ade80,#16a34a)' },
  homework: { letter: 'HW', g: 'linear-gradient(135deg,#facc15,#ca8a04)' },
  poster: { letter: 'P', g: 'linear-gradient(135deg,#f472b6,#db2777)' },
  cv: { letter: 'CV', g: 'linear-gradient(135deg,#94a3b8,#475569)' },
  'math-notes': { letter: '∑', g: 'linear-gradient(135deg,#c084fc,#7e22ce)' },
};
export const cover = (id) => TPL_STYLE[id] || { letter: '★', g: 'linear-gradient(135deg,#94a3b8,#475569)' };

function fmtRel(ts, lang) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (m < 60) return lang === 'zh' ? `${m} 分钟前` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'zh' ? `${h} 小时前` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return lang === 'zh' ? `${d} 天前` : `${d}d ago`;
  return new Date(ts).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric' });
}

export default function HomePage() {
  const t = useStore(s => s.t);
  const projects = useStore(s => s.projects);
  const templates = useStore(s => s.templates);
  const texInfo = useStore(s => s.texInfo);
  const lang = useStore(s => s.lang);
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const toggleLang = useStore(s => s.toggleLang);
  const openModal = useStore(s => s.openModal);
  const openDialog = useStore(s => s.openDialog);
  const createProject = useStore(s => s.createProject);
  const openProject = useStore(s => s.openProject);
  const loadProjects = useStore(s => s.loadProjects);
  const removeProject = useStore(s => s.removeProject);
  const duplicateProject = useStore(s => s.duplicateProject);
  const renameProject = useStore(s => s.renameProject);
  const importZip = useStore(s => s.importZip);
  const toast = useStore(s => s.toast);
  const fileRef = useRef(null);
  const tplFileRef = useRef(null);
  const [tab, setTab] = useState('projects');
  const [detailId, setDetailId] = useState(null);

  useEffect(() => { loadProjects(); }, []);

  const templateName = (tpl) => lang === 'zh' ? tpl.name : (tpl.nameEn || tpl.name);
  const tdesc = (tpl) => lang === 'zh' ? tpl.desc : (tpl.descEn || tpl.desc);
  const templateOf = (id) => templates.find(x => x.id === id);

  function useTemplate(tpl) {
    openDialog({
      kind: 'input',
      title: `${lang === 'zh' ? '使用模板' : 'Use template'} — ${templateName(tpl)}`,
      label: t('projectName'),
      value: templateName(tpl),
      placeholder: lang === 'zh' ? '我的新论文' : 'My new paper',
      okText: t('create'),
      onOk: async (name) => {
        if (!name) return;
        try {
          const p = await createProject({ name, template: tpl.id, compiler: tpl.compiler });
          openProject(p.id);
        } catch (e) { toast(e.message, 'error'); }
      },
    });
  }

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

  async function handleTemplateImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const tpl = await api.importTemplate(file, file.name.replace(/\.zip$/i, ''));
      await loadProjects();
      toast(lang === 'zh' ? `模板已导入：${tpl.name}（编译器 ${tpl.compiler}）` : `Template imported: ${tpl.name} (${tpl.compiler})`, 'success', 4000);
    } catch (err) {
      toast(`${lang === 'zh' ? '模板导入失败' : 'Template import failed'}: ${err.message}`, 'error', 4200);
    }
  }

  return (
    <div className="home">
      <div className="home-topbar">
        <div className="brand">
          <img src="/leaf.svg" alt="" />
          <span className="name">CS<b>leaf</b></span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" title={t('language')} onClick={toggleLang}><LangIcon /></button>
        <button className="icon-btn" title={t('theme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="icon-btn" title={t('settings')} onClick={() => openModal('settings')}><SettingsIcon /></button>
      </div>

      {/* hero */}
      <div className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-left">
            <h1>{lang === 'zh' ? <>在这里，<br/>安静地写完一篇论文。</> : <>Write your next paper,<br/> peacefully.</>}</h1>
            <p>{t('tagline')} {texInfo?.available && <>· {texInfo.distro} {lang === 'zh' ? '已就绪' : 'ready'}</>}</p>
            <div className="home-hero-cta">
              <button className="btn primary big" onClick={() => openModal('newproject')}>
                <PlusIcon width={15} height={15} /> {t('newProject')}
              </button>
              <button className="btn big" onClick={() => fileRef.current?.click()}>
                <UploadIcon width={14} height={14} /> {t('importZip')}
              </button>
              <input ref={fileRef} type="file" accept=".zip" hidden onChange={handleImport} />
            </div>
            <div className="home-stats">
              <span className="home-stat"><b>{projects.length}</b>{lang === 'zh' ? ' 个项目' : ' projects'}</span>
              <span className="home-stat-dot" />
              <span className="home-stat"><b>{templates.length}</b>{lang === 'zh' ? ' 套模板' : ' templates'}</span>
              <span className="home-stat-dot" />
              <span className={`home-stat ${texInfo?.available ? 'ok' : 'bad'}`}>
                {texInfo?.available ? <CheckIcon width={12} height={12} /> : <AlertIcon width={12} height={12} />}
                {texInfo?.available ? texInfo.distro : t('noTex')}
              </span>
              <span className="home-stat-dot" />
              <span className="home-stat muted"><CommandIcon width={12} height={12} /> Ctrl+Shift+P</span>
            </div>
          </div>
          <div className="home-hero-right" onClick={() => projects[0] && openProject(projects[0].id)}>
            <img src="/shot-preview.png" alt="" draggable={false} />
          </div>
        </div>
      </div>

      {/* projects / templates */}
      <div className="home-body">
        <div className="home-toolbar">
          <div className="home-tabs">
            <button className={`home-tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
              {t('myProjects')} <span className="home-tab-count">{projects.length}</span>
            </button>
            <button className={`home-tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
              {lang === 'zh' ? '模板库' : 'Templates'} <span className="home-tab-count">{templates.length}</span>
            </button>
          </div>
          <div className="grow" />
          {tab === 'projects' && (
            <>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <UploadIcon width={14} height={14} /> {t('importZip')}
              </button>
              <button className="btn primary" onClick={() => openModal('newproject')}>
                <PlusIcon width={14} height={14} /> {t('newProject')}
              </button>
            </>
          )}
          {tab === 'templates' && (
            <>
              <button className="btn" onClick={() => tplFileRef.current?.click()}>
                <UploadIcon width={14} height={14} /> {t('importTemplate')}
              </button>
              <input ref={tplFileRef} type="file" accept=".zip" hidden onChange={handleTemplateImport} />
              <span className="settings-hint" style={{ padding: '7px 12px' }}>
                {lang === 'zh' ? '导入 .zip 模板包（如 GitHub 上的模板仓库），或把项目「存为我的模板」' : 'Import a .zip template pack, or save any project as a template'}
              </span>
            </>
          )}
        </div>

        {tab === 'templates' ? (
          <div className="project-grid">
            {templates.map(tpl => {
              const cs = cover(tpl.id);
              return (
                <div key={tpl.id} className="project-card tpl-use-card" onClick={() => setDetailId(tpl.id)}>
                  <div className="top">
                    <div className="cover" style={{ background: cs.g }}>{cs.letter}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title">{templateName(tpl)}</div>
                      <div className="meta">
                        {(tpl.tags || []).map(tag => <span key={tag} className="badge">{tag}</span>)}
                        {tpl.custom && <span className="badge yellow">{lang === 'zh' ? '我的模板' : 'Mine'}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="tpl-use-desc">{tdesc(tpl)}</div>
                  <div className="proj-foot">
                    <span className="badge green">{tpl.compiler}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {tpl.custom && (
                        <button className="icon-btn" title={t('delete')} onClick={e => {
                          e.stopPropagation();
                          openDialog({
                            kind: 'confirm', title: t('confirmDelete'), danger: true, okText: t('delete'),
                            message: `${t('confirmDeleteMsg')} (${templateName(tpl)})`,
                            onOk: async () => {
                              try {
                                await api.deleteCustomTemplate(tpl.id);
                                loadProjects();
                                toast(lang === 'zh' ? '模板已删除' : 'Template deleted', 'success');
                              } catch (e2) { toast(e2.message, 'error'); }
                            },
                          });
                        }}><TrashIcon /></button>
                      )}
                      <button className="btn small primary" onClick={e => { e.stopPropagation(); useTemplate(tpl); }}>
                        {lang === 'zh' ? '使用' : 'Use'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : projects.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-art">🌿</div>
            <div className="home-empty-title">{lang === 'zh' ? '从一张白纸，或一套模板开始' : 'Start from a blank page, or a template'}</div>
            <div className="home-empty-sub">{t('emptyProjects')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn primary" onClick={() => openModal('newproject')}>
                <PlusIcon width={14} height={14} /> {t('newProject')}
              </button>
              <button className="btn" onClick={() => setTab('templates')}>
                {lang === 'zh' ? '浏览模板库' : 'Browse templates'}
              </button>
            </div>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map(p => {
              const cs = cover(p.template);
              const tpl = templateOf(p.template);
              return (
                <div key={p.id} className="project-card" onClick={() => openProject(p.id)}>
                  <div className="top">
                    <div className="cover" style={{ background: cs.g }}>{cs.letter}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="title">{p.name}</div>
                      <div className="meta">
                        <span>{fmtRel(p.updatedAt, lang)}</span>
                        {tpl && <><span>·</span><span className="badge">{templateName(tpl)}</span></>}
                        <span>·</span>
                        <span className="badge green">{p.compiler}</span>
                      </div>
                    </div>
                  </div>
                  <div className="proj-foot">
                    <span className="badge soft">{p.mainFile}</span>
                    <div className="actions" onClick={e => e.stopPropagation()}>
                      <button className="icon-btn" title={t('saveAsTemplate')} onClick={() => {
                        openDialog({
                          kind: 'input', title: t('saveAsTemplate'),
                          label: lang === 'zh' ? '模板名称（可选描述，用 | 分隔）' : 'Template name (optional: name | description)',
                          value: p.name, okText: t('save'),
                          onOk: async (v) => {
                            if (!v) return;
                            const [n, d] = v.split('|').map(s => s.trim());
                            try {
                              await api.saveCustomTemplate(p.id, { name: n, desc: d || '' });
                              await loadProjects();
                              toast(lang === 'zh' ? `已存为模板：${n}（在「模板库」中查看）` : `Saved as template: ${n}`, 'success', 3600);
                            } catch (e2) { toast(e2.message, 'error'); }
                          },
                        });
                      }}><BookmarkIcon /></button>
                      <button className="icon-btn" title={t('rename')} onClick={() => {
                        openDialogRename(p, renameProject, t);
                      }}><EditIcon /></button>
                      <button className="icon-btn" title={t('duplicate')} onClick={() => duplicateProject(p.id)}><CopyIcon /></button>
                      <a className="icon-btn" title={t('export')} href={`/api/projects/${p.id}/export`} download><DownloadIcon /></a>
                      <button className="icon-btn" title={t('delete')} onClick={() => {
                        openDialogDelete(p, removeProject, t);
                      }}><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="new-card" onClick={() => openModal('newproject')}>
              <PlusIcon width={18} height={18} />
              <span>{t('newProject')}</span>
            </div>
          </div>
        )}
      </div>
      <NewProjectModal />
      {detailId && (
        <TemplateDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onUse={(tpl) => { setDetailId(null); useTemplate(tpl); }}
        />
      )}
    </div>
  );
}

function openDialogRename(p, renameProject, t) {
  useStore.getState().openDialog({
    kind: 'input', title: t('rename'), value: p.name, okText: t('rename'),
    onOk: (name) => { if (name) renameProject(p.id, name); },
  });
}
function openDialogDelete(p, removeProject, t) {
  useStore.getState().openDialog({
    kind: 'confirm', title: t('confirmDelete'), danger: true, okText: t('delete'),
    message: `${t('confirmDeleteMsg')} (${p.name})`,
    onOk: () => removeProject(p.id),
  });
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
      <div className="modal" style={{ width: 'min(880px, calc(100vw - 48px))' }}>
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
            {templates.map(tpl => {
              const cs = cover(tpl.id);
              return (
                <div key={tpl.id} className={`tpl-card ${selected === tpl.id ? 'selected' : ''}`} onClick={() => setSelected(tpl.id)}>
                  <div className="icon" style={{ background: cs.g }}>{cs.letter}</div>
                  <div className="name">{tname(tpl)}</div>
                  <div className="desc">{tdesc(tpl)}</div>
                  <div className="tags">
                    {(tpl.tags || []).map(tag => <span key={tag} className="badge">{tag}</span>)}
                    <span className="badge green">{tpl.compiler}</span>
                  </div>
                </div>
              );
            })}
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
