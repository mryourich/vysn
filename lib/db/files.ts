'use client';

import { uid } from '../calc';
import { getSupabase } from './supabase';

/** Dokumente je Kunde im privaten Storage-Bucket (nur mit Konto/Supabase). */
const BUCKET = 'customer-files';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.csv,.jpg,.jpeg,.png,.heic,.zip';

export type CustomerFile = { id: string; customer_id: string; name: string; size: number; mime: string; path: string; created_at: string };

export async function listCustomerFiles(companyId: string, customerId: string): Promise<CustomerFile[]> {
  const { data, error } = await getSupabase().from('customer_files').select('id, customer_id, name, size, mime, path, created_at')
    .eq('company_id', companyId).eq('customer_id', customerId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as CustomerFile[];
}

const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-120) || 'datei';

export async function uploadCustomerFile(companyId: string, customerId: string, file: File): Promise<CustomerFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`„${file.name}“ ist größer als 20 MB.`);
  const sb = getSupabase();
  const id = uid();
  const path = `${companyId}/${customerId}/${id}-${safeName(file.name)}`;
  const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const row = { company_id: companyId, id, customer_id: customerId, name: file.name, size: file.size, mime: file.type || '', path };
  const { error } = await sb.from('customer_files').insert(row);
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return { ...row, created_at: new Date().toISOString() };
}

/** Kurzlebiger Download-Link (60 s). */
export async function fileUrl(path: string, download?: string) {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 60, download ? { download } : undefined);
  if (error || !data) throw new Error(error?.message || 'Datei nicht gefunden.');
  return data.signedUrl;
}

export async function deleteCustomerFile(companyId: string, file: CustomerFile) {
  const sb = getSupabase();
  const rm = await sb.storage.from(BUCKET).remove([file.path]);
  if (rm.error) throw new Error(rm.error.message);
  const { error } = await sb.from('customer_files').delete().eq('company_id', companyId).eq('id', file.id);
  if (error) throw new Error(error.message);
}
