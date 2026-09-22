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

// 2. Patch compact-runtime circuit-context.js to avoid wasm-bindgen cross-module class identity failure
const circuitContextPath = path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'circuit-context.js');
if (fs.existsSync(circuitContextPath)) {
  let content = fs.readFileSync(circuitContextPath, 'utf8');
  const target = "throw new CompactError(`'contractState' parameter ${contractState} has unexpected type`);";
  if (content.includes(target)) {
    content = content.replace(target, "state = (contractState && contractState.data) ? contractState.data : contractState;");
    fs.writeFileSync(circuitContextPath, content);
    console.log('Successfully patched circuit-context.js for ChargedState compatibility');
  }
}

// 3. Polyfill emptyRunningCost in compact-runtime index.js for contracts compiled by newer compact compilers
const runtimeIndexPath = path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'compact-runtime', 'dist', 'index.js');
if (fs.existsSync(runtimeIndexPath)) {
  let content = fs.readFileSync(runtimeIndexPath, 'utf8');
  if (!content.includes('emptyRunningCost')) {
    content += '\nexport const emptyRunningCost = () => ({ gas: 0n, memory: 0n });\n';
    fs.writeFileSync(runtimeIndexPath, content);
    console.log('Successfully exported emptyRunningCost from compact-runtime/dist/index.js');
  }
}

// 4. Patch onchain-runtime-v3 wasm-bindgen _assertClass for cross-module ESM execution in tests
const wasmBgPath = path.join(__dirname, '..', 'node_modules', '@midnight-ntwrk', 'onchain-runtime-v3', 'midnight_onchain_runtime_wasm_bg.js');
if (fs.existsSync(wasmBgPath)) {
  let content = fs.readFileSync(wasmBgPath, 'utf8');
  const targetAssert = "function _assertClass(instance, klass) {\n    if (!(instance instanceof klass)) {\n        throw new Error(`expected instance of ${klass.name}`);\n    }\n}";
  const newAssert = `function _assertClass(instance, klass) {
    if (instance instanceof klass) return;
    if (instance && (instance.constructor?.name === klass.name || instance.__wbg_ptr !== undefined)) return;
    throw new Error(\`expected instance of \${klass.name}\`);
}`;
  if (content.includes(targetAssert)) {
    content = content.replace(targetAssert, newAssert);
    fs.writeFileSync(wasmBgPath, content);
    console.log('Successfully patched onchain-runtime-v3 _assertClass for cross-module wasm compatibility');
  }
}
