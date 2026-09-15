import React, { useState, useEffect } from 'react';
import { ShieldCheck, Crosshair, Cpu, Lock, Check } from 'lucide-react';

type HudState = 'SCANNING' | 'ACQUIRING' | 'SYNTHESIZING' | 'LOCKED';

/**
 * Direct implementation inspired by pulkitxm/claude-directory (components-ui/animated-hud-targeting-ui)
 * Animated HUD Targeting UI cycling through SCANNING -> ACQUIRING -> SYNTHESIZING -> LOCKED states.
 */
export default function ZkTargetingHud() {
  const [hudState, setHudState] = useState<HudState>('SCANNING');
  const [bearing, setBearing] = useState(142);
  const [elevation, setElevation] = useState(12.4);

  useEffect(() => {
    const cycle = () => {
      setHudState('SCANNING');
      setTimeout(() => setHudState('ACQUIRING'), 2000);
      setTimeout(() => setHudState('SYNTHESIZING'), 4200);
      setTimeout(() => setHudState('LOCKED'), 6500);
    };

    cycle();
    const interval = setInterval(cycle, 10000);

    const jitter = setInterval(() => {
      setBearing((b) => (b + 1) % 360);
      setElevation((e) => +(12.0 + Math.random() * 0.8).toFixed(1));
    }, 400);

    return () => {
      clearInterval(interval);
      clearInterval(jitter);
    };
  }, []);

  return (
    <div className="hud-panel-container">
      <div className="hud-top-bar">
        <div className="flex items-center gap-8">
          <Crosshair size={14} className="text-accent" />
          <span className="mono text-[11px] font-bold text-accent uppercase">
            TARGETING HUD // ZK-SNARK ACQUISITION
          </span>
        </div>
        <div className="flex items-center gap-12 mono text-[11px] text-text-2">
          <span>AZM: {bearing.toString().padStart(3, '0')}°</span>
          <span>ELEV: +{elevation}°</span>
          <span
            className={`hud-state-pill ${
              hudState === 'LOCKED'
                ? 'hud-pill-locked'
                : hudState === 'SYNTHESIZING'
                ? 'hud-pill-synth'
                : 'hud-pill-scan'
            }`}
          >
            [{hudState}]
          </span>
        </div>
      </div>

      <div className="hud-viewscreen">
        {/* CORNER BRACKETS */}
        <div className="hud-bracket top-left" />
        <div className="hud-bracket top-right" />
        <div className="hud-bracket bottom-left" />
        <div className="hud-bracket bottom-right" />

        {/* RADIAL CROSSHAIR */}
        <div className={`hud-crosshair-reticle ${hudState === 'LOCKED' ? 'locked' : ''}`}>
          <div className="reticle-ring" />
          <div className="reticle-center" />
          <div className="reticle-cross-h" />
          <div className="reticle-cross-v" />
        </div>

        {/* TARGET TELEMETRY OVERLAY */}
        <div className="hud-telemetry-overlay">
          <div className="telemetry-block">
            <span className="mono text-[10px] text-text-2">TARGET ENTITY</span>
            <span className="mono text-[12px] font-bold text-text-0">0x7F2A...3C89 [ANON]</span>
          </div>

          <div className="telemetry-block">
            <span className="mono text-[10px] text-text-2">OTC THRESHOLD</span>
            <span className="mono text-[12px] font-bold text-accent">$5,000,000.00</span>
          </div>

          <div className="telemetry-block">
            <span className="mono text-[10px] text-text-2">PROOF INTEGRITY</span>
            <span className="mono text-[12px] font-bold text-green">
              {hudState === 'LOCKED' ? '100% MATHEMATICALLY VERIFIED' : 'EVALUATING WITNESS...'}
            </span>
          </div>
        </div>
      </div>

      <div className="hud-bottom-status">
        <span className="mono text-[11px] text-text-2 flex items-center gap-6">
          <Cpu size={12} className="text-accent" />
          CIRCUIT: verify_solvency() // BN254 ZKIR // ZERO LEAKAGE
        </span>
        <span className="mono text-[11px] text-green flex items-center gap-4">
          <Check size={12} /> MIDNIGHT PREPROD READY
        </span>
      </div>
    </div>
  );
}
