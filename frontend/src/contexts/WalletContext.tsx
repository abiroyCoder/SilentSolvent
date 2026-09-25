import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import '@midnight-ntwrk/dapp-connector-api';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { createConnectedSession, type ConnectedSession } from '../lib/midnight';

export type WalletType = '1am' | 'lace' | 'generic' | null;
export type WalletStatus = 'checking' | 'detected' | 'not-found';

export interface WalletEntry {
  id: string;
  name: string;
  icon?: string;
  api: InitialAPI;
}

type WalletContextType = {
  address: string | null;
  isConnected: boolean;
  walletType: WalletType;
  walletName: string | null;
  isConnecting: boolean;
  walletStatus: WalletStatus;
  session: ConnectedSession | null;
  availableWallets: WalletEntry[];
  connect: (network?: string, preferredWalletId?: string) => Promise<ConnectedSession | undefined>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

export function listInjectedWallets(): WalletEntry[] {
  if (typeof window === 'undefined' || !(window as any).midnight) return [];
  const midnight = (window as any).midnight;
  return Object.entries(midnight).map(([id, val]) => {
    const api = val as InitialAPI;
    return {
      id,
      name: api.name || (id === '1am' ? '1AM Wallet' : id === 'mnLace' ? 'Lace Wallet' : id),
      icon: api.icon,
      api,
    };
  });
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('checking');
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletEntry[]>([]);
  const connectingRef = useRef(false);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const wallets = listInjectedWallets();
      if (wallets.length > 0) {
        setAvailableWallets(wallets);
        const first = wallets[0];
        setWalletName(first.name);
        setWalletType(first.id === '1am' ? '1am' : first.id.toLowerCase().includes('lace') ? 'lace' : 'generic');
        setWalletStatus('detected');
        clearInterval(id);
        return;
      }
      if (Date.now() - startedAt >= 6000) {
        setWalletStatus('not-found');
        clearInterval(id);
      }
    }, 300);
    return () => clearInterval(id);
  }, []);

  const connect = useCallback(async (network = 'preprod', preferredWalletId?: string) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    try {
      const wallets = listInjectedWallets();
      if (wallets.length === 0) {
        throw new Error('No Midnight DApp Connector compatible wallet detected. Please install 1AM or Lace.');
      }

      // Pick preferred or first available wallet
      const target = preferredWalletId
        ? wallets.find((w) => w.id === preferredWalletId) || wallets[0]
        : wallets.find((w) => w.id === '1am') || wallets[0];

      // Official DApp Connector connect() method
      const connectedApi: ConnectedAPI = await target.api.connect(network);

      // Verify connection status
      const status = await connectedApi.getConnectionStatus?.();
      if (status && status.status === 'disconnected') {
        throw new Error('Wallet connection was rejected or disconnected.');
      }

      const sess = await createConnectedSession(connectedApi as any);
      setSession(sess);
      setAddress(sess.unshieldedAddress);
      setWalletName(target.name);
      setWalletType(target.id === '1am' ? '1am' : target.id.toLowerCase().includes('lace') ? 'lace' : 'generic');
      setIsConnected(true);
      return sess;
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
    setSession(null);
    setWalletStatus('checking');
    setWalletType(null);
    setWalletName(null);
    const startedAt = Date.now();
    const id = setInterval(() => {
      const wallets = listInjectedWallets();
      if (wallets.length > 0) {
        setAvailableWallets(wallets);
        const first = wallets[0];
        setWalletName(first.name);
        setWalletType(first.id === '1am' ? '1am' : first.id.toLowerCase().includes('lace') ? 'lace' : 'generic');
        setWalletStatus('detected');
        clearInterval(id);
        return;
      }
      if (Date.now() - startedAt >= 3000) {
        setWalletStatus('not-found');
        clearInterval(id);
      }
    }, 200);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        walletType,
        walletName,
        isConnecting,
        walletStatus,
        session,
        availableWallets,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
