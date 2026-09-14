import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { AlertIcon } from './Icons.jsx';

/** Bilingual in-app input / confirm dialogs (replaces native prompt & confirm). */
export default function DialogHost() {
  const dialog = useStore(s => s.dialog);
  const closeDialog = useStore(s => s.closeDialog);
  const lang = useStore(s => s.lang);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (dialog?.kind === 'input') { setValue(dialog.value ?? ''); setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30); }
  }, [dialog]);

  if (!dialog) return null;

  const ok = () => {
    const d = useStore.getState().dialog;
    closeDialog();
    if (d?.kind === 'input' && !String(value).trim()) return;
    d?.onOk?.(String(value).trim());
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(); }}>
      <div className="modal narrow" style={{ width: 'min(430px, calc(100vw - 48px))' }} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head" style={{ paddingBottom: dialog.kind === 'confirm' ? 2 : undefined }}>
          <h3>{dialog.title}{dialog.danger && dialog.kind === 'confirm' && <AlertIcon width={14} height={14} style={{ color: 'var(--danger)', marginLeft: 7, verticalAlign: '-2px' }} />}</h3>
        </div>
        <div className="modal-body" style={{ paddingTop: dialog.kind === 'confirm' ? 4 : undefined }}>
          {dialog.kind === 'input' ? (
            <div className="form-row">
              {dialog.label && <label>{dialog.label}</label>}
              <input ref={inputRef} value={value} placeholder={dialog.placeholder || ''}
                spellCheck={false}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); ok(); }
                  if (e.key === 'Escape') closeDialog();
                }} />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.6 }}>{dialog.message}</div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={closeDialog}>{lang === 'zh' ? '取消' : 'Cancel'}</button>
          <button className={`btn ${dialog.danger ? 'danger' : 'primary'}`} onClick={ok}>
            {dialog.okText || (lang === 'zh' ? '确定' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}
