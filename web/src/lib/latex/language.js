// LaTeX language: tokenizer + completion + folding + themes for Monaco.
const COMMANDS = [
  // structure
  ['\\documentclass', 'Document class'], ['\\usepackage', 'Load a package'],
  ['\\title', 'Document title'], ['\\author', 'Author'], ['\\date', 'Date'],
  ['\\maketitle', 'Render title block'], ['\\tableofcontents', 'Table of contents'],
  ['\\section', 'Section'], ['\\subsection', 'Subsection'], ['\\subsubsection', 'Subsubsection'],
  ['\\paragraph', 'Paragraph heading'], ['\\chapter', 'Chapter (book/report)'],
  ['\\appendix', 'Start appendices'], ['\\newpage', 'New page'], ['\\clearpage', 'Clear page + floats'],
  ['\\label', 'Add a label'], ['\\ref', 'Reference a label'], ['\\eqref', 'Equation reference'],
  ['\\footnote', 'Footnote'], ['\\cite', 'Citation'], ['\\bibliography', 'Bibliography file'],
  ['\\bibliographystyle', 'Bibliography style'], ['\\printbibliography', 'Print biblatex bibliography'],
  ['\\input', 'Input a file'], ['\\include', 'Include a file'], ['\\includegraphics', 'Include image'],
  // text
  ['\\textbf', 'Bold text'], ['\\textit', 'Italic text'], ['\\emph', 'Emphasize'],
  ['\\underline', 'Underline'], ['\\texttt', 'Typewriter text'], ['\\textsc', 'Small caps'],
  ['\\textrm', 'Roman text'], ['\\textsf', 'Sans-serif text'], ['\\footnotesize', 'Footnote size'],
  ['\\large', 'Large text'], ['\\Large', 'Larger text'], ['\\Huge', 'Huge text'],
  ['\\item', 'List item'], ['\\caption', 'Float caption'], ['\\centering', 'Center content'],
  // math
  ['\\begin', 'Begin environment'], ['\\end', 'End environment'],
  ['\\alpha', 'α'], ['\\beta', 'β'], ['\\gamma', 'γ'], ['\\delta', 'δ'], ['\\epsilon', 'ε'],
  ['\\theta', 'θ'], ['\\lambda', 'λ'], ['\\mu', 'μ'], ['\\pi', 'π'], ['\\rho', 'ρ'],
  ['\\sigma', 'σ'], ['\\phi', 'φ'], ['\\omega', 'ω'], ['\\Gamma', 'Γ'], ['\\Delta', 'Δ'],
  ['\\Omega', 'Ω'], ['\\Phi', 'Φ'], ['\\sum', 'Σ summation'], ['\\prod', 'Π product'],
  ['\\int', '∫ integral'], ['\\iint', '∬ double integral'], ['\\oint', '∮ contour integral'],
  ['\\infty', '∞'], ['\\partial', '∂ partial'], ['\\nabla', '∇ nabla'], ['\\sqrt', 'Square root'],
  ['\\frac', 'Fraction'], ['\\dfrac', 'Display fraction'], ['\\cdot', '·'], ['\\ldots', '…'],
  ['\\leq', '≤'], ['\\geq', '≥'], ['\\neq', '≠'], ['\\approx', '≈'], ['\\equiv', '≡'],
  ['\\sim', '∼'], ['\\propto', '∝'], ['\\in', '∈'], ['\\notin', '∉'], ['\\subset', '⊂'],
  ['\\subseteq', '⊆'], ['\\cup', '∪'], ['\\cap', '∩'], ['\\forall', '∀'], ['\\exists', '∃'],
  ['\\rightarrow', '→'], ['\\leftarrow', '←'], ['\\Rightarrow', '⇒'], ['\\Leftarrow', '⇐'],
  ['\\leftrightarrow', '↔'], ['\\Leftrightarrow', '⇔'], ['\\mapsto', '↦'], ['\\to', '→'],
  ['\\mathbb', 'Blackboard (amssymb)'], ['\\mathcal', 'Calligraphic'], ['\\mathbf', 'Bold math'],
  ['\\mathrm', 'Upright math'], ['\\hat', 'Hat accent'], ['\\bar', 'Bar accent'], ['\\vec', 'Vector accent'],
  ['\\left', 'Auto-sizing left delimiter'], ['\\right', 'Auto-sizing right delimiter'],
  ['\\quad', 'Wide space'], ['\\qquad', 'Wider space'],
];

