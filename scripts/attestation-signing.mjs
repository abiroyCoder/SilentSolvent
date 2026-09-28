import crypto from 'node:crypto';
import { ecMulGenerator } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { pureCircuits } from '../contracts/managed/silentsolvent/contract/index.js';

export const JUBJUB_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
export const TWO_248 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

export function parseBytes32(value, fieldName) {
  if (typeof value !== 'string' || !/^(?:0x)?[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${fieldName} must be exactly 32 bytes of hexadecimal data`);
  }
  return Uint8Array.from(Buffer.from(value.replace(/^0x/i, ''), 'hex'));
}

export function hex(value) {
  return Buffer.from(value).toString('hex');
}

function randomScalar() {
  let value = BigInt(`0x${crypto.randomBytes(32).toString('hex')}`) % JUBJUB_ORDER;
  return value === 0n ? 1n : value;
}

export function getPublicKey(secretKey) {
  return ecMulGenerator(((BigInt(secretKey) % JUBJUB_ORDER) + JUBJUB_ORDER) % JUBJUB_ORDER);
}

export function attestationMessage({ assetId, issuerId, sessionId, firmCommitment, balance, issuedAt, expiresAt, nonce }) {
  return pureCircuits.attestation_message(
    parseBytes32(assetId, 'assetId'),
    parseBytes32(issuerId, 'issuerId'),
    parseBytes32(sessionId, 'sessionId'),
    parseBytes32(firmCommitment, 'firmCommitment'),
    BigInt(balance),
    BigInt(issuedAt),
    BigInt(expiresAt),
    parseBytes32(nonce, 'nonce'),
  );
}

export function signAttestation(secretKey, fields) {
  const sk = ((BigInt(secretKey) % JUBJUB_ORDER) + JUBJUB_ORDER) % JUBJUB_ORDER;
  if (sk === 0n) throw new Error('Attestation signing key must not be zero');
  const pk = getPublicKey(sk);
  const message = attestationMessage(fields);
  const nonce = randomScalar();
  // Re-derive the announcement from the signing nonce so the response and R
  // are generated from the same ephemeral scalar.
  const R = ecMulGenerator(nonce);
  const c = BigInt(pureCircuits.attestation_challenge(R.x, R.y, pk.x, pk.y, message)) % TWO_248;
  const response = (nonce + c * sk) % JUBJUB_ORDER;
  return {
    announcement: { x: R.x.toString(), y: R.y.toString() },
    response: response.toString(),
  };
}

export function publicKeyForHex(secretKeyHex) {
  const secretBytes = parseBytes32(secretKeyHex, 'ATTESTATION_SIGNING_KEY');
  const secret = BigInt(`0x${hex(secretBytes)}`);
  const point = getPublicKey(secret);
  return { x: point.x.toString(), y: point.y.toString() };
}

export function reductionForChallenge(challenge) {
  const value = BigInt(challenge);
  return [value / (2n ** 248n), value % (2n ** 248n)];
}
