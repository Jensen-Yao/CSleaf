import React from 'react';
import { useStore } from '../lib/store';
import { AlertIcon, WarnIcon, CloseIcon, TerminalIcon } from './Icons.jsx';

export default function LogPanel() {
  const t = useStore(s => s.t);
  const result = useStore(s => s.compileState.result);
  const tab = useStore(s => s.logOpenTab);
  const setTab = useStore(s => s.setLogTab);
  const openFile = useStore(s => s.openFile);
  const errors = result?.log?.errors || [];
  const warnings = result?.log?.warnings || [];

  const jumpTo = (file, line) => {
    if (!file) return;
    const p = file.replace(/^\.\//, '');
    openFile(p, true).then(() => {
      if (line) setTimeout(() => window.dispatchEvent(new CustomEvent('csleaf:reveal-line', { detail: line })), 260);
    });
  };

  return (
    <>
      <div className="log-tabs">
        <button className={`log-tab ${tab === 'issues' ? 'active' : ''}`} onClick={() => setTab('issues')}>
          {t('issues')}
          {errors.length > 0 && <span className="log-count err">{errors.length}</span>}
          {warnings.length > 0 && <span className="log-count warn">{warnings.length}</span>}
        </button>
        <button className={`log-tab ${tab === 'output' ? 'active' : ''}`} onClick={() => setTab('output')}>
          <TerminalIcon width={12} height={12} /> {t('output')}
        </button>
        {result && (
          <span className="log-count" style={{ marginLeft: 'auto' }}>
            {result.status} · {(result.elapsed / 1000).toFixed(1)}s
          </span>
        )}
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => useStore.setState({ logOpen: false })}>
          <CloseIcon width={12} height={12} />
        </button>
      </div>
      <div className="log-body">
        {tab === 'issues' ? (
          errors.length + warnings.length === 0 ? (
            <div className="log-empty">{result ? t('noIssues') : '—'}</div>
          ) : (
            <>
              {errors.map((e, i) => (
                <div key={`e${i}`} className="issue-row err" onClick={() => jumpTo(e.file, e.line)}>
                  <span className="icon"><AlertIcon width={14} height={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="msg">{e.message}</div>
                    {e.file && <div className="loc">{e.file}{e.line ? `:${e.line}` : ''}{e.page ? ` · p.${e.page}` : ''}</div>}
                    {e.context && <div className="ctx">{e.context}</div>}
                  </div>
                </div>
              ))}
              {warnings.map((w, i) => (
                <div key={`w${i}`} className="issue-row warning" onClick={() => jumpTo(w.file, w.line)}>
                  <span className="icon"><WarnIcon width={14} height={14} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="msg">{w.message}</div>
                    {w.file && <div className="loc">{w.file}{w.line ? `:${w.line}` : ''}{w.page ? ` · p.${w.page}` : ''}</div>}
                  </div>
                </div>
              ))}
            </>
          )
        ) : (
          <div className="log-output">{result?.output || '—'}</div>
        )}
      </div>
    </>
  );
}
