import http from 'node:http';
import crypto from 'node:crypto';
import { publicKeyForHex, parseBytes32, signAttestation } from './attestation-signing.mjs';

const port = Number(process.env.ATTESTATION_PORT ?? 4100);
const sourceUrl = process.env.CUSTODIAN_SOURCE_URL;
const signingKey = process.env.ATTESTATION_SIGNING_KEY;
const assetId = process.env.ATTESTATION_ASSET_ID;
const issuerId = process.env.ATTESTATION_ISSUER_ID;
const ttlSeconds = Number(process.env.ATTESTATION_TTL_SECONDS ?? 300);

if (!sourceUrl) throw new Error('CUSTODIAN_SOURCE_URL is required; refusing to run without a live balance source');
if (!signingKey) throw new Error('ATTESTATION_SIGNING_KEY is required; refusing to generate an ephemeral signer');
parseBytes32(assetId, 'ATTESTATION_ASSET_ID');
parseBytes32(issuerId, 'ATTESTATION_ISSUER_ID');
parseBytes32(signingKey, 'ATTESTATION_SIGNING_KEY');
if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) {
  throw new Error('ATTESTATION_TTL_SECONDS must be an integer between 30 and 900');
}

const configuredSource = new URL(sourceUrl);
if (!['https:', 'http:'].includes(configuredSource.protocol)) {
  throw new Error('CUSTODIAN_SOURCE_URL must use HTTPS (HTTP is allowed only for local development)');
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.ATTESTATION_ALLOWED_ORIGIN ?? 'null',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_768) throw new Error('Request body is too large');
  }
  return raw ? JSON.parse(raw) : {};
}

async function readCustodianSnapshot(request, nonce) {
  const response = await fetch(configuredSource, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      assetId,
      firmCommitment: request.firmCommitment,
      sessionId: request.sessionId,
      nonce,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Custodian source returned HTTP ${response.status}`);
  const source = await response.json();
  if (source.assetId && source.assetId.toLowerCase() !== assetId.toLowerCase()) {
    throw new Error('Custodian source returned a different asset');
  }
  if (source.firmCommitment && source.firmCommitment.toLowerCase() !== request.firmCommitment.toLowerCase()) {
    throw new Error('Custodian source returned a different firm commitment');
  }
  if (!/^[0-9]+$/.test(String(source.balance))) {
    throw new Error('Custodian source did not return an integer asset balance');
  }
  const balance = BigInt(source.balance);
  if (balance <= 0n) throw new Error('Custodian source returned a non-positive balance');
  return balance;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { status: 'ok', assetId, issuerId });
    }
    if (req.method === 'GET' && req.url === '/provider-info') {
      return json(res, 200, {
        assetId,
        issuerId,
        publicKey: publicKeyForHex(signingKey),
        attestationTtlSeconds: ttlSeconds,
      });
    }
    if (req.method !== 'POST' || req.url !== '/attest') return json(res, 404, { error: 'not found' });

    const body = await readBody(req);
    parseBytes32(body.sessionId, 'sessionId');
    parseBytes32(body.firmCommitment, 'firmCommitment');
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ttlSeconds;
    const nonce = `0x${crypto.randomBytes(32).toString('hex')}`;
    const balance = await readCustodianSnapshot(body, nonce);
    const fields = {
      assetId,
      issuerId,
      sessionId: body.sessionId,
      firmCommitment: body.firmCommitment,
      balance,
      issuedAt: now,
      expiresAt,
      nonce,
    };
    const signature = signAttestation(signingKey, fields);
    return json(res, 200, {
      ...fields,
      balance: balance.toString(),
      signature,
    });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'attestation failed' });
  }
});

server.listen(port, () => {
  console.log(`SilentSolvent attestation service listening on http://127.0.0.1:${port}`);
  console.log(`Provider public key: ${JSON.stringify(publicKeyForHex(signingKey))}`);
});
