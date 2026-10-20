import { useCallback, useEffect, useState } from 'react';
import { listEntries, listProjects } from '../shared/projects';
import type { Project, ProjectEntry } from '../shared/projects';
import { useStore } from './store';
import { supabase } from './supabase';

/** Baustellen und Einträge der aktiven Firma laden (nicht Teil des allgemeinen Datenstands) */
export function useProjects(projectId?: string) {
  const { companyId } = useStore();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [p, e] = await Promise.all([listProjects(supabase, companyId), listEntries(supabase, companyId, projectId)]);
      setProjects(p);
      setEntries(e);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setProjects((p) => p || []);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);
  useEffect(() => { reload(); }, [reload]);
  return { projects, entries, setEntries, setProjects, loading, error, reload };
}
