import React, { useEffect, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useStore } from '../lib/store';
import { registerLatex } from '../lib/latex/language.js';
import { countWords, parseOutline } from '../lib/latex/analyze.js';
import { FileIcon, CloseIcon } from './Icons.jsx';

// bundle monaco locally (offline-friendly, CDN-free)
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
self.MonacoEnvironment = { getWorker: () => new editorWorker() };
loader.config({ monaco });

let registered = false;

export default function EditorPane() {
  const tabs = useStore(s => s.tabs);
  const activePath = useStore(s => s.activePath);
  const theme = useStore(s => s.theme);
  const editor = useStore(s => s.editor);
  const openFile = useStore(s => s.openFile);
  const closeTab = useStore(s => s.closeTab);
  const t = useStore(s => s.t);

  const activeTab = tabs.find(tb => tb.path === activePath);

  function fileIconColor(name) {
    if (/\.tex$/i.test(name)) return '#5ec8a0';
    if (/\.bib$/i.test(name)) return '#d8a657';
    if (/\.md$/i.test(name)) return '#7dd3fc';
    return 'var(--text2)';
  }

  return (
    <>
      <div className="editor-tabs">
        {tabs.map(tb => (
          <div key={tb.path}
            className={`editor-tab ${tb.path === activePath ? 'active' : ''}`}
            onClick={() => useStore.getState().setActive(tb.path)}
            onDoubleClick={() => closeTab(tb.path)}
            onAuxClick={e => { if (e.button === 1) closeTab(tb.path); }}>
            <FileIcon className="fileicon" style={{ color: fileIconColor(tb.name) }} />
            <span>{tb.name}</span>
            {tb.dirty && <span className="dot" title={t('unsavedDot')} />}
            <span className="close" onClick={e => { e.stopPropagation(); closeTab(tb.path); }}>
              <CloseIcon />
            </span>
          </div>
        ))}
      </div>
      <div className="editor-host">
        {activeTab ? (
          <MonacoForTab key={activeTab.path} tab={activeTab} />
        ) : (
          <div className="empty-editor">
            <FileIcon />
            <div>Ctrl+P · {t('quickOpen')}</div>
          </div>
        )}
      </div>
    </>
  );
}

function MonacoForTab({ tab }) {
  const theme = useStore(s => s.theme);
  const editor = useStore(s => s.editor);
  const lang = useStore(s => s.lang);
  const editorRef = useRef(null);
  const contentRef = useRef(tab.content);
  contentRef.current = tab.content;

  useEffect(() => { if (!registered) { registerLatex(monaco); registered = true; } }, []);

  // listen for outline → reveal-line events
  useEffect(() => {
    const onReveal = (e) => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.revealLineInCenter(e.detail);
      ed.setPosition({ lineNumber: e.detail, column: 1 });
      ed.focus();
    };
    window.addEventListener('csleaf:reveal-line', onReveal);
    return () => window.removeEventListener('csleaf:reveal-line', onReveal);
  }, []);

  // synctex jump-to-line events
  useEffect(() => {
    const onJump = (e) => {
      if (e.detail.path !== tab.path) {
        useStore.getState().openFile(e.detail.path, true).then(() => {
          setTimeout(() => window.dispatchEvent(new CustomEvent('csleaf:reveal-line', { detail: e.detail.line })), 250);
        });
      } else {
        window.dispatchEvent(new CustomEvent('csleaf:reveal-line', { detail: e.detail.line }));
      }
    };
    window.addEventListener('csleaf:synctex-jump', onJump);
    return () => window.removeEventListener('csleaf:synctex-jump', onJump);
  }, [tab.path]);

  return (
    <Editor
      language={/\.bib$/i.test(tab.name) ? 'plaintext' : (/\.md$/i.test(tab.name) ? 'markdown' : (/\.sty$|\.cls$/i.test(tab.name) ? 'latex' : 'latex'))}
      theme={theme === 'dark' ? 'csleaf-dark' : 'csleaf-light'}
      value={contentRef.current}
      onMount={(editor, monacoInst) => {
        editorRef.current = editor;
        window.__csleaf_editor = editor;
        editor.onDidChangeCursorPosition((e) => {
          useStore.getState().setCursor({ line: e.position.lineNumber, col: e.position.column });
        });
        editor.onDidChangeModelContent(() => {
          const value = editor.getValue();
          useStore.getState().updateContent(tab.path, value);
          useStore.getState().setOutline(parseOutline(value));
          useStore.getState().setWordCount(countWords(value));
        });
        // initial outline
        useStore.getState().setOutline(parseOutline(tab.content));
        useStore.getState().setWordCount(countWords(tab.content));
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          useStore.getState().compile();
        });
        editor.addAction({
          id: 'csleaf.forward-sync',
          label: 'SyncTeX: cursor → PDF',
          keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyS],
          run: () => window.dispatchEvent(new CustomEvent('csleaf:forward-sync')),
        });
        // first render should keep stored value authoritative
        if (editor.getValue() !== tab.content) editor.setValue(tab.content);
      }}
      onChange={(value) => { /* handled in onDidChangeModelContent */ }}
      options={{
        fontSize: editor.fontSize,
        fontFamily: 'var(--font-mono)',
        fontLigatures: true,
        wordWrap: editor.wordWrap ? 'on' : 'off',
        minimap: { enabled: editor.minimap, scale: 1 },
        lineHeight: 1.7,
        padding: { top: 14, bottom: 40 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'all',
        scrollBeyondLastLine: true,
        automaticLayout: true,
        tabSize: 2,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        stickyScroll: { enabled: false },
        quickSuggestions: { other: true, comments: false, strings: true },
        suggestSelection: 'first',
        snippetsuggest: 'inline',
      }}
    />
  );
}
