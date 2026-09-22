const fs = require('fs');
const path = require('path');

// 1. Align contract index.js if compiled with a newer compact compiler
const contractPath = path.join(__dirname, '..', 'contracts', 'managed', 'silentsolvent', 'contract', 'index.js');
if (fs.existsSync(contractPath)) {
  let content = fs.readFileSync(contractPath, 'utf8');
  content = content.replace(/__compactRuntime\.checkRuntimeVersion\([^)]+\);/, '__compactRuntime.checkRuntimeVersion("0.16.0");');
  fs.writeFileSync(contractPath, content);
  console.log('Successfully aligned contract index.js checkRuntimeVersion to 0.16.0');
}

// 2. Patch compact-runtime circuit-context.js for cross-module wasm-bindgen ChargedState identity
const circuitContextPaths = [
  path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'circuit-context.js'),
  path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'src', 'circuit-context.ts')
];

for (const p of circuitContextPaths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    const oldCoerce = /const coerceToChargedState = \(contractState[\s\S]*?throw new CompactError[\s\S]*?\};\n?/;
    const newCoerce = `const coerceToChargedState = (contractState) => {
    if (contractState instanceof ocrt.ChargedState) {
        return contractState;
    }
    if (contractState instanceof ocrt.ContractState) {
        return contractState.data;
    }
    if (contractState instanceof ocrt.StateValue) {
        return new ocrt.ChargedState(contractState);
    }
    if (contractState && typeof contractState === 'object' && contractState.data) {
        return contractState.data;
    }
    return contractState;
};`;
    if (oldCoerce.test(content)) {
      content = content.replace(oldCoerce, newCoerce);
      fs.writeFileSync(p, content);
      console.log('Successfully patched ' + path.basename(p) + ' for ChargedState compatibility');
    }
  }
}
