import { useState, useEffect } from 'react';
import { getContractAddress } from '../config';
import { createPatchedPublicDataProvider } from '../lib/midnight';
import TerminalGridBackground from '../components/TerminalGridBackground';
import EncryptionTerminalHero from '../components/EncryptionTerminalHero';
import ZkPipelineSection from '../components/ZkPipelineSection';
import CircuitTelemetryDeck from '../components/CircuitTelemetryDeck';
import PrivacyMatrixSection from '../components/PrivacyMatrixSection';

const INDEXER_URL = 'http://127.0.0.1:8088/api/v4/graphql';
const INDEXER_WS = 'ws://127.0.0.1:8088/api/v4/graphql/ws';

export default function LandingPage() {
  const [stats, setStats] = useState<{ count: string; threshold: string; contractAddress: string }>({
    count: '0',
    threshold: '$50,000.00',
    contractAddress: getContractAddress(),
  });

  useEffect(() => {
    // Attempt to fetch real stats from indexer if running locally or on Preprod
    const fetchStats = async () => {
      try {
        const address = getContractAddress();
        const provider = createPatchedPublicDataProvider(INDEXER_URL, INDEXER_WS);
        const state = await provider.queryContractState(address);
        if (state) {
          setStats({
            count: state.data.total_attestations?.toString() || '0',
            threshold: state.data.min_solvency_threshold ? 
              `$${(Number(state.data.min_solvency_threshold) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$50,000.00',
            contractAddress: address,
          });
        }
      } catch (e) {
        // Fallback gracefully to default configured address
        setStats(prev => ({ ...prev, contractAddress: getContractAddress() }));
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="landing-wrapper">
      <TerminalGridBackground />
      <div className="page page-wide relative z-10">
        <EncryptionTerminalHero stats={stats} />
        <ZkPipelineSection />
        <CircuitTelemetryDeck />
        <PrivacyMatrixSection />
      </div>
    </div>
  );
}
