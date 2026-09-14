'use strict';
/**
 * Parse a LaTeX .log file into structured errors / warnings.
 * Relies on -file-line-error output ("./main.tex:12: Oops.") for precise
 * error locations, with classic "! ..." blocks as fallback.
 */

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// ---------- location tracking ----------
// TeX marks page ships with [1] [2] … tokens scattered in the log.
function estimatePage(logText, charIndex) {
  const upTo = logText.slice(0, charIndex);
  const matches = upTo.match(/\[\d+(?=[\s.\]])/g);
  if (!matches) return null;
  const last = matches[matches.length - 1];
  const n = parseInt(last.slice(1), 10);
  return Number.isFinite(n) ? n : null;
}

// ---------- error blocks ----------
// "! LaTeX Error: File `foo.sty' not found." followed by context lines
// "! Undefined control sequence." + "l.12 \badmacro"
function parseErrors(logText) {
  const errors = [];
  const seen = new Set();
  const lines = logText.split('\n');
  let charOffset = 0;

  // file-line-error style: "./main.tex:3: Undefined control sequence." (may repeat!)
  const FLE = /^([^:\s][^:]*\.(?:tex|sty|cls|bib|ltx|dtx)):(\d+):\s*(.+)$/;
  for (let i = 0; i < lines.length; i++) {
    const line = stripAnsi(lines[i]);
    const fm = line.match(FLE);
    if (fm && !fm[3].startsWith('No file') && !fm[3].startsWith('Package')) {
      const key = line;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          level: 'error',
          message: fm[3].trim().slice(0, 300),
          file: fm[1].replace(/^\.\//, ''),
          line: parseInt(fm[2], 10),
          page: estimatePage(logText, charOffset),
          context: '',
        });
      }
    }
    charOffset += lines[i].length + 1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = stripAnsi(lines[i]);
    if (!line.startsWith('!')) continue;

    let message = line.replace(/^!\s*/, '');
    let file = null, lineNumber = null, context = '';

    // file-line-error style: ./sections/intro.tex:42: Undefined control sequence.
    const fle = message.match(/^([^\s:][^:]*\.tex):(\d+):\s*(.*)$/);
    if (fle) {
      file = fle[1].replace(/^\.\//, '');
      lineNumber = parseInt(fle[2], 10);
      message = fle[3] || message;
    }

    // gather context until blank line / "! " end marker "..." line
    let j = i + 1;
    const ctx = [];
    while (j < lines.length && j < i + 12) {
      const l = stripAnsi(lines[j]);
      if (l.startsWith('!') || /^l\.\d+/.test(l) || ctx.length > 8) break;
      if (l.trim() === '') { j++; break; }
      ctx.push(l);
      j++;
    }
    // the "l.<num> <offending line>" marker often follows after blank line
    const rest = lines.slice(i + 1, i + 8).map(stripAnsi).join('\n');
    const lm = rest.match(/^l\.(\d+)\s?(.*)$/m);
    if (lm && lineNumber == null) lineNumber = parseInt(lm[1], 10);
    if (lm) context = lm[2].trim().slice(0, 120);
    else if (ctx.length) context = ctx.join(' ').slice(0, 160);

    if (file == null) {
      // try to find last opened file "(./main.tex"
      const before = logText.slice(Math.max(0, charOffset - 4000), charOffset);
      const opens = before.match(/\((\.\/[^()\s]+\.tex)/g);
      if (opens) file = opens[opens.length - 1].replace(/^\(\.\//, '');
    }

    const dedupe = `${file}:${lineNumber}:${message}`;
    if (!seen.has(dedupe)) {
      seen.add(dedupe);
      errors.push({
        level: 'error',
        message: message.trim().slice(0, 300),
        file: file || null,
        line: lineNumber,
        page: estimatePage(logText, charOffset),
        context,
      });
    }
    charOffset += lines[i].length + 1;
  }
  return errors;
}

// ---------- warnings ----------
const WARNING_PATTERNS = [
  { re: /^LaTeX Warning:\s*(.*)$/, msg: 1 },
  { re: /^Package\s+(\S+)\s+Warning:\s*(.*)$/, pkg: 1, msg: 2 },
  { re: /^Class\s+(\S+)\s+Warning:\s*(.*)$/, pkg: 1, msg: 2 },
  { re: /^(Citation|Reference|Label)[^:]*`([^']+)'.*(undefined|multiply)/i, special: true },
  { re: /^(Overfull|Underfull)\\[hv]box\s*\(([^)]*)\)\s*(.*)$/, box: true },
];

function parseWarnings(logText) {
  const warnings = [];
  const lines = logText.split('\n');
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = stripAnsi(lines[i]);
    let matched = false;

    for (const p of WARNING_PATTERNS) {
      const m = line.match(p.re);
      if (!m) continue;
      matched = true;
      let message, pkg = null;

      if (p.special) {
        message = line.trim();
      } else if (p.box) {
        message = `${m[1]}box (${m[2]}) ${m[3] || ''}`.trim();
      } else if (p.pkg) {
        pkg = m[p.pkg];
        message = m[p.msg].trim();
        // package warnings wrap onto following indented lines
        let k = i + 1;
        while (k < lines.length && stripAnsi(lines[k]).match(/^\s+\S/) && !stripAnsi(lines[k]).match(/^(Overfull|Underfull|!)/) && k < i + 6) {
          const nl = stripAnsi(lines[k]).trim();
          if (!nl) break;
          message += ' ' + nl;
          k++;
        }
      } else {
        message = m[p.msg].trim();
        let k = i + 1;
        while (k < lines.length && stripAnsi(lines[k]).match(/^\s*[A-Za-z(]/) && !/^(Overfull|Underfull|!|Package|Class|LaTeX Warning)/.test(stripAnsi(lines[k]).trim()) && k < i + 5) {
          const nl = stripAnsi(lines[k]).trim();
          if (!nl || nl.startsWith('(')) break;
          message += ' ' + nl;
          k++;
        }
      }

      // file hint from same line "on input line 42"
      const lineHint = message.match(/on input line (\d+)/);
      warnings.push({
        level: 'warning',
        message: message.slice(0, 300),
        pkg,
        file: null,
        line: lineHint ? parseInt(lineHint[1], 10) : null,
        page: estimatePage(logText, charOffset),
        context: '',
      });
      break;
    }
    charOffset += lines[i].length + 1;
  }
  return warnings;
}

// ---------- missing files / packages (helpful for auto-install hints) ----------
function parseMissing(logText) {
  const missing = new Set();
  const re = /! LaTeX Error: File `([^']+)' not found/g;
  let m;
  while ((m = re.exec(logText))) missing.add(m[1]);
  return [...missing];
}

// ---------- badboxes (informational) ----------
function countBadBoxes(logText) {
  const over = (logText.match(/^Overfull \\[hv]box/gm) || []).length;
  const under = (logText.match(/^Underfull \\[hv]box/gm) || []).length;
  return { overfull: over, underfull: under };
}

function parseLog(logText) {
  const text = stripAnsi(logText || '');
  const errors = parseErrors(text);
  const warnings = parseWarnings(text).filter(
    w => !/^File: .*\.def/.test(w.message) && !/^Font shape/.test(w.message)
  );
  return {
    errors,
    warnings,
    missingFiles: parseMissing(text),
    badBoxes: countBadBoxes(text),
    pagesShipped: (text.match(/\[\d+(?=[\s.\]])/g) || []).length,
  };
}

module.exports = { parseLog };
