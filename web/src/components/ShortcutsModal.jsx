import React from 'react';
import { useStore } from '../lib/store';

export default function ShortcutsModal() {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const closeModal = useStore(s => s.closeModal);

  const rows = [
    ['Ctrl + Enter', lang === 'zh' ? '编译项目' : 'Compile project'],
    ['Ctrl + S', lang === 'zh' ? '保存（默认自动保存）' : 'Save (autosave is on)'],
    ['Ctrl + P', lang === 'zh' ? '快速打开文件' : 'Quick open file'],
    ['Ctrl + Shift + P', lang === 'zh' ? '命令面板' : 'Command palette'],
    ['Ctrl + B', lang === 'zh' ? '显示/隐藏侧边栏' : 'Toggle sidebar'],
    ['Ctrl + Shift + E', lang === 'zh' ? '显示/隐藏 PDF 预览' : 'Toggle PDF preview'],
    ['Ctrl + J', lang === 'zh' ? '显示/隐藏日志面板' : 'Toggle log panel'],
    ['Alt + S', lang === 'zh' ? 'SyncTeX：光标 → PDF 定位' : 'SyncTeX: cursor → PDF'],
    [lang === 'zh' ? '双击 PDF' : 'Double-click PDF', lang === 'zh' ? 'SyncTeX：PDF → 源码' : 'SyncTeX: PDF → source'],
    ['Ctrl + 滚轮', lang === 'zh' ? '（浏览器缩放）' : '(browser zoom)'],
  ];

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal narrow">
        <div className="modal-head"><h3>{t('shortcuts')}</h3></div>
        <div className="modal-body">
          <div className="shortcuts-grid">
            {rows.map(([k, d]) => (
              <div key={k} className="shortcut-row">
                <span style={{ color: 'var(--text1)' }}>{d}</span>
                <span className="keys"><kbd>{k}</kbd></span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={closeModal}>OK</button>
        </div>
      </div>
    </div>
  );
}
