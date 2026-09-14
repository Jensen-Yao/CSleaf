import React, { useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import TopBar from './TopBar.jsx';
import SideBar from './SideBar.jsx';
import EditorPane from './EditorPane.jsx';
import PdfViewer from './PdfViewer.jsx';
import LogPanel from './LogPanel.jsx';
import StatusBar from './StatusBar.jsx';

export default function Workspace() {
  const bodyRef = useRef(null);
  const setLayout = useStore(s => s.setLayout);
  const layout = useStore(s => s.layout);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const previewOpen = useStore(s => s.previewOpen);
  const logOpen = useStore(s => s.logOpen);
  const refreshTree = useStore(s => s.refreshTree);

  // keyboard shortcuts (global)
  useEffect(() => {
    const onKey = (e) => {
      const s = useStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); s.saveAll(); }
      else if (key === 'enter') { e.preventDefault(); s.compile(); }
      else if (key === 'p' && e.shiftKey) { e.preventDefault(); s.openModal('palette'); }
      else if (key === 'p') { e.preventDefault(); s.openModal('quickopen'); }
      else if (key === 'b') { e.preventDefault(); s.togglePanel('sidebar'); }
      else if (key === 'e' && e.shiftKey) { e.preventDefault(); s.togglePanel('preview'); }
      else if (key === 'j') { e.preventDefault(); s.togglePanel('log'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // refresh tree when window regains focus (catch external file changes)
  useEffect(() => {
    const onFocus = () => refreshTree();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const startDrag = (kind) => (e) => {
    e.preventDefault();
    const body = bodyRef.current;
    const onMove = (ev) => {
      const rect = body.getBoundingClientRect();
      if (kind === 'sidebar') {
        const w = Math.min(Math.max(ev.clientX - rect.left, 170), 460);
        setLayout({ sidebarWidth: w });
      } else if (kind === 'preview') {
        const w = Math.min(Math.max(rect.right - ev.clientX, 320), rect.width - 380);
        setLayout({ previewWidth: w });
      }
    };
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    document.body.style.cursor = kind === 'log' ? 'row-resize' : 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startLogDrag = () => (e) => {
    e.preventDefault();
    const body = bodyRef.current;
    const onMove = (ev) => {
      const rect = body.getBoundingClientRect();
      const h = Math.min(Math.max(rect.bottom - ev.clientY, 100), rect.height - 140);
      setLayout({ logHeight: h });
    };
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="workspace">
      <TopBar />
      <div className="workspace-body" ref={bodyRef}>
        {sidebarOpen && (
          <>
            <div className="pane sidebar" style={{ width: layout.sidebarWidth, flex: 'none' }}>
              <SideBar />
            </div>
            <div className="splitter" onMouseDown={startDrag('sidebar')} />
          </>
        )}
        <div className="pane editor-pane" style={{ flex: 1 }}>
          <EditorPane />
        </div>
        {previewOpen && (
          <>
            <div className="splitter" onMouseDown={startDrag('preview')} />
            <div className="pane pdf-pane" style={{ width: layout.previewWidth, flex: 'none' }}>
              <PdfViewer />
            </div>
          </>
        )}
      </div>
      {logOpen && (
        <>
          <div className="splitter h" onMouseDown={startLogDrag()} />
          <div className="log-panel" style={{ height: layout.logHeight }}>
            <LogPanel />
          </div>
        </>
      )}
      <StatusBar />
    </div>
  );
}