const ENVIRONMENTS = [
  ['document', 'main document body'],
  ['abstract', 'abstract'],
  ['equation', 'numbered equation'],
  ['equation*', 'unnumbered equation'],
  ['align', 'aligned equations (numbered)'],
  ['align*', 'aligned equations'],
  ['gather', 'centered equations'],
  ['figure', 'figure float'], ['figure*[htbp]', 'full-width figure'],
  ['table', 'table float'], ['tabular', 'table grid'],
  ['itemize', 'bulleted list'], ['enumerate', 'numbered list'], ['description', 'descriptive list'],
  ['center', 'centered block'], ['quote', 'quote'], ['quotation', 'quotation'],
  ['theorem', 'theorem'], ['proof', 'proof (amsthm)'],
  ['frame', 'beamer slide frame'],
  ['columns', 'beamer columns'], ['block', 'beamer block'],
  ['cases', 'piecewise cases'], ['matrix', 'matrix (amsmath)'],
  ['pmatrix', 'parenthesized matrix'], ['bmatrix', 'bracketed matrix'],
  ['verbatim', 'raw verbatim text'], ['lstlisting', 'code listing'],
];

function envSnippet(name) { return { label: name, detail: ENVIRONMENTS.find(e => e[0] === name)?.[1] || '' }; }

