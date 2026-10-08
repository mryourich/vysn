import { router } from 'expo-router';
import { useCallback } from 'react';
import type { DocKind } from '../shared/types';
import { useStore } from './store';

/** Neuen Beleg anlegen und direkt öffnen */
export function useNewDoc() {
  const { createDoc } = useStore();
  return useCallback(async (kind: DocKind, customerId = '') => {
    const doc = await createDoc(kind, customerId);
    if (doc) router.push(`/beleg/${doc.id}`);
  }, [createDoc]);
}
