const fs = require('fs');
const path = require('path');

// Align contract index.js if compiled with a newer compact compiler
const contractPath = path.join(__dirname, '..', 'contracts', 'managed', 'silentsolvent', 'contract', 'index.js');
if (fs.existsSync(contractPath)) {
  let content = fs.readFileSync(contractPath, 'utf8');
  content = content.replace(/__compactRuntime\.checkRuntimeVersion\([^)]+\);/, '__compactRuntime.checkRuntimeVersion("0.16.0");');
  fs.writeFileSync(contractPath, content);
  console.log('Successfully aligned contract index.js checkRuntimeVersion to 0.16.0');
}