export function registerLatex(monaco) {
  if (monaco.languages.getLanguages().some(l => l.id === 'latex')) return;

  monaco.languages.register({ id: 'latex', extensions: ['.tex', '.sty', '.cls', '.dtx', '.ltx'], aliases: ['LaTeX', 'latex'] });

  monaco.languages.setMonarchTokensProvider('latex', {
    defaultToken: '',
    tokenPostfix: '.latex',
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
    ],
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/\\begin\{/, { token: 'keyword', bracket: '@open', next: '@envName' }],
        [/\\end\{/, { token: 'keyword', bracket: '@close', next: '@envName' }],
        [/\\\$\$/, { token: 'string.escape', next: '@mathDisplay' }],
        [/\$\$/, { token: 'string', next: '@mathDisplay' }],
        [/\$/, { token: 'string', next: '@mathInline' }],
        [/\\\(/, { token: 'string', next: '@mathInline' }],
        [/\\\[/, { token: 'string', next: '@mathDisplay' }],
        [/\\[a-zA-Z@]+\*?/, 'keyword'],
        [/\\[^a-zA-Z@]/, 'keyword'],
        [/[{}]/, '@brackets'],
        [/[[\]]/, '@brackets'],
        [/[&]/, 'operator'],
        [/[~^_]/, 'operator'],
        [/[{}]/, '@brackets'],
      ],
      envName: [
        [/[a-zA-Z*]+/, 'type.identifier'],
        [/\}/, { token: 'keyword', bracket: '@close', next: '@pop' }],
      ],
      mathInline: [
        [/\\\$/, 'string'],
        [/\$/, { token: 'string', next: '@pop' }],
        [/\\\)/, { token: 'string', next: '@pop' }],
        [/\\[a-zA-Z@]+/, 'keyword'],
        [/%.*$/, 'comment'],
        [/./, 'string'],
      ],
      mathDisplay: [
        [/\$\$/, { token: 'string', next: '@pop' }],
        [/\\\]/, { token: 'string', next: '@pop' }],
        [/\\[a-zA-Z@]+/, 'keyword'],
        [/%.*$/, 'comment'],
        [/./, 'string'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration('latex', {
    comments: { lineComment: '%' },
    brackets: [
      ['{', '}'], ['[', ']'], ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
      { open: '$', close: '$', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '$', close: '$' },
    ],
    folding: {
      markers: {
        start: /^\s*%region\b/,
        end: /^\s*%endregion\b/,
      },
    },
    onEnterRules: [
      {
        beforeText: /^\s*\\item\b.*$/,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent, appendText: '\\item ' },
      },
    ],
  });

  // ---- completion provider ----
  monaco.languages.registerCompletionItemProvider('latex', {
    triggerCharacters: ['\\', '{', '/'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const line = model.getLineContent(position.lineNumber);
      const before = line.slice(0, position.column - 1);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      const K = monaco.languages.CompletionItemKind;
      const suggestions = [];

      const backslashIdx = before.lastIndexOf('\\');
      const inCommand = backslashIdx !== -1 && !/[\s{}$&]/.test(before.slice(backslashIdx + 1));

      if (inCommand) {
        // \command completion
        const typed = before.slice(backslashIdx + 1);
        const cmdRange = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: backslashIdx + 1, endColumn: word.endColumn,
        };
        for (const [cmd, desc] of COMMANDS) {
          suggestions.push({
            label: cmd, kind: K.Function, detail: desc,
            insertText: needsArg(cmd) ? `${cmd}{$1}` : cmd,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: cmdRange, sortText: '0' + cmd,
          });
        }
        for (const [env, detail] of ENVIRONMENTS) {
          const hasStar = env.endsWith('*');
          const base = env.replace(/\*?(\[.*\])?$/, '');
          suggestions.push({
            label: `\\begin{${base}}`, kind: K.Snippet, detail: `environment — ${detail}`,
            insertText: `\\begin{${base}}\n\t$0\n\\end{${base}}`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: cmdRange, sortText: '1' + base,
          });
          if (hasStar) continue;
        }
        return { suggestions };
      }

      // context-aware completions inside \ref{ \cite{ \input{ \includegraphics{
      const m = before.match(/\\(ref|eqref|autoref|pageref|cite|citep|citet|input|include|includegraphics|bibliography)\{([^}]*)$/);
      if (m) {
        const cmd = m[1];
        const typedArg = m[2];
        return getDynamicSuggestions(monaco, cmd, typedArg, range);
      }

      // generic word fallback: nothing to add
      return { suggestions };
    },
  });

  function needsArg(cmd) {
    return /\b(documentclass|usepackage|title|author|date|section|subsection|subsubsection|chapter|label|ref|eqref|cite|textbf|textit|emph|underline|texttt|textsc|input|include|includegraphics|bibliography|bibliographystyle|caption|item|frac|sqrt|mathbb|mathcal|mathbf|mathrm|hat|bar|vec)\b/.test(cmd);
  }

  async function getDynamicSuggestions(monaco, cmd, typed, range) {
    const K = monaco.languages.CompletionItemKind;
    const { useStore } = await import('../store');
    const st = useStore.getState();
    const suggestions = [];
    const project = st.project;
    if (!project) return { suggestions: [] };

    const scanLabels = (text, file) => {
      const re = /\\label\{([^}]+)\}/g;
      let m;
      while ((m = re.exec(text))) {
        suggestions.push({
          label: m[1], kind: K.Value, detail: `label in ${file}`,
          insertText: m[1], range, sortText: '0' + m[1],
        });
      }
    };

    if (['ref', 'eqref', 'autoref', 'pageref'].includes(cmd)) {
      // scan open tabs + fetch other .tex files
      const seen = new Set();
      for (const tab of st.tabs) {
        scanLabels(tab.content, tab.path);
        seen.add(tab.path);
      }
      const texFiles = collectFiles(st.tree, f => /\.(tex|sty|cls)$/i.test(f.path));
      for (const f of texFiles) {
        if (seen.has(f.path)) continue;
        try {
          const data = await api.readFile(project.id, f.path);
          if (!data.binary) scanLabels(data.content, f.path);
        } catch {}
      }
    } else if (['cite', 'citep', 'citet'].includes(cmd)) {
      const bibFiles = collectFiles(st.tree, f => /\.bib$/i.test(f.path));
      for (const f of bibFiles) {
        try {
          const { entries } = await api.bibEntries(project.id, f.path);
          for (const e of entries) {
            suggestions.push({
              label: e.key, kind: K.Reference, detail: `${e.type}: ${e.title || e.author || ''}`.slice(0, 90),
              insertText: e.key, range, sortText: '0' + e.key,
            });
          }
        } catch {}
      }
    } else if (['input', 'include'].includes(cmd)) {
      for (const f of collectFiles(st.tree, x => /\.tex$/i.test(x.path))) {
        suggestions.push({
          label: f.path, kind: K.File, insertText: f.path.replace(/\.tex$/i, ''), range,
        });
      }
    } else if (cmd === 'includegraphics') {
      for (const f of collectFiles(st.tree, x => /\.(png|jpe?g|pdf|eps|svg)$/i.test(x.path))) {
        suggestions.push({ label: f.path, kind: K.File, insertText: f.path, range });
      }
    } else if (cmd === 'bibliography') {
      for (const f of collectFiles(st.tree, x => /\.bib$/i.test(x.path))) {
        suggestions.push({
          label: f.path, kind: K.File, insertText: f.path.replace(/\.bib$/i, ''), range,
        });
      }
    }
    return { suggestions };
  }

  // ---- folding on \begin{...} ... \end{...} ----
  monaco.languages.registerFoldingRangeProvider('latex', {
    provideFoldingRanges: (model) => {
      const ranges = [];
      const stack = [];
      for (let i = 1; i <= model.getLineCount(); i++) {
        const line = model.getLineContent(i);
        const re = /\\(begin|end)\{([^}]+)\}/g;
        let m;
        while ((m = re.exec(line))) {
          if (m[1] === 'begin') stack.push({ name: m[2], line: i });
          else {
            const open = stack.findIndex(s => s.name === m[2]);
            if (open !== -1) {
              const s = stack.splice(open, 1)[0];
              if (i > s.line + 1) ranges.push({ start: s.line, end: i - 1, kind: 'region' });
            }
          }
        }
      }
      return ranges;
    },
  });

  // ---- document symbol provider (outline in editor) ----
  monaco.languages.registerDocumentSymbolProvider?.('latex', {
    provideDocumentSymbols: (model) => {
      const icons = { section: 16, subsection: 16, subsubsection: 16, chapter: 16 };
      const symbols = [];
      for (let i = 1; i <= model.getLineCount(); i++) {
        const line = model.getLineContent(i);
        const m = line.match(/\\(section|subsection|subsubsection|chapter)\*?\{([^}]*)\}/);
        if (m) {
          symbols.push({
            name: m[2] || '(untitled)',
            detail: m[1],
            kind: monaco.languages.SymbolKind.Module,
            range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: line.length + 1 },
            selectionRange: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: line.length + 1 },
          });
        }
      }
      return symbols;
    },
  });

  registerThemes(monaco);
}

