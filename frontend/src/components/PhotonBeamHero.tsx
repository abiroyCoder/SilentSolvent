import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Lock, Terminal, Activity, Database, Check } from 'lucide-react';

/**
 * Direct implementation inspired by pulkitxm/claude-directory (hero-sections/xero-encryption-hero)
 * Dynamic SVG photon beam connecting Private Witness (Input) -> Compact ZK Kernel (Transform) -> Verified Shield (Consensus)
 */
export default function PhotonBeamHero() {
  const pipelineRef = useRef<HTMLDivElement>(null);
  const nodeStackRef = useRef<HTMLDivElement>(null);
  const nodeXRef = useRef<HTMLDivElement>(null);
  const nodeShieldRef = useRef<HTMLDivElement>(null);
  const beamGlowRef = useRef<SVGPathElement>(null);
  const beamCoreRef = useRef<SVGPathElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    const nodeStack = nodeStackRef.current;
    const nodeX = nodeXRef.current;
    const nodeShield = nodeShieldRef.current;
    const beamGlow = beamGlowRef.current;
    const beamCore = beamCoreRef.current;
    const splash = splashRef.current;
    const gradient = gradientRef.current;

    if (!pipeline || !nodeStack || !nodeX || !nodeShield || !beamGlow || !beamCore || !splash || !gradient) {
      return;
    }

    const P1_DURATION = 900;
    const SPLASH_DURATION = 500;
    const P2_DURATION = 900;
    const IDLE_DURATION = 800;
    const HALF_WIDTH = 15;

    const computePath = () => {
      const pRect = pipeline.getBoundingClientRect();
      const sRect = nodeStack.getBoundingClientRect();
      const xRect = nodeX.getBoundingClientRect();
      const shRect = nodeShield.getBoundingClientRect();

      const startX = sRect.left + sRect.width / 2 - pRect.left;
      const startY = sRect.top + sRect.height / 2 - pRect.top;
      const midX = xRect.left + xRect.width / 2 - pRect.left;
      const midY = xRect.top + xRect.height / 2 - pRect.top;
      const endX = shRect.left + shRect.width / 2 - pRect.left;
      const endY = shRect.top + shRect.height / 2 - pRect.top;

      const d = `M ${startX},${startY} L ${midX},${midY} L ${endX},${endY}`;
      beamGlow.setAttribute('d', d);
      beamCore.setAttribute('d', d);
    };

    computePath();
    window.addEventListener('resize', computePath);

    const setGradientWindow = (percentage: number) => {
      const center = percentage * 100;
      gradient.setAttribute('x1', `${center - HALF_WIDTH}%`);
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', `${center + HALF_WIDTH}%`);
      gradient.setAttribute('y2', '0%');
    };

    type BeamState = 'p1' | 'splash' | 'p2' | 'idle';
    let state: BeamState = 'p1';
    let lastStateChange = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - lastStateChange;

      switch (state) {
        case 'p1': {
          const p = Math.min(elapsed / P1_DURATION, 1);
          setGradientWindow(p * 0.5);
          nodeStack.classList.toggle('active', p < 0.4);
          if (elapsed >= P1_DURATION) {
            nodeStack.classList.remove('active');
            state = 'splash';
            lastStateChange = now;
            beamGlow.style.opacity = '0';
            beamCore.style.opacity = '0';
            splash.classList.add('animate');
          }
          break;
        }
        case 'splash': {
          if (elapsed >= SPLASH_DURATION) {
            state = 'p2';
            lastStateChange = now;
            splash.classList.remove('animate');
            beamGlow.style.opacity = '1';
            beamCore.style.opacity = '1';
            setGradientWindow(0.5);
          }
          break;
        }
        case 'p2': {
          const p = Math.min(elapsed / P2_DURATION, 1);
          setGradientWindow(0.5 + p * 0.5);
          nodeShield.classList.toggle('active', p > 0.6);
          if (elapsed >= P2_DURATION) {
            nodeShield.classList.remove('active');
            state = 'idle';
            lastStateChange = now;
          }
          break;
        }
        case 'idle': {
          if (elapsed >= IDLE_DURATION) {
            state = 'p1';
            lastStateChange = now;
          }
          break;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', computePath);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="xero-hero-card">
      <div className="hero-grid-pattern" aria-hidden="true" />

      {/* SYSTEM RUNTIME BADGE */}
      <div className="hero-status-pill">
        <span className="hero-status-dot" />
        <span className="mono text-[11px] font-bold text-accent tracking-[0.08em]">
          MIDNIGHT NETWORK // TESTNET PREPROD // COMPACT ZK-SNARK KERNEL
        </span>
      </div>

      {/* PHOTON BEAM PIPELINE (From xero-encryption-hero) */}
      <div className="icon-pipeline" ref={pipelineRef}>
        <svg className="beam-svg" aria-hidden="true">
          <defs>
            <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient
              id="beam-gradient"
              gradientUnits="userSpaceOnUse"
              x1="-15%"
              y1="0%"
              x2="15%"
              y2="0%"
              ref={gradientRef}
            >
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset="25%" stopColor="#3b82f6" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#60a5fa" stopOpacity="1" />
              <stop offset="75%" stopColor="#22c55e" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="beam-glow">
            <path
              ref={beamGlowRef}
              stroke="url(#beam-gradient)"
              strokeWidth="4"
              fill="none"
              filter="url(#glow-filter)"
            />
          </g>
          <path
            ref={beamCoreRef}
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>

        {/* NODE 1: PRIVATE WITNESS INPUT */}
        <div className="pipeline-node-wrap">
          <div className="icon-node node-light-left" id="node-stack" ref={nodeStackRef} title="Private Fund Witness">
            <Database size={20} className="text-accent" />
          </div>
          <span className="pipeline-node-caption">PRIVATE WITNESS</span>
        </div>

        <div className="pipeline-line" />

        {/* NODE 2: COMPACT ZK TRANSFORMER WITH PARTICLE SPLASH */}
        <div className="pipeline-center">
          <div className="splash" ref={splashRef} />
          <div className="pipeline-node-wrap">
            <div className="icon-node-center" id="node-x" ref={nodeXRef} title="Compact ZK-SNARK Prover">
              <span className="mono font-extrabold text-[16px] text-accent">ZK</span>
            </div>
            <span className="pipeline-node-caption">COMPACT KERNEL</span>
          </div>
        </div>

        <div className="pipeline-line right" />

        {/* NODE 3: VERIFIED LEDGER SHIELD */}
        <div className="pipeline-node-wrap">
          <div className="icon-node node-light-right" id="node-shield" ref={nodeShieldRef} title="Verified Ledger State">
            <Shield size={20} className="text-green" />
          </div>
          <span className="pipeline-node-caption text-green">SOLVENCY ATTESTED</span>
        </div>
      </div>

      {/* HERO HEADLINE & ACTIONS */}
      <div className="hero-content">
        <h1 className="hero-heading">
          Institutional Liquidity.
          <strong>Zero Capital Exposure.</strong>
        </h1>
        <p className="hero-sub">
          Bilateral OTC block trades ($1M – $50M) mandate Proof of Funds. Sharing custody addresses doxxes treasury allocations to Arkham & MEV front-runners.
          SilentSolvent proves capitalization locally in WebAssembly via Midnight Zero-Knowledge proofs.
        </p>

        <div className="hero-actions-bar">
          <Link to="/verify" className="bracket-btn-primary">
            [ EXECUTE_SOLVENCY_PROOF ]
          </Link>
          <Link to="/explorer" className="bracket-btn-secondary">
            [ VIEW_LIVE_TELEMETRY ]
          </Link>
          <Link to="/admin" className="bracket-btn-ghost">
            [ OTC_DESK_CONTROLS ]
          </Link>
        </div>
      </div>
    </section>
  );
}
