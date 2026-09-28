import { ATTESTATION_API_URL } from '../config';

export type BalanceSourceType = 'custodian_attestation';

export interface SchnorrSignaturePayload {
  announcement: { x: string; y: string };
  response: string;
}

/**
 * This is the only balance payload accepted by the proving flow.  The balance
 * is intentionally a string because it is an exact asset-unit integer, not a
 * JavaScript number.  The provider signature covers every field below.
 */
export interface BalanceAttestationPayload {
  assetId: string;
  issuerId: string;
  sessionId: string;
  firmCommitment: string;
  balance: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: SchnorrSignaturePayload;
}

export interface AuthenticatedBalanceResult {
  sourceType: BalanceSourceType;
  sourceLabel: string;
  balanceCents: bigint;
  formattedBalance: string;
  isVerified: boolean;
  verificationDetails: string;
  timestamp: number;
  attestation: BalanceAttestationPayload;
}

function isHex32(value: unknown): value is string {
  return typeof value === 'string' && /^(?:0x)?[0-9a-fA-F]{64}$/.test(value);
}

function assertAttestationShape(value: any): asserts value is BalanceAttestationPayload {
  if (!value || !isHex32(value.assetId) || !isHex32(value.issuerId) || !isHex32(value.sessionId) ||
      !isHex32(value.firmCommitment) || !isHex32(value.nonce)) {
    throw new Error('Attestation identifiers must all be exactly 32-byte hexadecimal values.');
  }
  if (!/^[0-9]+$/.test(String(value.balance)) || BigInt(value.balance) <= 0n) {
    throw new Error('Attestation balance must be a positive integer asset amount.');
  }
  if (!Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)) {
    throw new Error('Attestation timestamps are invalid.');
  }
  if (value.expiresAt <= value.issuedAt) throw new Error('Attestation validity window is invalid.');
  if (!value.signature || !value.signature.announcement ||
      !/^[0-9]+$/.test(String(value.signature.announcement.x)) ||
      !/^[0-9]+$/.test(String(value.signature.announcement.y)) ||
      !/^[0-9]+$/.test(String(value.signature.response))) {
    throw new Error('Attestation does not contain a valid Jubjub Schnorr signature.');
  }
}

/**
 * Fetch a fresh attestation from the configured custodian gateway.  The
 * gateway obtains the balance from its configured custodian source and signs
 * the exact asset/session/firm/timestamp/nonce tuple.  The browser never
 * accepts a balance, signature, or fallback supplied by the user.
 */
export async function fetchFreshCustodianAttestation(input: {
  assetId: string;
  issuerId: string;
  sessionId: string;
  firmCommitment: string;
}): Promise<AuthenticatedBalanceResult> {
  if (!ATTESTATION_API_URL) {
    throw new Error('No attestation service is configured; a signed custodian snapshot is required.');
  }
  for (const [name, value] of Object.entries(input)) {
    if (!isHex32(value)) throw new Error(`${name} must be a 32-byte hexadecimal value.`);
  }

  const response = await fetch(`${ATTESTATION_API_URL}/attest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Attestation service returned HTTP ${response.status}.`);
  assertAttestationShape(payload);

  const now = Math.floor(Date.now() / 1000);
  if (payload.assetId.toLowerCase() !== input.assetId.toLowerCase() ||
      payload.issuerId.toLowerCase() !== input.issuerId.toLowerCase() ||
      payload.sessionId.toLowerCase() !== input.sessionId.toLowerCase() ||
      payload.firmCommitment.toLowerCase() !== input.firmCommitment.toLowerCase()) {
    throw new Error('Attestation context does not match the active session, asset, issuer, or firm.');
  }
  if (payload.issuedAt > now + 5) throw new Error('Attestation was issued in the future.');
  if (payload.expiresAt <= now) throw new Error('Attestation is already expired.');

  const balance = BigInt(payload.balance);
  return {
    sourceType: 'custodian_attestation',
    sourceLabel: `Custodian issuer ${payload.issuerId.slice(0, 14)}…`,
    balanceCents: balance,
    formattedBalance: `${balance.toString()} asset units`,
    isVerified: true,
    verificationDetails: 'Fresh Jubjub Schnorr attestation; signature and context are verified in the Compact circuit.',
    timestamp: payload.issuedAt * 1000,
    attestation: payload,
  };
}
