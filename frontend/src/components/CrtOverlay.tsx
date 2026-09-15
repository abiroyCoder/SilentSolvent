import React from 'react';

/**
 * Direct implementation from pulkitxm/claude-directory (components-ui/terminal-cli-control-deck)
 * CRT overlay with scanlines, travelling bright sweep, and corner vignette.
 */
export default function CrtOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {/* Static scanlines */}
      <div
        className="crt-scanlines absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)',
        }}
      />
      {/* Travelling bright sweep */}
      <div className="crt-sweep absolute inset-x-0 h-24" />
      {/* Corner vignette */}
      <div
        className="crt-vignette absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 50%, transparent 65%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
}
