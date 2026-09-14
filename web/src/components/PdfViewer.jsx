import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import {
  ZoomInIcon, ZoomOutIcon, ArrowLeftIcon, ArrowRightIcon, DownloadIcon,
  CrosshairIcon, RefreshIcon, AlertIcon,
} from './Icons.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfViewer() {
  const t = useStore(s => s.t);
  const project = useStore(s => s.project);
  const pdfFile = useStore(s => s.pdfFile);
  const pdfVersion = useStore(s => s.pdfVersion);
  const compileState = useStore(s => s.compileState);
  const theme = useStore(s => s.theme);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [marker, setMarker] = useState(null); // {page, top, height}
  const scrollRef = useRef(null);
  const pageRefs = useRef({});

  const url = project && pdfFile ? api.pdfUrl(project.id, pdfFile, pdfVersion) : null;

  // load document
  useEffect(() => {
    if (!url) { setPdfDoc(null); setNumPages(0); return; }
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('PDF not found');
        const data = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data }).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (e) {
        if (!cancelled) { setPdfDoc(null); setError(e.message); }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // fit width on first load / resize
  const fitWidth = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || !numPages) return;
    // approximate: page width ≈ A4 612pt → we adjust after first render instead
  }, [numPages]);

  // auto scale to fit width on document load
  useEffect(() => {
    if (!pdfDoc || !scrollRef.current) return;
    pdfDoc.getPage(1).then(p => {
      const viewport = p.getViewport({ scale: 1 });
      const avail = scrollRef.current.clientWidth - 48;
      setScale(Math.min(Math.max(avail / viewport.width, 0.4), 2.5));
    });
  }, [pdfDoc]);

  // track current page on scroll
  const onScroll = () => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const mid = scroll.scrollTop + scroll.clientHeight * 0.35;
    let current = 1;
    for (const [pg, el] of Object.entries(pageRefs.current)) {
      if (!el) continue;
      if (el.offsetTop <= mid) current = parseInt(pg, 10);
    }
    setPage(current);
  };

  const goToPage = (pg) => {
    const el = pageRefs.current[pg];
    if (el) scrollRef.current.scrollTo({ top: el.offsetTop - 14, behavior: 'smooth' });
  };

  // ---- forward sync (cursor → PDF) ----
  useEffect(() => {
    const onForward = async () => {
      const st = useStore.getState();
      if (!st.project || !st.pdfFile || !st.activePath) return;
      const ed = window.__csleaf_editor;
      const pos = ed ? ed.getPosition() : { lineNumber: st.cursor.line, column: st.cursor.col };
      try {
        const r = await api.synctexView(st.project.id, {
          pdf: st.pdfFile, file: st.activePath, line: pos.lineNumber, col: pos.column,
        });
        if (r.available && r.match) {
          setMarker({ page: r.page, top: r.y * scale, height: 12 });
          goToPage(r.page);
          setTimeout(() => setMarker(null), 2400);
        } else if (r.available === false) {
          st.toast('SyncTeX not available in this TeX distribution', 'warn');
        }
      } catch {}
    };
    window.addEventListener('csleaf:forward-sync', onForward);
    return () => window.removeEventListener('csleaf:forward-sync', onForward);
  }, [scale]);

  // expose editor instance for forward sync position
  useEffect(() => {
    const setEd = () => {};
    return setEd;
  }, []);

  // ---- inverse sync (PDF → source) ----
  const onPageDblClick = async (e, pageNo, pdfPage, canvas) => {
    const st = useStore.getState();
    if (!st.pdfFile) return;
    const rect = canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / scale;
    const fy = (e.clientY - rect.top) / scale;
    try {
      const r = await api.synctexEdit(st.project.id, { pdf: st.pdfFile, page: pageNo, x: fx, y: fy });
      if (r.match && r.file) {
        window.dispatchEvent(new CustomEvent('csleaf:synctex-jump', { detail: { path: r.file, line: r.line } }));
      }
    } catch {}
  };

  const running = compileState.running;
  const pdfUrl = project && pdfFile ? api.pdfUrl(project.id, pdfFile, pdfVersion) : null;

  return (
    <>
      <div className="pdf-toolbar">
        <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600, marginRight: 4 }}>
          {pdfFile || 'PDF'}
        </span>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => goToPage(page - 1)} disabled={page <= 1} title="◀"><ArrowLeftIcon width={13} height={13} /></button>
        <input className="page-input" value={page} onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (v >= 1 && v <= numPages) goToPage(v);
        }} />
        <span className="page-ind">/ {numPages}</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => goToPage(page + 1)} disabled={page >= numPages} title="▶"><ArrowRightIcon width={13} height={13} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setScale(s => Math.max(s - 0.15, 0.3))}><ZoomOutIcon width={13} height={13} /></button>
        <span className="page-ind" style={{ minWidth: 40 }}>{Math.round(scale * 100)}%</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setScale(s => Math.min(s + 0.15, 4))}><ZoomInIcon width={13} height={13} /></button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('syncCursor')}
          onClick={() => window.dispatchEvent(new CustomEvent('csleaf:forward-sync'))}>
          <CrosshairIcon width={13} height={13} />
        </button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('download')}
          onClick={() => { if (pdfUrl) { const a = document.createElement('a'); a.href = pdfUrl; a.download = pdfFile; a.click(); } }}>
          <DownloadIcon width={13} height={13} />
        </button>
      </div>

      <div className="pdf-scroll" ref={scrollRef} onScroll={onScroll}>
        {!pdfUrl ? (
          <EmptyState t={t} running={running} result={compileState.result} />
        ) : running ? (
          <div className="pdf-empty"><span className="pulse">{t('compilingPdf')}</span></div>
        ) : error ? (
          <div className="pdf-empty"><AlertIcon />
            <div>{t('compileFailed')}</div>
            <div className="pdf-error-list">
              {compileState.result?.log?.errors?.slice(0, 5).map((e, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--danger)' }}>✗</span> {e.message}
                  {e.file ? <div style={{ color: 'var(--text2)' }}>{e.file}:{e.line ?? '?'}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : pdfDoc ? (
          Array.from({ length: numPages }, (_, i) => i + 1).map(pg => (
            <PdfPage key={`${pdfVersion}-${pg}`} doc={pdfDoc} pageNo={pg} scale={scale}
              marker={marker?.page === pg ? marker : null}
              refFn={el => { pageRefs.current[pg] = el; }}
              onDblClick={onPageDblClick} />
          ))
        ) : (
          <div className="pdf-empty pulse">{t('loading')}</div>
        )}
      </div>
    </>
  );
}

function EmptyState({ t, running, result }) {
  const errors = result?.log?.errors || [];
  return (
    <div className="pdf-empty">
      {running ? (
        <span className="pulse">{t('compilingPdf')}</span>
      ) : errors.length ? (
        <>
          <AlertIcon />
          <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{t('compileFailed')}</div>
          <div className="pdf-error-list">
            {errors.slice(0, 6).map((e, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div>{e.message}</div>
                {e.file && <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.file}{e.line ? `:${e.line}` : ''}</div>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          <div>{t('noPdf')}</div>
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
        </>
      )}
    </div>
  );
}

class PdfPage extends React.Component {
  constructor(props) { super(props); this.canvasRef = React.createRef(); this.wrapRef = React.createRef(); this.state = { rendered: false, w: 0, h: 0, obs: null }; }

  componentDidMount() {
    // lazy render when near viewport
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { this.renderPage(); }
    }, { root: this.wrapRef.current?.closest('.pdf-scroll'), rootMargin: '600px 0px' });
    obs.observe(this.wrapRef.current);
    this.setState({ obs });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.scale !== this.props.scale || prevProps.doc !== this.props.doc) {
      this.setState({ rendered: false });
      if (this.wrapRef.current?.offsetParent !== null) this.renderPage();
    }
  }

  componentWillUnmount() { this.state.obs?.disconnect(); }

  async renderPage() {
    const { doc, pageNo, scale } = this.props;
    try {
      const page = await doc.getPage(pageNo);
      const canvas = this.canvasRef.current;
      if (!canvas) return;
      const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      const cssViewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(cssViewport.width)}px`;
      canvas.style.height = `${Math.floor(cssViewport.height)}px`;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      this.setState({ rendered: true, w: cssViewport.width, h: cssViewport.height });
    } catch (e) { /* page render cancelled */ }
  }

  render() {
    const { marker } = this.props;
    return (
      <div className="pdf-page-wrap" ref={el => { this.wrapRef.current = el; this.props.refFn(el); }}
        style={{ width: this.state.w || 480, height: this.state.h || 620 }}
        onDoubleClick={(e) => {
          if (this.state.rendered) this.props.onDblClick(e, this.props.pageNo, null, this.canvasRef.current);
        }}>
        <canvas ref={this.canvasRef} />
        {marker && <div className="sync-marker" style={{ top: marker.top }} />}
      </div>
    );
  }
}
