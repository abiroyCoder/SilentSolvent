import { getContractAddress } from '../config';
import { useContractState } from '../hooks/useContractState';
import TerminalGridBackground from '../components/TerminalGridBackground';
import EncryptionTerminalHero from '../components/EncryptionTerminalHero';
import ZkPipelineSection from '../components/ZkPipelineSection';
import CircuitTelemetryDeck from '../components/CircuitTelemetryDeck';
import PrivacyMatrixSection from '../components/PrivacyMatrixSection';

export default function LandingPage() {
  const { ledgerState } = useContractState();
  const address = getContractAddress();

  const stats = {
    count: ledgerState?.total_attestations?.toString() || '0',
    threshold: ledgerState?.min_solvency_threshold ? 
      `$${(Number(ledgerState.min_solvency_threshold) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '$50,000.00',
    contractAddress: address,
  };

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
