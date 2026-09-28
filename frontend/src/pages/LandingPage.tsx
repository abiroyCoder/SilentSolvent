import React from 'react';
import CrtOverlay from '../components/CrtOverlay';
import PhotonBeamHero from '../components/PhotonBeamHero';
import ScannerCardStream from '../components/ScannerCardStream';
import InteractiveConsoleDeck from '../components/InteractiveConsoleDeck';
import ZkTargetingHud from '../components/ZkTargetingHud';
import ZkPipelineSection from '../components/ZkPipelineSection';
import PrivacyMatrixSection from '../components/PrivacyMatrixSection';

export default function LandingPage() {
  return (
    <div className="landing-overhaul-container">
      <CrtOverlay />

      <div className="page page-wide relative z-10">
        <div className="notice notice-warning mb-24 text-[12px]">
          Prototype only: this dApp demonstrates private threshold attestations. It is not a production proof-of-solvency service. A real proof requires a configured custodian gateway and a fresh signature verified by the Compact circuit.
        </div>

        {/* 1. XERO PHOTON BEAM HERO SECTION */}
        <PhotonBeamHero />

        {/* 2. SCANNER CARDS STREAM */}
        <ScannerCardStream />

        {/* 3. INTERACTIVE CONSOLE DECK & REAL-TIME LOG FEED */}
        <InteractiveConsoleDeck />

        {/* 4. HUD TARGETING ACQUISITION SYSTEM */}
        <section className="mt-40 mb-32">
          <ZkTargetingHud />
        </section>

        {/* 5. 4-PHASE CRYPTOGRAPHIC PIPELINE INSPECTOR */}
        <ZkPipelineSection />

        {/* 6. INSTITUTIONAL PRIVACY & BENCHMARK MATRIX */}
        <PrivacyMatrixSection />
      </div>
    </div>
  );
}
