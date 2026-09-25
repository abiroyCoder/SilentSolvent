import { pureCircuits } from '../managed/contract/index.js';
import { fromHex, toHex } from './midnight';

export interface FirmCredential {
  secretKey: string; // 32-byte hex string (Private witness - never leaves browser)
  firmIdCommitment: string; // Public cryptographic commitment
  label: string;
  createdAt: number;
}

const STORAGE_KEY = 'silentsolvent_firm_credential_v1';

/**
 * Deterministically computes the public firm ID commitment from the private secret key.
 * Uses domain-separated persistentHash via pureCircuits.make_nullifier.
 */
export function deriveFirmCommitment(secretKeyHex: string): string {
  try {
    const skBytes = fromHex(secretKeyHex);
    // Domain separation tag for firm identity
    const domainTag = new Uint8Array(32);
    const tagStr = 'ssolv:firm:id:v1';
    for (let i = 0; i < tagStr.length; i++) domainTag[i] = tagStr.charCodeAt(i);
    const commitment = pureCircuits.make_nullifier(skBytes, domainTag);
    return toHex(commitment);
  } catch (e) {
    console.error('Failed to derive firm commitment:', e);
    return '';
  }
}

/**
 * Derives a deterministic firm secret from a wallet address or seed phrase.
 */
export async function deriveFirmSecretFromSeed(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`silentsolvent:firm:seed:${seed}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Loads the stored persistent firm credential, or creates a new cryptographically secure one.
 */
export function getOrCreatePersistentFirmCredential(): FirmCredential {
  if (typeof window === 'undefined') {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const sk = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    return {
      secretKey: sk,
      firmIdCommitment: deriveFirmCommitment(sk),
      label: 'Institutional Desk (Default)',
      createdAt: Date.now(),
    };
  }

  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.secretKey && parsed.secretKey.length === 64) {
        if (!parsed.firmIdCommitment) {
          parsed.firmIdCommitment = deriveFirmCommitment(parsed.secretKey);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {
      // invalid cache, regenerate
    }
  }

  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const secretKey = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const credential: FirmCredential = {
    secretKey,
    firmIdCommitment: deriveFirmCommitment(secretKey),
    label: 'Primary Institutional Vault',
    createdAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
  return credential;
}

/**
 * Persists an updated firm credential.
 */
export function saveFirmCredential(credential: FirmCredential): void {
  if (typeof window === 'undefined') return;
  credential.firmIdCommitment = deriveFirmCommitment(credential.secretKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
}

/**
 * Computes the session-scoped nullifier for this firm credential and a given trade session ID.
 */
export function computeSessionNullifier(firmSecretHex: string, sessionIdBytes: Uint8Array): Uint8Array {
  const skBytes = fromHex(firmSecretHex);
  return pureCircuits.make_nullifier(skBytes, sessionIdBytes);
}

/**
 * Checks if a firm credential has already attested in the given on-chain ledger state.
 * Enforces genuine one-attestation-per-credential semantics.
 */
export function checkAttestationStatus(
  firmSecretHex: string,
  ledgerState: any,
): { hasAttested: boolean; nullifierHex: string } {
  if (!firmSecretHex || !ledgerState || !ledgerState.trade_session_id) {
    return { hasAttested: false, nullifierHex: '' };
  }

  try {
    const nulBytes = computeSessionNullifier(firmSecretHex, ledgerState.trade_session_id);
    const nulHex = toHex(nulBytes);

    // 1. Check if member of nullifiers set
    if (ledgerState.nullifiers) {
      if (typeof ledgerState.nullifiers.member === 'function') {
        try {
          if (ledgerState.nullifiers.member(nulBytes)) {
            return { hasAttested: true, nullifierHex: nulHex };
          }
        } catch {
          // fallback to iterator if member check throws
        }
      }

      // Check iterable
      if (typeof ledgerState.nullifiers[Symbol.iterator] === 'function') {
        for (const existingNul of ledgerState.nullifiers) {
          if (toHex(existingNul) === nulHex) {
            return { hasAttested: true, nullifierHex: nulHex };
          }
        }
      }
    }

    // 2. Check attestation_log map
    if (ledgerState.attestation_log) {
      if (typeof ledgerState.attestation_log.lookup === 'function') {
        try {
          const session = ledgerState.attestation_log.lookup(nulBytes);
          if (session) {
            return { hasAttested: true, nullifierHex: nulHex };
          }
        } catch {}
      }

      if (typeof ledgerState.attestation_log[Symbol.iterator] === 'function') {
        for (const entry of ledgerState.attestation_log) {
          if (Array.isArray(entry) && toHex(entry[0]) === nulHex) {
            return { hasAttested: true, nullifierHex: nulHex };
          }
        }
      }
    }

    return { hasAttested: false, nullifierHex: nulHex };
  } catch (e) {
    console.error('Error checking attestation status:', e);
    return { hasAttested: false, nullifierHex: '' };
  }
}
