import { useState, useEffect, useRef } from 'react';
import { getContractAddress, INDEXER_URL, INDEXER_WS } from '../config';
import { createPatchedPublicDataProvider } from '../lib/midnight';

// Singleton instance to prevent creating multiple WebSocket/Apollo clients and leaking listeners
let sharedProvider: ReturnType<typeof createPatchedPublicDataProvider> | null = null;

function getSharedProvider() {
  if (!sharedProvider) {
    sharedProvider = createPatchedPublicDataProvider(INDEXER_URL, INDEXER_WS);
  }
  return sharedProvider;
}

const ZERO_ADDRESS = '020000000000000000000000000000000000000000000000000000000000000000';

export function useContractState(pollIntervalMs = 5000, specificAddress?: string) {
  const [ledgerState, setLedgerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const failureCountRef = useRef(0);

  const fetchState = async (addressToUse: string) => {
    if (!addressToUse || addressToUse === ZERO_ADDRESS) {
      setIsLoading(false);
      return;
    }
    try {
      const provider = getSharedProvider();
      const state = await provider.queryContractState(addressToUse);
      if (state && state.data) {
        setLedgerState(state.data);
        setLastUpdate(new Date());
        setError(null);
        failureCountRef.current = 0;
      } else if (!state) {
        setLedgerState(null);
      }
    } catch (e: any) {
      failureCountRef.current++;
      // Only warn occasionally to avoid flooding browser devtools
      if (failureCountRef.current <= 1) {
        console.warn('Indexer connection unready or contract not indexed yet:', e.message || e);
      }
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
