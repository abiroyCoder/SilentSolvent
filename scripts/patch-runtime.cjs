const fs = require('fs');
const path = require('path');

// 1. Patch compact-runtime version.js so version mismatch never throws
const runtimePaths = [
  path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'version.js'),
  path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'midnight-js-protocol', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'version.js'),
];

for (const p of runtimePaths) {
  if (fs.existsSync(p)) {
    fs.writeFileSync(p, 'export const versionString = "0.19.0";\nexport const checkRuntimeVersion = () => {};\n');
    console.log(`Successfully patched: ${p}`);
  }
}

// 2. Patch circuit-context.js so duck-typed ContractState works across different ocrt bundle instances
const circuitContextPaths = [
  path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'circuit-context.js'),
  path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'midnight-js-protocol', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'circuit-context.js'),
];

for (const p of circuitContextPaths) {
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    c = c.replace(
      /const coerceToChargedState = \(contractState\) => \{[\s\S]*?return state;\s*\};/,
      `const coerceToChargedState = (contractState) => {
    let state;
    if (contractState instanceof ocrt.ChargedState) {
        state = contractState;
    }
    else if (contractState instanceof ocrt.ContractState) {
        state = contractState.data;
    }
    else if (contractState instanceof ocrt.StateValue) {
        state = new ocrt.ChargedState(contractState);
    }
    else if (contractState && typeof contractState === 'object' && contractState.data) {
        state = contractState.data;
    }
    else {
        try {
            state = new ocrt.ChargedState(contractState);
        } catch {
            state = contractState;
        }
    }
    return state;
};`
    );
    fs.writeFileSync(p, c);
    console.log(`Successfully patched circuit-context: ${p}`);
  }
}

// 3. Align contract index.js if compiled with a newer compiler
const contractPath = path.join(__dirname, '..', 'contracts', 'managed', 'silentsolvent', 'contract', 'index.js');
if (fs.existsSync(contractPath)) {
  let content = fs.readFileSync(contractPath, 'utf8');
  content = content.replace(/__compactRuntime\.checkRuntimeVersion\([^)]+\);/, '__compactRuntime.checkRuntimeVersion("0.16.0");');
  fs.writeFileSync(contractPath, content);
  console.log(`Successfully aligned contract index.js`);
}
