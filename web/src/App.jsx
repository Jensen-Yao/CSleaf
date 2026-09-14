import React, { useEffect } from 'react';
import { useStore } from './lib/store';
import HomePage from './components/HomePage.jsx';
import Workspace from './components/Workspace.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ShortcutsModal from './components/ShortcutsModal.jsx';
import StatsModal from './components/StatsModal.jsx';
import DialogHost from './components/DialogHost.jsx';
import { CheckIcon, AlertIcon, WarnIcon } from './components/Icons.jsx';

export default function App() {
  const view = useStore(s => s.view);
  const theme = useStore(s => s.theme);
  const toasts = useStore(s => s.toasts);
  const loadSystem = useStore(s => s.loadSystem);

  useEffect(() => { loadSystem(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <>
      {view === 'home' ? <HomePage /> : <Workspace />}
      <GlobalModals />
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'success' ? <CheckIcon width={14} height={14} color="var(--accent)" />
              : t.kind === 'error' ? <AlertIcon width={14} height={14} color="var(--danger)" />
              : t.kind === 'warn' ? <WarnIcon width={14} height={14} color="var(--warn)" />
              : null}
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}

function GlobalModals() {
  // opened via store flags below
  const modal = useStore(s => s.modal);
  const closeModal = useStore(s => s.closeModal);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  return (
    <>
      {modal === 'settings' && <SettingsModal />}
      {modal === 'palette' && <CommandPalette mode="commands" />}
      {modal === 'quickopen' && <CommandPalette mode="files" />}
      {modal === 'shortcuts' && <ShortcutsModal />}
      {modal === 'stats' && <StatsModal />}
      <DialogHost />
    </>
  );
}
