import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import {
  ZoomInIcon, ZoomOutIcon, ArrowLeftIcon, ArrowRightIcon, DownloadIcon,
  CrosshairIcon, AlertIcon, ListIcon, SearchIcon, ChevronsIcon, CloseIcon,
} from './Icons.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// render canvases at >= 2x device pixels for crisp text on any display
function renderMultiplier() {
  return Math.max(window.devicePixelRatio || 1, 2);
}

export default function PdfViewer() {
  const t = useStore(s => s.t);
  const project = useStore(s => s.project);
  const pdfFile = useStore(s => s.pdfFile);
  const pdfVersion = useStore(s => s.pdfVersion);
  const compileState = useStore(s => s.compileState);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(null); // null = not yet fitted; pages must not render
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [thumbsOpen, setThumbsOpen] = useState(true);
  const [syncMarker, setSyncMarker] = useState(null); // {page, top}
  const [search, setSearch] = useState({ open: false, query: '', matches: [], current: -1, busy: false });
  const searchTimer = useRef(null);

  const scrollRef = useRef(null);
  const pageRefs = useRef({});
  const url = project && pdfFile ? api.pdfUrl(project.id, pdfFile, pdfVersion) : null;

  // load document
  useEffect(() => {
    if (!url) { setPdfDoc(null); setNumPages(0); return; }
    let cancelled = false;
    setError(null);
    setSearch(s => ({ ...s, matches: [], current: -1 }));
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

  // auto fit width on load (before any page renders — scale stays null until here)
  useEffect(() => {
    if (!pdfDoc || !scrollRef.current) return;
    let cancelled = false;
    pdfDoc.getPage(1).then(p => {
      if (cancelled) return;
      const viewport = p.getViewport({ scale: 1 });
      const avail = (scrollRef.current.clientWidth || 700) - (thumbsOpen ? 190 : 60);
      setScale(Math.min(Math.max(avail / viewport.width, 0.4), 2.5));
    });
    return () => { cancelled = true; };
  }, [pdfDoc, thumbsOpen]);

  // track current page while scrolling
  const onScroll = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const mid = scroll.scrollTop + scroll.clientHeight * 0.35;
    let current = 1;
    for (const [pg, el] of Object.entries(pageRefs.current)) {
      if (el && el.offsetTop <= mid) current = parseInt(pg, 10);
    }
    setPage(current);
  }, []);

  const goToPage = useCallback((pg) => {
    const n = Math.min(Math.max(pg, 1), numPages || pg);
    const el = pageRefs.current[n];
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 14, behavior: 'smooth' });
    setPage(n);
  }, [numPages]);

  const fitPage = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || !pdfDoc) return;
    pdfDoc.getPage(1).then(p => {
      const vp = p.getViewport({ scale: 1 });
      const availH = scroll.clientHeight - 48;
      const availW = scroll.clientWidth - (thumbsOpen ? 190 : 60);
      setScale(Math.min(Math.max(Math.min(availW / vp.width, availH / vp.height), 0.3), 3));
    });
  }, [pdfDoc, thumbsOpen]);

  // ---------- forward sync (cursor → PDF) ----------
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
          const top = r.top * (scale || 1);
          setSyncMarker({
            page: r.page,
            top,
            height: Math.max((r.height || 8) * (scale || 1), 6),
            left: Math.max((r.left || 0) * (scale || 1) - 3, 0),
            width: Math.max((r.width || 0) * (scale || 1), 90),
          });
          // scroll so the target line sits in the middle of the viewport
          const el = pageRefs.current[r.page];
          if (el && scrollRef.current) {
            scrollRef.current.scrollTo({
              top: el.offsetTop + top - scrollRef.current.clientHeight / 2,
              behavior: 'smooth',
            });
            setPage(r.page);
          } else {
            goToPage(r.page);
          }
          setTimeout(() => setSyncMarker(null), 3200);
        } else if (r.available === false) {
          st.toast('SyncTeX not available in this TeX distribution', 'warn');
        }
      } catch {}
    };
    window.addEventListener('csleaf:forward-sync', onForward);
    return () => window.removeEventListener('csleaf:forward-sync', onForward);
  }, [scale, goToPage]);

  // ---------- PDF text search ----------
  useEffect(() => {
    if (!search.open) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(search.query), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search.query, search.open, pdfDoc, numPages]);

  async function runSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q || !pdfDoc) { setSearch(s => ({ ...s, matches: [], current: -1, busy: false })); return; }
    setSearch(s => ({ ...s, busy: true }));
    const matches = [];
    for (let pg = 1; pg <= numPages && matches.length < 800; pg++) {
      try {
        const p = await pdfDoc.getPage(pg);
        const tc = await p.getTextContent();
        const vp = p.getViewport({ scale: 1 }); // store in pdf units; scale applied at render
        for (const item of tc.items) {
          if (!item.str) continue;
          const idx = item.str.toLowerCase().indexOf(q);
          if (idx === -1) continue;
          const [x, y] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
          matches.push({
            page: pg,
            rect: { left: x, top: y - item.height, width: Math.max(item.width, q.length * 0.5), height: item.height },
            snippet: item.str.slice(Math.max(0, idx - 24), idx + q.length + 24),
          });
          if (matches.length >= 800) break;
        }
      } catch {}
    }
    setSearch(s => ({ ...s, matches, current: matches.length ? 0 : -1, busy: false }));
    if (matches.length) showMatch(matches[0]);
  }

  function showMatch(m) {
    goToPage(m.page);
    setSyncMarker({ page: m.page, top: null, rects: null, matchRect: m.rect });
    setTimeout(() => setSyncMarker(null), 3200);
  }

  function navSearch(dir) {
    setSearch(s => {
      if (!s.matches.length) return s;
      const next = (s.current + dir + s.matches.length) % s.matches.length;
      showMatch(s.matches[next]);
      return { ...s, current: next };
    });
  }

  // ---------- inverse sync (PDF → source) ----------
  const onPageDblClick = async (e, pageNo, canvas) => {
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

  return (
    <>
      <div className="pdf-toolbar">
        <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600, marginRight: 2 }}>
          {pdfFile || 'PDF'}
        </span>
        {numPages > 0 && <span className="badge" style={{ marginLeft: 2 }}>{numPages} {t('pagesUnit')}</span>}
        <div style={{ flex: 1 }} />
        <button className={`icon-btn ${thumbsOpen ? 'active' : ''}`} style={{ width: 26, height: 26 }}
          title={t('thumbnails')} onClick={() => setThumbsOpen(o => !o)}><ListIcon width={13} height={13} /></button>
        <button className={`icon-btn ${search.open ? 'active' : ''}`} style={{ width: 26, height: 26 }}
          title={t('search')} onClick={() => setSearch(s => ({ ...s, open: !s.open }))}><SearchIcon width={13} height={13} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => goToPage(page - 1)} disabled={page <= 1}><ArrowLeftIcon width={13} height={13} /></button>
        <input className="page-input" value={page} onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (v >= 1 && v <= numPages) goToPage(v);
        }} />
        <span className="page-ind">/ {numPages}</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => goToPage(page + 1)} disabled={page >= numPages}><ArrowRightIcon width={13} height={13} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setScale(s => Math.max((s || 1) - 0.15, 0.3))}><ZoomOutIcon width={13} height={13} /></button>
        <span className="page-ind" style={{ minWidth: 40 }}>{scale ? Math.round(scale * 100) + '%' : '…'}</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setScale(s => Math.min((s || 1) + 0.15, 4))}><ZoomInIcon width={13} height={13} /></button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('fitWidth')}
          onClick={() => {
            if (!pdfDoc || !scrollRef.current) return;
            pdfDoc.getPage(1).then(p => {
              const vp = p.getViewport({ scale: 1 });
              setScale(Math.min(Math.max((scrollRef.current.clientWidth - (thumbsOpen ? 190 : 60)) / vp.width, 0.4), 2.5));
            });
          }}><ChevronsIcon width={13} height={13} /></button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('fitPage')} onClick={fitPage}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/></svg>
        </button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('syncCursor')}
          onClick={() => window.dispatchEvent(new CustomEvent('csleaf:forward-sync'))}>
          <CrosshairIcon width={13} height={13} />
        </button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title={t('download')}
          onClick={() => { if (url) { const a = document.createElement('a'); a.href = url; a.download = pdfFile; a.click(); } }}>
          <DownloadIcon width={13} height={13} />
        </button>
      </div>

      {search.open && (
        <div className="pdf-searchbar">
          <SearchIcon width={13} height={13} style={{ color: 'var(--text2)' }} />
          <input autoFocus placeholder={t('findPlaceholder')} value={search.query}
            onChange={e => setSearch(s => ({ ...s, query: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); navSearch(e.shiftKey ? -1 : 1); }
              if (e.key === 'Escape') setSearch(s => ({ ...s, open: false }));
            }} spellCheck={false} />
          <span className="page-ind" style={{ minWidth: 70, textAlign: 'center' }}>
            {search.busy ? '…' : search.matches.length
              ? `${search.current + 1} / ${search.matches.length}`
              : search.query ? t('noMatches') : ''}
          </span>
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => navSearch(-1)}><ArrowLeftIcon width={12} height={12} style={{ transform: 'rotate(90deg)' }} /></button>
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => navSearch(1)}><ArrowLeftIcon width={12} height={12} style={{ transform: 'rotate(-90deg)' }} /></button>
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setSearch(s => ({ ...s, open: false }))}><CloseIcon width={12} height={12} /></button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {thumbsOpen && pdfDoc && numPages > 0 && (
          <div className="pdf-thumbs">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(pg => (
              <PdfThumb key={pg} doc={pdfDoc} pageNo={pg} active={pg === page} onClick={() => goToPage(pg)} />
            ))}
          </div>
        )}
        <div className="pdf-scroll" ref={scrollRef} onScroll={onScroll}>
          {!url ? (
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
                marker={syncMarker?.page === pg ? syncMarker : null}
                refFn={el => { pageRefs.current[pg] = el; }}
                onDblClick={onPageDblClick} />
            ))
          ) : (
            <div className="pdf-empty pulse">{t('loading')}</div>
          )}
        </div>
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