function collectFiles(node, pred, out = []) {
  if (!node) return out;
  for (const child of node.children || []) {
    if (child.type === 'file') { if (pred(child)) out.push(child); }
    else collectFiles(child, pred, out);
  }
  return out;
}

export function registerThemes(monaco) {
  monaco.editor.defineTheme('csleaf-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a7a8a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '5ec8a0' },
      { token: 'string', foreground: '8ecdfa' },
      { token: 'string.escape', foreground: '8ecdfa' },
      { token: 'type.identifier', foreground: 'd8a657' },
      { token: 'operator', foreground: 'e0af68' },
      { token: 'delimiter.curly', foreground: '9aa4b2' },
      { token: 'delimiter.square', foreground: '9aa4b2' },
    ],
    colors: {
      'editor.background': '#10151b',
      'editor.foreground': '#dbe4ee',
      'editorLineNumber.foreground': '#3a4654',
      'editorLineNumber.activeForeground': '#5ec8a0',
      'editor.selectionBackground': '#1f4d3d',
      'editor.lineHighlightBackground': '#161d25',
      'editorCursor.foreground': '#5ec8a0',
      'editorIndentGuide.background1': '#1d2530',
      'editorIndentGuide.activeBackground1': '#2d3946',
      'editorWidget.background': '#151c24',
      'editorWidget.border': '#232c37',
      'editorSuggestWidget.background': '#151c24',
      'editorSuggestWidget.selectedBackground': '#1f4d3d',
      'editorGutter.background': '#10151b',
      'scrollbarSlider.background': '#232c37aa',
      'minimap.background': '#0d1218',
    },
  });

  monaco.editor.defineTheme('csleaf-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8a95a1', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0b7a55' },
      { token: 'string', foreground: '1c6da8' },
      { token: 'string.escape', foreground: '1c6da8' },
      { token: 'type.identifier', foreground: '9a6b00' },
      { token: 'operator', foreground: 'b0752b' },
    ],
    colors: {
      'editor.background': '#fbfcfd',
      'editor.foreground': '#24303c',
      'editorLineNumber.foreground': '#b3bcc6',
      'editorLineNumber.activeForeground': '#0b7a55',
      'editor.lineHighlightBackground': '#eef3f1',
      'editorCursor.foreground': '#0b7a55',
      'editorWidget.background': '#ffffff',
      'editorSuggestWidget.selectedBackground': '#e2f2ea',
    },
  });
}
