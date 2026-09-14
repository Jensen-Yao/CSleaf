// Extract a document outline (sections/chapters/frames/floats) from LaTeX source.
export function parseOutline(text) {
  const lines = text.split('\n');
  const items = [];
  const sectionRe = /^\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*\[?([^\]{}]*)\]?\{(.*)\}/;
  const frameRe = /^\\begin\{frame\}(?:\s*\[([^\]]*)\])?\s*\{(.*)\}/;
  const framePlainRe = /^\\begin\{frame\}/;
  const floatRe = /^\\begin\{(figure|table)\*?\}/;
  const captionRe = /\\caption(?:\[[^\]]*\])?\{(.*)\}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(sectionRe);
    if (m) {
      const title = cleanTitle(m[3]);
      items.push({ level: levelOf(m[1]), label: m[1], title, line: i + 1, kind: 'section' });
      continue;
    }
    m = line.match(frameRe);
    if (m) {
      items.push({ level: 3, label: 'frame', title: cleanTitle(m[2]), line: i + 1, kind: 'frame' });
      continue;
    }
    if (framePlainRe.test(line)) {
      items.push({ level: 3, label: 'frame', title: 'Frame', line: i + 1, kind: 'frame' });
      continue;
    }
    m = line.match(floatRe);
    if (m) {
      // look ahead a few lines for caption
      let title = '';
      for (let j = i; j < Math.min(i + 12, lines.length); j++) {
        const c = lines[j].match(captionRe);
        if (c) { title = cleanTitle(c[1]); break; }
        if (/\\end\{(figure|table)\*?\}/.test(lines[j])) break;
      }
      items.push({ level: 4, label: m[1], title: title || m[1], line: i + 1, kind: 'float' });
    }
  }
  return items;
}

function levelOf(cmd) {
  return { part: 0, chapter: 0, section: 1, subsection: 2, subsubsection: 3, paragraph: 4 }[cmd] ?? 1;
}

function cleanTitle(s) {
  return s.replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?(\{[^}]*\})?/g, '').replace(/[{}]/g, '').trim() || '(untitled)';
}

// Word count that respects CJK vs Latin scripts, ignoring comments & commands.
export function countWords(text) {
  let src = text.replace(/(?<!\\)%.*$/gm, ' ');       // strip comments
  src = src.replace(/\\begin\{(equation|align|gather|equation\*|align\*|gather\*|displaymath|math)\}[\s\S]*?\\end\{\1\}/g, ' ');
  src = src.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$[^$\n]*\$/g, ' ');
  src = src.replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?(\{[^{}]*\})?/g, ' '); // commands w/ one arg
  src = src.replace(/[{}$&~^\\]/g, ' ');
  const cjk = (src.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (src.match(/[A-Za-z0-9][A-Za-z0-9''-]*/g) || []).length;
  return { cjk, words };
}
