import { describe, it, expect } from 'vitest';
import { runPreprodAttestationE2E } from '../../scripts/preprod-e2e.js';

const runPreprod = process.env.RUN_PREPROD_E2E === '1';

describe.skipIf(!runPreprod)('SilentSolvent genuine Preprod wallet → proof → indexer E2E', () => {
  it('submits a signed attestation through a real wallet and confirms the ledger mutation', async () => {
    const result = await runPreprodAttestationE2E();
    expect(result.status).toBe('SucceedEntirely');
    expect(result.txId).toMatch(/^[0-9a-fA-F]+$/);
  }, 240_000);
});
