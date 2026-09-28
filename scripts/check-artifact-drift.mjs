import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('contracts/managed/silentsolvent');
const copies = [
  { dir: path.resolve('frontend/public/managed'), sourcePrefix: '' },
  { dir: path.resolve('frontend/src/managed/contract'), sourcePrefix: 'contract' },
];
const compilerInfo = JSON.parse(fs.readFileSync(path.join(root, 'compiler/contract-info.json'), 'utf8'));
const expectedCompiler = process.env.COMPACTC_VERSION ?? '0.31.1';
if (compilerInfo['compiler-version'] !== expectedCompiler) {
  throw new Error(`Generated artifacts use compiler ${compilerInfo['compiler-version']}; expected ${expectedCompiler}`);
}

function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(dir, entry.name), rel) : [rel];
  });
}
function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const expected = files(root);
for (const copy of copies) {
  const relevant = copy.sourcePrefix ? expected.filter((rel) => rel.startsWith(`${copy.sourcePrefix}${path.sep}`)) : expected;
  for (const rel of relevant) {
    const source = path.join(root, rel);
    const targetRel = copy.sourcePrefix ? rel.slice(copy.sourcePrefix.length + 1) : rel;
    const target = path.join(copy.dir, targetRel);
    if (!fs.existsSync(target)) throw new Error(`Missing generated artifact: ${path.relative(process.cwd(), target)}`);
    if (digest(source) !== digest(target)) {
      throw new Error(`Generated artifact drift: ${path.relative(process.cwd(), source)} != ${path.relative(process.cwd(), target)}`);
    }
  }
}
console.log(`Generated artifact check passed (${expected.length} files, compiler ${compilerInfo['compiler-version']}).`);