/** Single thumbnail (lazy-rendered). */
function PdfThumb({ doc, pageNo, active, onClick }) {
  const ref = React.useRef(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting) && !started.current) {
        started.current = true;
        render(cancelled);
      }
    }, { rootMargin: '300px 0px' });
    obs.observe(ref.current);
    return () => { cancelled = true; obs.disconnect(); };
  }, []);

  async function render(cancelled) {
    try {
      const p = await doc.getPage(pageNo);
      if (cancelled) return;
      const canvas = ref.current?.querySelector('canvas');
      if (!canvas) return;
      const base = p.getViewport({ scale: 1 });
      const s = 118 / base.width;
      const vp = p.getViewport({ scale: s * renderMultiplier() });
      const css = p.getViewport({ scale: s });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = css.width + 'px';
      canvas.style.height = css.height + 'px';
      await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } catch {}
  }

  return (
    <div ref={ref} className={`pdf-thumb ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="pdf-thumb-page" style={{ minHeight: 150 }}>
        <canvas width="1" height="1" />
      </div>
      <span className="pdf-thumb-num">{pageNo}</span>
    </div>
  );
}

class PdfPage extends React.Component {
  constructor(props) { super(props); this.canvasRef = React.createRef(); this.wrapRef = React.createRef(); this.renderToken = 0; this.state = { w: 0, h: 0, obs: null }; }

  componentDidMount() {
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) this.renderPage();
    }, { root: this.wrapRef.current?.closest('.pdf-scroll'), rootMargin: '700px 0px' });
    obs.observe(this.wrapRef.current);
    this.setState({ obs });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.scale !== this.props.scale || prevProps.doc !== this.props.doc) {
      this.renderPage();
    }
  }

  componentWillUnmount() { this.state.obs?.disconnect(); this.renderToken++; }

  /** Serialize renders: never two pdf.js tasks on the same canvas at once. */
  renderPage() {
    const token = ++this.renderToken;
    this._queue = Promise.resolve(this._queue)
      .catch(() => {})
      .then(() => (token === this.renderToken ? this.doRender(token) : null));
    return this._queue;
  }

  async doRender(token) {
    const { doc, pageNo, scale } = this.props;
    if (scale == null) return; // wait until fit-width has settled
    try {
      const page = await doc.getPage(pageNo);
      if (token !== this.renderToken) return;
      const canvas = this.canvasRef.current;
      if (!canvas) return;
      const mult = renderMultiplier();
      const viewport = page.getViewport({ scale: scale * mult });
      const cssViewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(cssViewport.width)}px`;
      canvas.style.height = `${Math.floor(cssViewport.height)}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (token !== this.renderToken) return; // a newer render superseded this one
      this.setState({ w: Math.floor(cssViewport.width), h: Math.floor(cssViewport.height) });
    } catch (e) { /* render cancelled */ }
  }

  render() {
    const { marker, matchRects, scale } = this.props;
    const hl = (matchRects || (marker && marker.matchRect ? [marker.matchRect] : null));
    return (
      <div className="pdf-page-wrap" ref={el => { this.wrapRef.current = el; this.props.refFn(el); }}
        style={{ width: this.state.w || 480, height: this.state.h || 620 }}
        onDoubleClick={(e) => {
          if (this.canvasRef.current) this.props.onDblClick(e, this.props.pageNo, this.canvasRef.current);
        }}>
        <canvas ref={this.canvasRef} />
        {marker && marker.top != null && (
          <div className="sync-marker" style={{
            top: marker.top,
            height: marker.height || 11,
            left: marker.left ?? 0,
            width: marker.width || '100%',
          }} />
        )}
        {hl && hl.map((r, i) => (
          <div key={i} className="pdf-match" style={{
            left: r.left * scale, top: r.top * scale,
            width: r.width * scale, height: Math.max(r.height * scale, 8),
          }} />
        ))}
      </div>
    );
  }
}
