// Default network configuration
// Defaults to Midnight Preprod unless overridden by environment variables or local dev
export const INDEXER_URL = 
  import.meta.env.VITE_INDEXER_URL || 
  'https://indexer.preprod.midnight.network/api/v4/graphql';

export const INDEXER_WS =
  import.meta.env.VITE_INDEXER_WS ||
  'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

// No default is intentional. A solvency proof cannot be generated until a
// real custodian gateway is configured and returns a fresh signed snapshot.
export const ATTESTATION_API_URL = String(import.meta.env.VITE_ATTESTATION_API_URL || '').replace(/\/$/, '');

// Address of the deployed SilentSolvent contract
// You can override this in localStorage for testing without rebuilding
export const getContractAddress = (): string => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('silentsolvent_contract_address');
    if (cached) return cached;
  }
  // Default Preprod address
  return import.meta.env.VITE_CONTRACT_ADDRESS || '79f20921e5ca2377260b4912892cb690f20afa14ccc86667e697724d6eb13268';
};

export const setContractAddress = (address: string) => {
  localStorage.setItem('silentsolvent_contract_address', address);
};

export const getExplorerContractUrl = (address?: string) =>
  `https://explorer.1am.xyz/contract/${address || getContractAddress()}?network=preprod`;

export const getExplorerTxUrl = (txId: string) =>
  `https://explorer.1am.xyz/tx/${txId}?network=preprod`;

