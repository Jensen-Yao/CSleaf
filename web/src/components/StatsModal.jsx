import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { countWords } from '../lib/latex/analyze.js';

function walkFiles(node, pred, out = [], prefix = '') {
  if (!node) return out;
  for (const c of node.children || []) {
    const p = prefix ? `${prefix}/${c.name}` : c.name;
    if (c.type === 'file') { if (pred(c)) out.push({ ...c, path: p }); }
    else walkFiles(c, pred, out, p);
  }
  return out;
}

export default function StatsModal() {
  const t = useStore(s => s.t);
  const lang = useStore(s => s.lang);
  const closeModal = useStore(s => s.closeModal);
  const project = useStore(s => s.project);
  const tree = useStore(s => s.tree);
  const activePath = useStore(s => s.activePath);
  const tabs = useStore(s => s.tabs);
  const compileState = useStore(s => s.compileState);

  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      const texFiles = walkFiles(tree, f => /\.(tex)$/i.test(f.name));
      const perFile = [];
      for (const f of texFiles.slice(0, 200)) {
        try {
          const data = await api.readFile(project.id, f.path);
          if (!data.binary) perFile.push({ path: f.path, text: data.content });
        } catch {}
      }
      const all = perFile.map(f => f.text).join('\n');
      const wc = countWords(all);
      const chars = all.replace(/\s/g, '').length;
      const count = (re) => (all.match(re) || []).length;
      const activeTab = tabs.find(tb => tb.path === activePath);
      const activeWc = activeTab ? countWords(activeTab.content) : { cjk: 0, words: 0 };

      setStats({
        files: perFile.length,
        cjk: wc.cjk,
        words: wc.words,
        chars,
        sections: count(/^\\(section|chapter)\*?\s*\{/gm),
        subsections: count(/^\\subsection\*?\s*\{/gm),
        figures: count(/\\begin\{figure\*?\}/g),
        tables: count(/\\begin\{table\*?\}/g),
        equations: count(/\\begin\{(equation|align|gather)\*?\}/g) + count(/\\\((?!\))/g),
        labels: count(/\\label\{/g),
        cites: count(/\\cite[pt]?\{/g),
        frames: count(/\\begin\{frame\}/g),
        activeWords: activeWc.cjk + activeWc.words,
        activeChars: activeTab ? activeTab.content.replace(/\s/g, '').length : 0,
        activeLines: activeTab ? activeTab.content.split('\n').length : 0,
        lastCompile: compileState.result,
      });
    })();
  }, []);

  const num = (n) => (n ?? 0).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal">
        <div className="modal-head"><h3>{t('statsTitle')}</h3></div>
        <div className="modal-body">
          {!stats ? <div className="log-empty">{t('loading')}</div> : (
            <>
              <div className="stats-grid">
                <StatCard icon="✍️" label={lang === 'zh' ? '全项目字数' : 'Total words'} value={num(stats.cjk + stats.words)}
                  sub={lang === 'zh' ? `${num(stats.cjk)} 中文 + ${num(stats.words)} 英文词` : `${num(stats.cjk)} CJK chars + ${num(stats.words)} words`} big />
                <StatCard icon="📄" label={lang === 'zh' ? '字符数（不含空白）' : 'Characters'} value={num(stats.chars)} />
                <StatCard icon="🗂️" label={lang === 'zh' ? '.tex 文件数' : '.tex files'} value={num(stats.files)} />
                <StatCard icon="📝" label={lang === 'zh' ? '当前文件' : 'Current file'}
                  value={num(stats.activeWords)} sub={lang === 'zh'
                    ? `${num(stats.activeChars)} 字符 · ${num(stats.activeLines)} 行`
                    : `${num(stats.activeChars)} chars · ${num(stats.activeLines)} lines`} />
              </div>

              <div className="stats-grid" style={{ marginTop: 4 }}>
                <StatCard icon="🔖" label={lang === 'zh' ? '章节' : 'Sections'} value={num(stats.sections)} sub={lang === 'zh' ? `小节 ${num(stats.subsections)}` : `${num(stats.subsections)} subsections`} />
                <StatCard icon="🖼️" label={lang === 'zh' ? '插图 / 表格' : 'Figures / Tables'} value={`${num(stats.figures)} / ${num(stats.tables)}`} />
                <StatCard icon="🧮" label={lang === 'zh' ? '公式环境' : 'Equations'} value={num(stats.equations)} />
                <StatCard icon="📚" label={lang === 'zh' ? '引用 \\cite' : '\\cite commands'} value={num(stats.cites)} sub={lang === 'zh' ? `标签 ${num(stats.labels)}` : `${num(stats.labels)} labels`} />
              </div>

              {stats.frames > 0 && (
                <div className="badge" style={{ alignSelf: 'flex-start' }}>{lang === 'zh' ? `Beamer 页框：${stats.frames}` : `Beamer frames: ${stats.frames}`}</div>
              )}

              {stats.lastCompile && (
                <div style={{ fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {lang === 'zh' ? '上次编译：' : 'Last compile: '}
                  <b style={{ color: stats.lastCompile.ok ? 'var(--accent)' : 'var(--danger)' }}>{stats.lastCompile.status}</b>
                  {' · '}{(stats.lastCompile.elapsed / 1000).toFixed(1)}s
                  {stats.lastCompile.pdf && ` · ${stats.lastCompile.pdf}`}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={closeModal}>OK</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, big }) {
  return (
    <div className={`stat-card ${big ? 'big' : ''}`}>
      <div className="stat-ico">{icon}</div>
      <div>
        <div className="stat-val">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}
