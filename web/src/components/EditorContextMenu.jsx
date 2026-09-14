import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { CloseIcon, ChevronIcon } from './Icons.jsx';

/**
 * Fully localized (zh/en) replacements for Monaco's built-in English UI:
 *  - EditorContextMenu: custom right-click menu
 *  - FindReplaceBar: custom find & replace overlay
 */

export function openContextMenu(setMenu, editor) {
  return (e) => {
    e.preventDefault();
    const pos = editor.getTargetAtClientPoint(e.clientX, e.clientY);
    if (pos?.position) editor.setPosition(pos.position);
    setMenu({ x: e.clientX, y: e.clientY });
  };
}

export function EditorContextMenu({ menu, onClose, editor }) {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const setFind = useStore(s => s.findBarApi?.set);
  const ref = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const t0 = setTimeout(() => window.addEventListener('mousedown', onDown), 10);
    return () => { clearTimeout(t0); window.removeEventListener('mousedown', onDown); };
  }, [menu]);

  if (!menu || !editor) return null;

  const sel = editor.getSelection();
  const model = editor.getModel();
  const selText = sel && model ? model.getValueInRange(sel) : '';

  const items = [
    {
      label: t('cut'), hint: 'Ctrl+X', disabled: !selText,
      run: () => { navigator.clipboard.writeText(selText); editor.executeEdits('ctx', [{ range: sel, text: '' }]); },
    },
    { label: t('copy'), hint: 'Ctrl+C', disabled: !selText, run: () => navigator.clipboard.writeText(selText) },
    {
      label: t('paste'), hint: 'Ctrl+V', disabled: !navigator.clipboard?.readText,
      run: async () => {
        try {
          const txt = await navigator.clipboard.readText();
          editor.executeEdits('ctx', [{ range: sel, text: txt, forceMoveMarkers: true }]);
          editor.focus();
        } catch {}
      },
    },
    { label: t('selectAll'), hint: 'Ctrl+A', run: () => editor.setSelection(model.getFullModelRange()) },
    'sep',
    { label: t('find'), hint: 'Ctrl+F', run: () => useStore.getState().findBarApi?.open('find') },
    { label: t('replace'), hint: 'Ctrl+H', run: () => useStore.getState().findBarApi?.open('replace') },
    'sep',
    { label: t('compile'), hint: 'Ctrl+Enter', run: () => useStore.getState().compile() },
    { label: t('commandPalette'), hint: 'Ctrl+Shift+P', run: () => useStore.getState().openModal('palette') },
  ];

  const x = Math.min(menu.x, window.innerWidth - 230);
  const y = Math.min(menu.y, window.innerHeight - 340);

  return (
    <div className="dropdown-menu ctx-menu" ref={ref} style={{ left: x, top: y, position: 'fixed' }}
      onMouseDown={e => e.stopPropagation()}>
      {items.map((it, i) => it === 'sep' ? <div key={i} className="dropdown-sep" /> : (
        <button key={i} className="dropdown-item" disabled={it.disabled}
          onClick={() => { onClose(); it.run(); }}
          style={it.disabled ? { opacity: 0.4, cursor: 'default' } : undefined}>
          {it.label}
          {it.hint && <span className="check" style={{ opacity: 1, color: 'var(--text2)', fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function FindReplaceBar({ state, setState, editor }) {
  const t = useStore(s => s.t);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [total, setTotal] = useState(0);
  const [idx, setIdx] = useState(-1);
  const decoRef = useRef([]);
  const matchesRef = useRef([]);
  const inputRef = useRef(null);

  useEffect(() => { if (state.open) setTimeout(() => inputRef.current?.focus(), 30); }, [state.open, state.mode]);

  useEffect(() => {
    if (!state.open || !editor) return;
    refresh();
    return () => { try { editor.getModel()?.deltaDecorations(decoRef.current, []); } catch {} decoRef.current = []; };
  }, [state.open, query, matchCase]);

  function refresh() {
    const model = editor.getModel();
    if (!model) return;
    const matches = query ? model.findMatches(query, true, false, matchCase, null, false, 2000) : [];
    matchesRef.current = matches;
    const decos = matches.map((m, i) => ({
      range: m.range,
      options: { className: i === 0 ? 'csleaf-find-current' : 'csleaf-find-match', stickiness: 1 },
    }));
    decoRef.current = model.deltaDecorations(decoRef.current, decos);
    setTotal(matches.length);
    setIdx(matches.length ? 0 : -1);
    if (matches.length) {
      editor.setSelection(matches[0].range);
      editor.revealRangeInCenter(matches[0].range);
    }
  }

  function goto(next) {
    const matches = matchesRef.current;
    if (!matches.length) return;
    const i = (next + matches.length) % matches.length;
    setIdx(i);
    const decos = matches.map((m, j) => ({
      range: m.range,
      options: { className: j === i ? 'csleaf-find-current' : 'csleaf-find-match', stickiness: 1 },
    }));
    decoRef.current = editor.getModel().deltaDecorations(decoRef.current, decos);
    editor.setSelection(matches[i].range);
    editor.revealRangeInCenter(matches[i].range);
  }

  function replaceOne() {
    const matches = matchesRef.current;
    if (!matches.length || idx < 0) return;
    editor.executeEdits('findreplace', [{ range: matches[idx].range, text: replacement, forceMoveMarkers: true }]);
    editor.focus();
    setTimeout(() => { matchesRef.current = []; refresh(); gotoKeep(idx); }, 30);
  }
  function gotoKeep(i) {
    const matches = matchesRef.current;
    if (!matches.length) { setIdx(-1); setTotal(0); return; }
    const n = Math.min(i, matches.length - 1);
    setIdx(n); setTotal(matches.length);
    editor.setSelection(matches[n].range);
    editor.revealRangeInCenter(matches[n].range);
  }

  function replaceAll() {
    const model = editor.getModel();
    const matches = query ? model.findMatches(query, true, false, matchCase, null, false, 2000) : [];
    if (!matches.length) return;
    model.pushEditOperations([], matches.map(m => ({ range: m.range, text: replacement })).reverse(), () => null);
    editor.focus();
    setTimeout(refresh, 30);
  }

  function close() {
    try { editor.getModel()?.deltaDecorations(decoRef.current, []); } catch {}
    decoRef.current = [];
    setState({ ...state, open: false });
    editor.focus();
  }

  if (!state.open || !editor) return null;
  const replaceMode = state.mode === 'replace';

  return (
    <div className="findbar" onMouseDown={e => e.stopPropagation()}>
      <div className="findbar-row">
        <input ref={inputRef} className="findbar-input" placeholder={t('find')} value={query} spellCheck={false}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); goto(e.shiftKey ? idx - 1 : idx + 1); }
            if (e.key === 'Escape') close();
          }} />
        <span className="findbar-count">{query ? (total ? `${idx + 1} / ${total}` : t('noMatches')) : ''}</span>
        <button className="icon-btn" style={{ width: 24, height: 24 }} title={t('prevMatch')} onClick={() => goto(idx - 1)}>
          <ChevronIcon width={12} height={12} style={{ transform: 'rotate(-90deg)' }} />
        </button>
        <button className="icon-btn" style={{ width: 24, height: 24 }} title={t('nextMatch')} onClick={() => goto(idx + 1)}>
          <ChevronIcon width={12} height={12} style={{ transform: 'rotate(90deg)' }} />
        </button>
        <button className={`icon-btn ${matchCase ? 'active' : ''}`} style={{ width: 24, height: 24, fontSize: 11, fontWeight: 700 }}
          title={t('caseSensitive')} onClick={() => setMatchCase(v => !v)}>Aa</button>
        {replaceMode && <button className="btn small" onClick={replaceAll}>{t('replaceAll')}</button>}
        <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={close}><CloseIcon width={12} height={12} /></button>
      </div>
      {replaceMode && (
        <div className="findbar-row" style={{ marginTop: 6 }}>
          <input className="findbar-input" placeholder={t('replaceWith')} value={replacement} spellCheck={false}
            onChange={e => setReplacement(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } if (e.key === 'Escape') close(); }} />
          <button className="btn small primary" onClick={replaceOne}>{t('replaceThis')}</button>
        </div>
      )}
    </div>
  );
}
