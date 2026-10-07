'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { formatDate } from '../../lib/calc';
import { FILE_ACCEPT, deleteCustomerFile, fileUrl, listCustomerFiles, uploadCustomerFile } from '../../lib/db/files';
import type { CustomerFile } from '../../lib/db/files';
import { useStore } from '../../lib/store';
import type { Customer } from '../../lib/types';
import { Modal } from './ui';

const sizeLabel = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Dokumente eines Kunden: hochladen (auch per Drag & Drop), ansehen, herunterladen, löschen. */
export function CustomerFilesModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { activeCompanyId, auth } = useStore();
  const [files, setFiles] = useState<CustomerFile[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cloud = auth.mode === 'supabase' && !!activeCompanyId;

  const load = useCallback(async () => {
    if (!cloud) return;
    try { setFiles(await listCustomerFiles(activeCompanyId!, customer.id)); } catch (e) { setError((e as Error).message); setFiles([]); }
  }, [cloud, activeCompanyId, customer.id]);
  useEffect(() => { load(); }, [load]);

  const upload = async (list: FileList | File[]) => {
    setError('');
    for (const file of Array.from(list)) {
      setBusy(`Lade „${file.name}“ hoch …`);
      try { await uploadCustomerFile(activeCompanyId!, customer.id, file); } catch (e) { setError((e as Error).message); }
    }
    setBusy('');
    load();
  };
  const open = async (f: CustomerFile, download: boolean) => {
    try { window.open(await fileUrl(f.path, download ? f.name : undefined), '_blank', 'noopener'); } catch (e) { setError((e as Error).message); }
  };
  const remove = async (f: CustomerFile) => {
    if (!confirm(`„${f.name}“ löschen?`)) return;
    try { await deleteCustomerFile(activeCompanyId!, f); load(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <Modal title={`Dokumente – ${customer.name}`} onClose={onClose} wide>
      {!cloud ? <p className="muted">Dokumente lassen sich nur mit Konto (Cloud) speichern.</p> : (
        <>
          <div className={`dropzone${drag ? ' over' : ''}`} onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}>
            <Upload size={22} />
            <strong>{busy || 'Dateien hier ablegen oder klicken'}</strong>
            <small>PDF, Word, Excel, Bilder · bis 20 MB je Datei</small>
            <input ref={input} type="file" multiple accept={FILE_ACCEPT} hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ''; }} />
          </div>
          {error ? <p className="field-error">{error}</p> : null}
          {files === null ? <p className="muted">Lade …</p> : files.length ? (
            <ul className="file-list">
              {files.map((f) => (
                <li key={f.id}>
                  <span className="file-icon">{f.mime.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
                  <span className="file-name"><strong>{f.name}</strong><small>{sizeLabel(f.size)} · {formatDate(f.created_at.slice(0, 10))}</small></span>
                  <button className="icon-btn" title="Ansehen" onClick={() => open(f, false)}><Eye size={16} /></button>
                  <button className="icon-btn" title="Herunterladen" onClick={() => open(f, true)}><Download size={16} /></button>
                  <button className="icon-btn danger" title="Löschen" onClick={() => remove(f)}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          ) : <p className="muted"><Paperclip size={14} className="inline-icon" /> Noch keine Dokumente für diesen Kunden.</p>}
        </>
      )}
    </Modal>
  );
}
