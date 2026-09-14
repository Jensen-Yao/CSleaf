// Bilingual UI strings: zh-CN (default) and English.
const dict = {
  // app / home
  appName: { zh: 'CSleaf', en: 'CSleaf' },
  tagline: { zh: '本地优先的 LaTeX 论文写作环境', en: 'A local-first LaTeX editor for paper writing' },
  myProjects: { zh: '我的项目', en: 'My Projects' },
  newProject: { zh: '新建项目', en: 'New Project' },
  importZip: { zh: '导入 ZIP', en: 'Import ZIP' },
  emptyProjects: { zh: '还没有项目，从模板创建一个吧', en: 'No projects yet — create one from a template' },
  open: { zh: '打开', en: 'Open' },
  duplicate: { zh: '复制', en: 'Duplicate' },
  rename: { zh: '重命名', en: 'Rename' },
  delete: { zh: '删除', en: 'Delete' },
  export: { zh: '导出 ZIP', en: 'Export ZIP' },
  updated: { zh: '更新于', en: 'Updated' },
  created: { zh: '创建于', en: 'Created' },
  settings: { zh: '设置', en: 'Settings' },
  confirmDeleteProject: { zh: '确定删除该项目？此操作不可恢复。', en: 'Delete this project? This cannot be undone.' },

  // new project modal
  chooseTemplate: { zh: '选择模板', en: 'Choose a template' },
  projectName: { zh: '项目名称', en: 'Project name' },
  create: { zh: '创建', en: 'Create' },
  cancel: { zh: '取消', en: 'Cancel' },

  // workspace
  compile: { zh: '编译', en: 'Compile' },
  compiling: { zh: '编译中', en: 'Compiling' },
  compiler: { zh: '编译器', en: 'Compiler' },
  mainFile: { zh: '主文档', en: 'Main file' },
  backToProjects: { zh: '返回项目列表', en: 'Back to projects' },
  files: { zh: '文件', en: 'Files' },
  outline: { zh: '大纲', en: 'Outline' },
  citations: { zh: '文献', en: 'Bibliography' },
  issues: { zh: '问题', en: 'Issues' },
  output: { zh: '日志', en: 'Log' },
  noIssues: { zh: '编译通过，没有错误 🎉', en: 'Compiled without errors 🎉' },
  noOutline: { zh: '当前文件没有章节标题', en: 'No sections in this file' },
  noBib: { zh: '项目里没有 .bib 文件', en: 'No .bib file in this project' },
  pdfPreview: { zh: 'PDF 预览', en: 'PDF Preview' },
  fitWidth: { zh: '适应宽度', en: 'Fit width' },
  download: { zh: '下载', en: 'Download' },
  syncCursor: { zh: '从光标定位 PDF', en: 'Sync cursor → PDF' },
  clean: { zh: '清理辅助文件', en: 'Clean aux files' },
  wordCount: { zh: '字数', en: 'Words' },
  shortcuts: { zh: '快捷键', en: 'Shortcuts' },
  commandPalette: { zh: '命令面板', en: 'Command palette' },
  quickOpen: { zh: '快速打开文件', en: 'Quick open file' },
  untitled: { zh: '未命名', en: 'Untitled' },

  // new file modal
  newFile: { zh: '新建文件', en: 'New file' },
  newFolder: { zh: '新建文件夹', en: 'New folder' },
  upload: { zh: '上传文件', en: 'Upload files' },
  name: { zh: '名称', en: 'Name' },

  // settings
  texPath: { zh: 'TeX 安装路径（留空自动检测）', en: 'TeX path (blank = auto-detect)' },
  timeout: { zh: '编译超时（秒）', en: 'Compile timeout (s)' },
  autoCompile: { zh: '保存后自动编译', en: 'Auto-compile on save' },
  autoOpen: { zh: '启动时打开浏览器', en: 'Open browser on start' },
  theme: { zh: '主题', en: 'Theme' },
  language: { zh: '语言', en: 'Language' },
  dark: { zh: '深色', en: 'Dark' },
  light: { zh: '浅色', en: 'Light' },
  fontSize: { zh: '编辑器字号', en: 'Editor font size' },
  wordWrap: { zh: '自动换行', en: 'Word wrap' },
  minimap: { zh: '显示缩略图', en: 'Show minimap' },
  save: { zh: '保存', en: 'Save' },
  saved: { zh: '已保存', en: 'Saved' },
  reDetect: { zh: '重新检测 TeX', en: 'Re-detect TeX' },

  // states
  noTex: { zh: '未检测到 TeX 发行版', en: 'No TeX distribution found' },
  noTexHint: {
    zh: '请安装 TeX Live 或 MiKTeX 后，在设置中重新检测。Windows 推荐 TeX Live。',
    en: 'Install TeX Live or MiKTeX, then re-detect in Settings. TeX Live is recommended on Windows.',
  },
  compileFailed: { zh: '编译失败', en: 'Compile failed' },
  compileOk: { zh: '编译成功', en: 'Compile success' },
  compileWarn: { zh: '编译完成（有警告/错误）', en: 'Compiled (with warnings/errors)' },
  unsavedDot: { zh: '未保存', en: 'Unsaved changes' },
  loading: { zh: '加载中…', en: 'Loading…' },
  compilingPdf: { zh: '正在编译，请稍候…', en: 'Compiling, please wait…' },
  noPdf: { zh: '点击「编译」生成 PDF 预览', en: 'Hit “Compile” to generate the PDF preview' },
  rootlessTitle: { zh: '示例：', en: 'Example: ' },

  // commands
  cmdToggleSidebar: { zh: '切换侧边栏', en: 'Toggle sidebar' },
  cmdTogglePreview: { zh: '切换 PDF 预览', en: 'Toggle PDF preview' },
  cmdToggleTheme: { zh: '切换深色/浅色主题', en: 'Toggle dark/light theme' },
  cmdToggleLang: { zh: '切换中文/English', en: 'Toggle 中文/English' },
  cmdSaveAll: { zh: '保存全部文件', en: 'Save all files' },
  cmdGoHome: { zh: '返回项目列表', en: 'Go to project list' },
  cmdCompile: { zh: '编译项目', en: 'Compile project' },
  cmdNewFile: { zh: '新建文件', en: 'New file' },
  cmdExportZip: { zh: '导出项目 ZIP', en: 'Export project as ZIP' },
  cmdDownloadPdf: { zh: '下载 PDF', en: 'Download PDF' },
  cmdClean: { zh: '清理辅助文件', en: 'Clean auxiliary files' },
  cmdSettings: { zh: '打开设置', en: 'Open settings' },
  cmdShortcuts: { zh: '查看快捷键', en: 'Show shortcuts' },

  // pdf viewer extras
  thumbnails: { zh: '缩略图', en: 'Thumbnails' },
  search: { zh: '在 PDF 中搜索', en: 'Search in PDF' },
  findPlaceholder: { zh: '在 PDF 中查找…（Enter 下一个）', en: 'Find in PDF… (Enter for next)' },
  noMatches: { zh: '无匹配', en: 'No matches' },
  pagesUnit: { zh: '页', en: 'pages' },
  fitPage: { zh: '适应页面', en: 'Fit page' },

  // statistics
  statsTitle: { zh: '项目统计', en: 'Project statistics' },
  cmdStats: { zh: '查看项目统计', en: 'Show project statistics' },

  // editor context menu & find/replace
  cut: { zh: '剪切', en: 'Cut' },
  copy: { zh: '复制', en: 'Copy' },
  paste: { zh: '粘贴', en: 'Paste' },
  selectAll: { zh: '全选', en: 'Select all' },
  find: { zh: '查找', en: 'Find' },
  replace: { zh: '替换', en: 'Replace' },
  replaceWith: { zh: '替换为', en: 'Replace with' },
  replaceThis: { zh: '替换', en: 'Replace' },
  replaceAll: { zh: '全部替换', en: 'Replace all' },
  prevMatch: { zh: '上一个', en: 'Previous' },
  nextMatch: { zh: '下一个', en: 'Next' },
  caseSensitive: { zh: '区分大小写', en: 'Match case' },
  closeUnsaved: { zh: '关闭未保存的标签页', en: 'Close unsaved tab' },
  confirmDelete: { zh: '确认删除', en: 'Confirm delete' },
  confirmDeleteMsg: { zh: '确定要删除吗？此操作不可恢复。', en: 'Delete this item? This cannot be undone.' },
  create: { zh: '创建', en: 'Create' },
};

export function makeT(lang) {
  return (key) => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang] ?? entry.zh;
  };
}

export function detectLang() {
  const saved = localStorage.getItem('csleaf.lang');
  if (saved) return saved;
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
