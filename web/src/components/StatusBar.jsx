import React from 'react';
import { useStore } from '../lib/store';

export default function StatusBar() {
  const t = useStore(s => s.t);
  const texInfo = useStore(s => s.texInfo);
  const cursor = useStore(s => s.cursor);
  const wordCount = useStore(s => s.wordCount);
  const lang = useStore(s => s.lang);
  const project = useStore(s => s.project);
  const serverSettings = useStore(s => s.serverSettings);
  const compileState = useStore(s => s.compileState);
  const reDetectTex = useStore(s => s.reDetectTex);
  const loadSystem = useStore(s => s.loadSystem);
  const openModal = useStore(s => s.openModal);

  async function toggleAutoCompile() {
    const next = !serverSettings.autoCompile;
    useStore.setState({ serverSettings: { ...serverSettings, autoCompile: next } });
    try {
      const { api } = await import('../lib/api');
      await api.saveSettings({ autoCompile: next });
    } catch {}
  }

  if (!project) return null;

  return (
    <div className="statusbar">
      <span
        className={`item clickable ${texInfo?.available ? 'green' : ''}`}
        title={texInfo?.version || t('noTexHint')}
        onClick={async () => { const info = await reDetectTex(); loadSystem(); }}>
        {texInfo?.available ? `● ${texInfo.distro}${texInfo.version ? ` · ${texInfo.version.replace(/^.*?(TeX Live|MiKTeX|TinyTeX)/, '$1')}` : ''}` : `○ ${t('noTex')}`}
      </span>
      <span className="item">{project.compiler} · {project.mainFile}</span>
      <span className="spacer" />
      {compileState.running && <span className="item pulse green">● {t('compiling')}…</span>}
      <span className="item clickable" onClick={toggleAutoCompile}
        title={t('autoCompile')}>
        {serverSettings.autoCompile ? '⟳ ON' : '⟳ OFF'}
      </span>
      <span className="item" onClick={() => openModal('shortcuts')} style={{ cursor: 'pointer' }}>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span className="item clickable" onClick={() => openModal('stats')}
        title={`${t('statsTitle')} — ${t('wordCount')}`}>
        {t('wordCount')} {lang === 'zh'
          ? `${wordCount.cjk + wordCount.words}`
          : wordCount.cjk ? `${wordCount.cjk} CJK · ${wordCount.words} words` : `${wordCount.words}`}
      </span>
    </div>
  );
}
