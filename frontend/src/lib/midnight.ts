import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';

export function toHex(bytes: Uint8Array | null | undefined): string {
  if (!bytes) return '';
  if (typeof bytes === 'string') return bytes;
  try {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);

  async function queryLatest(query: string, address: string) {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    });
    if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`);
    const payload = await res.json();
    if (payload.errors?.length) throw new Error(payload.errors.map((e: any) => e.message).join('; '));
    return payload.data?.contractAction ?? null;
  }

  return {
    ...base,
    async queryContractState(contractAddress: string, config?: any) {
      if (config) return base.queryContractState(contractAddress, config);
      const action = await queryLatest(
        `query LATEST($address: HexEncoded!) { contractAction(address: $address) { state } }`,
        contractAddress,
      );
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
  };
}

function serializeState(val: unknown): string {
  return JSON.stringify(val, (_key, value) => {
    if (value instanceof Uint8Array) {
      return { __type: 'Uint8Array', hex: toHex(value) };
    }
    if (typeof value === 'bigint') {
      return { __type: 'bigint', value: value.toString() };
    }
    return value;
  });
}

function deserializeState(json: string): unknown {
  try {
    return JSON.parse(json, (_key, value) => {
      if (value && typeof value === 'object') {
        if (value.__type === 'Uint8Array' && typeof value.hex === 'string') {
          return fromHex(value.hex);
        }
        if (value.__type === 'bigint' && typeof value.value === 'string') {
          return BigInt(value.value);
        }
      }
      return value;
    });
  } catch {
    return null;
  }
}

export function createPersistentPrivateStateProvider(storagePrefix = 'silentsolvent_pstate_') {
  let scope = '';
  const stateStore = new Map<string, unknown>();
  const signingKeyStore = new Map<string, unknown>();
  const key = (id: string) => `${storagePrefix}${scope}:${id}`;
  const sigKey = (addr: string) => `${storagePrefix}sig:${addr}`;

  // Hydrate from localStorage if in browser environment
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(storagePrefix)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const val = deserializeState(raw);
        if (k.startsWith(`${storagePrefix}sig:`)) {
          const addr = k.slice(`${storagePrefix}sig:`.length);
          signingKeyStore.set(addr, val);
        } else {
          const id = k.slice(storagePrefix.length);
          stateStore.set(id, val);
        }
      }
    } catch (e) {
      console.warn('Failed to hydrate private state from storage:', e);
    }
  }

  return {
    setContractAddress(address: string) { scope = address; },
    async set(id: string, state: unknown) {
      const scopedKey = key(id);
      stateStore.set(`${scope}:${id}`, state);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(scopedKey, serializeState(state));
        } catch (e) {
          console.warn('Failed to persist private state to localStorage:', e);
        }
      }
    },
    async get(id: string) {
      const inMem = stateStore.get(`${scope}:${id}`);
      if (inMem !== undefined) return inMem;
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(key(id));
        if (raw) {
          const val = deserializeState(raw);
          stateStore.set(`${scope}:${id}`, val);
          return val;
        }
      }
      return null;
    },
    async remove(id: string) {
      stateStore.delete(`${scope}:${id}`);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key(id));
      }
    },
    async clear() {
      stateStore.clear();
      if (typeof window !== 'undefined' && window.localStorage) {
        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(storagePrefix) && !k.startsWith(`${storagePrefix}sig:`)) {
            toDelete.push(k);
          }
        }
        toDelete.forEach((k) => localStorage.removeItem(k));
      }
    },
    async setSigningKey(addr: string, k: unknown) {
      signingKeyStore.set(addr, k);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(sigKey(addr), serializeState(k));
      }
    },
    async getSigningKey(addr: string) {
      const inMem = signingKeyStore.get(addr);
      if (inMem !== undefined) return inMem;
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(sigKey(addr));
        if (raw) {
          const val = deserializeState(raw);
          signingKeyStore.set(addr, val);
          return val;
        }
      }
      return null;
    },
    async removeSigningKey(addr: string) {
      signingKeyStore.delete(addr);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(sigKey(addr));
      }
    },
    async clearSigningKeys() {
      signingKeyStore.clear();
      if (typeof window !== 'undefined' && window.localStorage) {
        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`${storagePrefix}sig:`)) {
            toDelete.push(k);
          }
        }
        toDelete.forEach((k) => localStorage.removeItem(k));
      }
    },
    async exportPrivateStates(): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {};
      stateStore.forEach((v, k) => { result[k] = v; });
      return result;
    },
    async importPrivateStates(states: Record<string, unknown>): Promise<void> {
      for (const [k, v] of Object.entries(states)) {
        stateStore.set(k, v);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(`${storagePrefix}${k}`, serializeState(v));
        }
      }
    },
    async exportSigningKeys(): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {};
      signingKeyStore.forEach((v, k) => { result[k] = v; });
      return result;
    },
    async importSigningKeys(keys: Record<string, unknown>): Promise<void> {
      for (const [k, v] of Object.entries(keys)) {
        signingKeyStore.set(k, v);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(sigKey(k), serializeState(v));
        }
      }
    },
  };
}

export const createPrivateStateProvider = createPersistentPrivateStateProvider;

export interface ConnectedSession {
  api: any;
  config: any;
  unshieldedAddress: string;
  shieldedAddress: any;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider;
    proofProvider: { proveTx: (unprovenTx: any, _config: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
}

export async function createConnectedSession(api: any): Promise<ConnectedSession> {
  const [config, unshieldedAddr, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL('/managed', window.location.origin).toString(),
    window.fetch.bind(window),
  );

  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  const proofProvider = {
    async proveTx(unprovenTx: any, _config: any) {
      let CostModelClass: any;
      try {
        const protocolLedger = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
        CostModelClass = protocolLedger.CostModel;
      } catch {
        const ledgerV8 = await import('@midnight-ntwrk/ledger-v8');
        CostModelClass = ledgerV8.CostModel;
      }
      return unprovenTx.prove(provingProvider, CostModelClass.initialCostModel());
    },
  };

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const balanced = await api.balanceUnsealedTransaction(txHex);
      if (!balanced?.tx) throw new Error('balanceUnsealedTransaction failed');
      let TransactionClass: any;
      try {
        const protocolLedger = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
        TransactionClass = protocolLedger.Transaction;
      } catch {
        const ledgerV8 = await import('@midnight-ntwrk/ledger-v8');
        TransactionClass = ledgerV8.Transaction;
      }
      return TransactionClass.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const result = await api.submitTransaction(txHex);
      if (typeof result === 'string' && result) return result;
      if (result?.transactionId) return result.transactionId;
      if (result?.id) return result.id;
      return txHex.slice(0, 64);
    },
  };

  const publicDataProvider = config?.indexerUri && config?.indexerWsUri
    ? createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri)
    : (api.getPublicDataProvider ? await api.getPublicDataProvider() : null);

  const unshieldedAddressStr = typeof unshieldedAddr === 'string'
    ? unshieldedAddr
    : unshieldedAddr?.unshieldedAddress || '';

  return {
    api, config,
    unshieldedAddress: unshieldedAddressStr,
    shieldedAddress,
    providers: {
      privateStateProvider: (window as any).privateStateProvider ?? createPrivateStateProvider(),
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
  };
}

export async function waitForContractDeployment(
  publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>,
  contractAddress: string,
  pollIntervalMs = 2000,
  maxAttempts = 45,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const state = await publicDataProvider.queryContractState(contractAddress);
    if (state?.data) return;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Contract not indexed after ${maxAttempts * pollIntervalMs}ms`);
}
