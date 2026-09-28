import { pureCircuits } from '../managed/contract/index.js';
import { fromHex, toHex } from './midnight';

export interface FirmCredential {
  /** 32-byte secret held only in this JavaScript process. */
  secretKey: string;
  firmIdCommitment: string;
  label: string;
  createdAt: number;
}

let inMemoryCredential: FirmCredential | null = null;

function assertSecret(secretKeyHex: string): void {
  if (!/^[0-9a-fA-F]{64}$/.test(secretKeyHex)) {
    throw new Error('Firm secret key must be exactly 32 bytes (64 hexadecimal characters).');
  }
}

/** Derive the public commitment used by the signed attestation and nullifier. */
export function deriveFirmCommitment(secretKeyHex: string): string {
  assertSecret(secretKeyHex);
  return toHex((pureCircuits as any).derive_firm_commitment(fromHex(secretKeyHex)));
}

/**
 * Deliberately memory-only.  localStorage/sessionStorage, downloads, and
 * browser persistence are not acceptable key stores for an operator secret.
 * Reloading the page creates a new credential and requires a fresh custodian
 * attestation, which is the safe failure mode for this prototype.
 */
export function getOrCreatePersistentFirmCredential(): FirmCredential {
  if (inMemoryCredential) return inMemoryCredential;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secretKey = toHex(bytes);
  inMemoryCredential = {
    secretKey,
    firmIdCommitment: deriveFirmCommitment(secretKey),
    label: 'In-memory institutional credential',
    createdAt: Date.now(),
  };
  return inMemoryCredential;
}

/** Update the process-local credential; never write it to disk or Web Storage. */
export function saveFirmCredential(credential: FirmCredential): void {
  assertSecret(credential.secretKey);
  inMemoryCredential = {
    ...credential,
    secretKey: credential.secretKey.toLowerCase(),
    firmIdCommitment: deriveFirmCommitment(credential.secretKey.toLowerCase()),
  };
}

export function clearFirmCredential(): void {
  inMemoryCredential = null;
}

export async function deriveFirmSecretFromSeed(seed: string): Promise<string> {
  const data = new TextEncoder().encode(`silentsolvent:firm:seed:${seed}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(hashBuffer));
}

export function computeSessionNullifier(firmSecretHex: string, sessionIdBytes: Uint8Array): Uint8Array {
  assertSecret(firmSecretHex);
  return (pureCircuits as any).make_nullifier(fromHex(firmSecretHex), sessionIdBytes);
}

export function checkAttestationStatus(
  firmSecretHex: string,
  ledgerState: any,
): { hasAttested: boolean; nullifierHex: string } {
  if (!firmSecretHex || !ledgerState?.trade_session_id) {
    return { hasAttested: false, nullifierHex: '' };
  }
  try {
    const nulBytes = computeSessionNullifier(firmSecretHex, ledgerState.trade_session_id);
    const nulHex = toHex(nulBytes);
    if (ledgerState.nullifiers?.member?.(nulBytes)) {
      return { hasAttested: true, nullifierHex: nulHex };
    }
    if (ledgerState.nullifiers && typeof ledgerState.nullifiers[Symbol.iterator] === 'function') {
      for (const existing of ledgerState.nullifiers) {
        if (toHex(existing) === nulHex) return { hasAttested: true, nullifierHex: nulHex };
      }
    }
    return { hasAttested: false, nullifierHex: nulHex };
  } catch (error) {
    console.error('Unable to check attestation status:', error);
    return { hasAttested: false, nullifierHex: '' };
  }
}
