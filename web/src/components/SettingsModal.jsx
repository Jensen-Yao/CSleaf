import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { CheckIcon } from './Icons.jsx';

export default function SettingsModal() {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const closeModal = useStore(s => s.closeModal);
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const setLang = useStore(s => s.setLang);
  const editorPrefs = useStore(s => s.editor);
  const setEditorPref = useStore(s => s.setEditorPref);
  const toast = useStore(s => s.toast);

  const [server, setServer] = useState(null);
  const [texInfo, setTexInfo] = useState(null);

  useEffect(() => {
    api.getSettings().then(setServer);
    setTexInfo(useStore.getState().texInfo);
  }, []);

  async function save() {
    try {
      const saved = await api.saveSettings({
        texPath: server.texPath,
        timeoutMs: Number(server.timeoutMs) * 1000,
        autoCompile: server.autoCompile,
        autoOpenBrowser: server.autoOpenBrowser,
      });
      useStore.setState({ serverSettings: saved });
      toast(t('saved'), 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function redetect() {
    await save();
    const info = await api.texInfo(true);
    setTexInfo(info);
    useStore.setState({ texInfo: info });
  }

  if (!server) return null;

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal narrow">
        <div className="modal-head"><h3>{t('settings')}</h3></div>
        <div className="modal-body">

          <div className="form-row">
            <label>{t('texPath')}</label>
            <input value={server.texPath || ''} onChange={e => setServer({ ...server, texPath: e.target.value })}
              placeholder="e.g. E:\texlive\2026\bin\windows" spellCheck={false} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              {texInfo?.available ? (
                <span className="badge green"><CheckIcon width={11} height={11} /> {texInfo.distro}{texInfo.version ? ` — ${texInfo.version}` : ''}</span>
              ) : (
                <span className="badge red">{t('noTex')} — {t('noTexHint')}</span>
              )}
              <button className="btn small" onClick={redetect}>{t('reDetect')}</button>
            </div>
          </div>

          <div className="form-row">
            <label>{t('timeout')}</label>
            <input type="number" min={10} max={600} value={Math.round(server.timeoutMs / 1000)}
              onChange={e => setServer({ ...server, timeoutMs: Number(e.target.value) * 1000 })} style={{ width: 120 }} />
          </div>

          <CheckRow label={t('autoCompile')} checked={server.autoCompile} onChange={v => setServer({ ...server, autoCompile: v })} />
          <CheckRow label={t('autoOpen')} checked={server.autoOpenBrowser} onChange={v => setServer({ ...server, autoOpenBrowser: v })} />

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div className="form-row">
            <label>{t('theme')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn ${theme === 'dark' ? 'primary' : ''}`} onClick={() => setTheme('dark')}>{t('dark')}</button>
              <button className={`btn ${theme === 'light' ? 'primary' : ''}`} onClick={() => setTheme('light')}>{t('light')}</button>
            </div>
          </div>

          <div className="form-row">
            <label>{t('language')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn ${lang === 'zh' ? 'primary' : ''}`} onClick={() => setLang('zh')}>中文</button>
              <button className={`btn ${lang === 'en' ? 'primary' : ''}`} onClick={() => setLang('en')}>English</button>
            </div>
          </div>

          <div className="form-row">
            <label>{t('fontSize')}: {editorPrefs.fontSize}px</label>
            <input type="range" min={11} max={22} value={editorPrefs.fontSize}
              onChange={e => setEditorPref({ fontSize: Number(e.target.value) })} style={{ width: 200 }} />
          </div>

          <CheckRow label={t('wordWrap')} checked={editorPrefs.wordWrap} onChange={v => setEditorPref({ wordWrap: v })} />
          <CheckRow label={t('minimap')} checked={editorPrefs.minimap} onChange={v => setEditorPref({ minimap: v })} />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={closeModal}>{t('cancel')}</button>
          <button className="btn primary" onClick={() => { save(); closeModal(); }}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: 'var(--accent)', padding: 0 }} />
      {label}
    </label>
  );
}
