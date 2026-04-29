import { useRef, useState } from 'react';
import { AlertTriangle, Download, FileUp, ShieldCheck } from 'lucide-react';
import { api } from '../utils/api';

function backupFileName() {
  return `personal-wealth-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export default function Settings() {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  async function exportBackup() {
    setStatus(null);
    setError(null);

    try {
      const backup = await api.get('/backup');
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('Backup exported.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setStatus(null);
    setError(null);

    if (!file) return;
    const confirmed = window.confirm('Importing this backup will replace all current accounts, transactions, budgets, bills, and net worth history. Continue?');
    if (!confirmed) return;

    setImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await api.post('/backup/restore', backup);
      setStatus('Backup imported. Refresh other pages to see the restored data.');
    } catch (e) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Backups and local data privacy</p>
      </div>

      <section className="card space-y-4">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-lg text-emerald-400 bg-emerald-400/10">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Privacy</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Your financial data is stored locally on this computer. The app does not intentionally upload your accounts,
              transactions, budgets, bills, or backups to a hosted service. Anyone with access to your computer account or
              backup files may be able to read the data, so keep backups somewhere you trust.
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Backup</h2>
          <p className="text-sm text-slate-400 mt-1">
            Export a JSON backup before moving computers, reinstalling the app, or making major changes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={exportBackup} className="btn-primary flex items-center justify-center gap-2">
            <Download size={16} /> Export Backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost border border-slate-700 flex items-center justify-center gap-2"
            disabled={importing}
          >
            <FileUp size={16} /> {importing ? 'Importing...' : 'Import Backup'}
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
        </div>

        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>Import replaces all current local app data with the contents of the selected backup file.</p>
        </div>

        {status && <p className="text-sm text-emerald-400">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}
