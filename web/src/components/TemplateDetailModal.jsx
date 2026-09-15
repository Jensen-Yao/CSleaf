import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { cover } from './HomePage.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const COMPILER_HINTS = {
  latexmk: { zh: '自动多轮编译 + 参考文献', en: 'auto reruns + BibTeX' },
  pdflatex: { zh: '经典引擎 · 纯英文', en: 'classic · English-only' },
  xelatex: { zh: '中文论文（系统字体）', en: 'Chinese docs (system fonts)' },
  lualatex: { zh: '新一代引擎', en: 'modern engine' },
};

/** Template detail dialog: live preview (server-compiled), description, source. */
export default function TemplateDetailModal({ id, onClose, onUse }) {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('preview'); // preview | source
  const [source, setSource] = useState(null);
  const [sourcePath, setSourcePath] = useState('main.tex');
  const [previewPages, setPreviewPages] = useState(null); // [dataURL]
  const [previewErr, setPreviewErr] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    api.templateDetail(id).then(setDetail).catch(() => setPreviewErr('failed'));
    return () => { cancelRef.current = true; };
  }, [id]);

  useEffect(() => {
    if (!detail || tab !== 'preview') return;
    let cancelled = false;
    setPreviewPages(null);
    setPreviewErr(null);
    (async () => {
      try {
        const res = await fetch(api.templatePreviewUrl(id));
        if (!res.ok) throw new Error(await res.json().then(j => j.error).catch(() => 'preview failed'));
        const data = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data }).promise;
        const pages = [];
        const n = Math.min(doc.numPages, 3);
        for (let p = 1; p <= n; p++) {
          if (cancelled) return;
          const page = await doc.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          const scale = 460 / vp.width;
          const viewport = page.getViewport({ scale: scale * 2 });
          const css = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          canvas.style.width = css.width + 'px'; canvas.style.height = css.height + 'px';
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          pages.push(canvas.toDataURL('image/jpeg', 0.82));
        }
        if (!cancelled) setPreviewPages(pages);
      } catch (e) {
        if (!cancelled) setPreviewErr(e.message || 'preview failed');
      }
    })();
    return () => { cancelled = true; };
  }, [detail, tab, id]);

  useEffect(() => {
    if (tab !== 'source' || !detail || source) return;
    loadSource('main.tex');
  }, [tab, detail]);

  async function loadSource(p) {
    setSourcePath(p);
    setSource(null);
    try {
      const d = await api.templateFile(id, p);
      setSource(d.content);
    } catch { setSource('// failed to load'); }
  }

  if (!detail) {
    return (
      <div className="modal-overlay" onMouseDown={onClose}>
        <div className="modal narrow"><div className="modal-body"><div className="log-empty">…</div></div></div>
      </div>
    );
  }

  const cs = cover(detail.id);
  const name = lang === 'zh' ? detail.name : (detail.nameEn || detail.name);
  const desc = lang === 'zh' ? (detail.longDesc || detail.desc) : (detail.descEn || detail.desc);
  const hint = COMPILER_HINTS[detail.compiler]?.[lang] || detail.compiler;

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal tpl-detail-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="tpl-detail-head">
          <div className="cover" style={{ background: cs.g, width: 46, height: 46, borderRadius: 12 }}>{cs.letter}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tpl-detail-name">{name}</div>
            <div className="tpl-detail-tags">
              {(detail.tags || []).map(tag => <span key={tag} className="badge">{tag}</span>)}
              <span className="badge green" title={hint}>{detail.compiler}</span>
              {detail.custom && <span className="badge yellow">{lang === 'zh' ? '我的模板' : 'My templates'}</span>}
            </div>
          </div>
          <button className="btn primary" onClick={() => onUse(detail)}>{lang === 'zh' ? '使用此模板' : 'Use this template'}</button>
        </div>

        <div className="tpl-detail-tabs">
          <button className={`home-tab ${tab === 'preview' ? 'active' : ''}`} style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setTab('preview')}>
            {lang === 'zh' ? '编译预览' : 'Preview'}
          </button>
          <button className={`home-tab ${tab === 'source' ? 'active' : ''}`} style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setTab('source')}>
            {lang === 'zh' ? '源码' : 'Source'}
          </button>
        </div>

        <div className="tpl-detail-body">
          {tab === 'preview' && (
            <>
              <p className="tpl-detail-desc">{desc}</p>
              {previewErr ? (
                <div className="log-empty">{lang === 'zh' ? `预览生成失败：${previewErr}` : `Preview failed: ${previewErr}`}</div>
              ) : previewPages ? (
                <div className="tpl-preview-row">
                  {previewPages.map((src, i) => <img key={i} src={src} alt={`page ${i + 1}`} />)}
                </div>
              ) : (
                <div className="tpl-preview-loading pulse">
                  {lang === 'zh' ? '正在真实编译模板生成预览…（首次约 3-8 秒，之后秒开）' : 'Compiling the template for a live preview… (first time takes a few seconds)'}
                </div>
              )}
              <div className="tpl-files">
                <div className="tpl-files-title">{lang === 'zh' ? '包含文件' : 'Included files'}</div>
                {(detail.files || []).map(f => (
                  <button key={f.path} className={`tpl-file ${f.path === sourcePath ? 'active' : ''}`} onClick={() => { setTab('source'); loadSource(f.path); }}>
                    {f.path}{f.size > 1024 ? ` · ${(f.size / 1024).toFixed(1)} KB` : ''}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'source' && (
            <div className="tpl-source">
              <div className="tpl-files" style={{ marginBottom: 10 }}>
                {(detail.files || []).map(f => (
                  <button key={f.path} className={`tpl-file ${f.path === sourcePath ? 'active' : ''}`} onClick={() => loadSource(f.path)}>{f.path}</button>
                ))}
              </div>
              {source == null ? <div className="log-empty">…</div> : (
                <pre className="tpl-source-code">{source}</pre>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>{lang === 'zh' ? '关闭' : 'Close'}</button>
          <button className="btn primary" onClick={() => onUse(detail)}>{lang === 'zh' ? '使用此模板创建项目' : 'Create with this template'}</button>
        </div>
      </div>
    </div>
  );
}
