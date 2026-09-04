import { useState, useEffect } from 'react';
import { getContractAddress } from '../config';
import { createPatchedPublicDataProvider } from '../lib/midnight';

const INDEXER_URL = 'http://127.0.0.1:8088/api/v4/graphql';
const INDEXER_WS = 'ws://127.0.0.1:8088/api/v4/graphql/ws';

export function useContractState(pollIntervalMs = 5000, specificAddress?: string) {
  const [ledgerState, setLedgerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchState = async (addressToUse: string) => {
    if (!addressToUse) return;
    try {
      const provider = createPatchedPublicDataProvider(INDEXER_URL, INDEXER_WS);
      const state = await provider.queryContractState(addressToUse);
      if (state && state.data) {
        setLedgerState(state.data);
        setLastUpdate(new Date());
        setError(null);
      } else if (!state) {
        setLedgerState(null);
      }
    } catch (e: any) {
      console.error('Error fetching contract state:', e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const addressToUse = specificAddress || getContractAddress();
    if (!addressToUse) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchState(addressToUse).catch(() => {});

    // Reactive polling
    const id = setInterval(() => {
      fetchState(addressToUse).catch(() => {});
    }, pollIntervalMs);

    return () => clearInterval(id);
  }, [pollIntervalMs, specificAddress]);

  return { ledgerState, isLoading, error, lastUpdate, refetch: () => fetchState(specificAddress || getContractAddress()) };
}
