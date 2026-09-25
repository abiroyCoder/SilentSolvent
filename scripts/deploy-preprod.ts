import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract, pureCircuits } from '../contracts/managed/silentsolvent/contract/index.js';
import { PREPROD_CONFIG } from '../src/config.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Automated Contract Deployment Script for Midnight Preprod
 * Can be run via CI/CD pipelines or locally:
 *   npx ts-node --esm scripts/deploy-preprod.ts
 */
export async function deploySilentSolventPreprod(options?: {
  thresholdCents?: bigint;
  cap?: bigint;
  adminSkHex?: string;
}) {
  console.log('--- Initializing SilentSolvent Automated Deployment ---');
  console.log(`Network: ${PREPROD_CONFIG.networkId}`);
  console.log(`Indexer: ${PREPROD_CONFIG.indexer}`);

  const threshold = options?.thresholdCents ?? 5_000_000n;
  const cap = options?.cap ?? 50n;
  const adminSk = options?.adminSkHex
    ? Buffer.from(options.adminSkHex.replace('0x', ''), 'hex')
    : crypto.randomBytes(32);

  const adminHash = pureCircuits.admin_public_key(new Uint8Array(adminSk));
  const sessionId = crypto.randomBytes(32);
  const brokerId = crypto.randomBytes(32);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); // 30 days

  console.log(`Admin Public Hash: 0x${Buffer.from(adminHash).toString('hex')}`);
  console.log(`Trade Session ID: 0x${sessionId.toString('hex')}`);
  console.log(`Threshold (Cents): ${threshold}`);
  console.log(`Attestation Cap: ${cap}`);

  const deploymentRecord = {
    network: 'preprod',
    deployedAt: new Date().toISOString(),
    adminSecretKey: adminSk.toString('hex'),
    adminHash: Buffer.from(adminHash).toString('hex'),
    sessionId: sessionId.toString('hex'),
    brokerId: brokerId.toString('hex'),
    deadline: deadline.toString(),
    thresholdCents: threshold.toString(),
    cap: cap.toString(),
    status: 'READY_FOR_DEPLOYMENT',
  };

  const outPath = path.join(process.cwd(), 'contracts', 'latest-deployment.json');
  fs.writeFileSync(outPath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`Deployment configuration written to: ${outPath}`);

  return deploymentRecord;
}

if (process.argv[1]?.includes('deploy-preprod.ts')) {
  deploySilentSolventPreprod()
    .then(() => console.log('Deployment preparation finished successfully.'))
    .catch((err) => {
      console.error('Deployment preparation failed:', err);
      process.exit(1);
    });
}
