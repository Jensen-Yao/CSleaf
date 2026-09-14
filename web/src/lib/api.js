// Thin fetch wrapper around the CSleaf REST API.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
    ...options,
    body: options.body && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // system
  texInfo: (force) => request(`/system/tex${force ? '?force=1' : ''}`),
  getSettings: () => request('/settings'),
  saveSettings: (patch) => request('/settings', { method: 'PUT', body: patch }),
  templates: () => request('/templates'),

  // projects
  projects: () => request('/projects'),
  createProject: (body) => request('/projects', { method: 'POST', body }),
  importProject: (file, name) => {
    const fd = new FormData();
    fd.append('file', file);
    if (name) fd.append('name', name);
    return request('/projects/import', { method: 'POST', body: fd });
  },
  patchProject: (id, body) => request(`/projects/${id}`, { method: 'PATCH', body }),
  duplicateProject: (id) => request(`/projects/${id}/duplicate`, { method: 'POST' }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // files
  tree: (id) => request(`/projects/${id}/tree`),
  readFile: (id, path) => request(`/projects/${id}/file?path=${encodeURIComponent(path)}`),
  writeFile: (id, path, content) => request(`/projects/${id}/file`, { method: 'PUT', body: { path, content } }),
  createEntry: (id, path, type) => request(`/projects/${id}/file`, { method: 'POST', body: { path, type } }),
  renameEntry: (id, path, newName) => request(`/projects/${id}/file`, { method: 'PATCH', body: { path, newName } }),
  deleteEntry: (id, path) => request(`/projects/${id}/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  uploadFiles: (id, targetDir, files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    fd.append('targetDir', targetDir || '');
    return request(`/projects/${id}/upload`, { method: 'POST', body: fd });
  },
  cleanProject: (id) => request(`/projects/${id}/clean`, { method: 'POST' }),

  bibEntries: (id, path) => request(`/projects/${id}/bib?path=${encodeURIComponent(path)}`),

  // compile
  compile: (id, body) => request(`/projects/${id}/compile`, { method: 'POST', body }),
  cancelCompile: (id) => request(`/projects/${id}/compile/cancel`, { method: 'POST' }),

  // synctex
  synctexView: (id, body) => request(`/projects/${id}/synctex/view`, { method: 'POST', body }),
  synctexEdit: (id, body) => request(`/projects/${id}/synctex/edit`, { method: 'POST', body }),

  pdfUrl: (id, file, v) => `/api/projects/${id}/pdf?file=${encodeURIComponent(file)}&v=${v}`,
};
