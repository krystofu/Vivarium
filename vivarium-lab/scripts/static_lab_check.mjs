import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'vivarium-lab');

const requiredFiles = [
  'README.md',
  'ARCHITECTURE.md',
  'PHONE_FIRST.md',
  'config/lab.manifest.json',
  'evals/character/astra-certification.v1.json',
  'schemas/character-eval-result.schema.json',
  'schemas/plugin-eval-result.schema.json',
  'schemas/visual-dna-pack.schema.json',
  'weave/WEAVE_CONTRACT_v0.1.md'
];

const failures = [];
const warnings = [];
const parsedJson = {};

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    continue;
  }
  const stat = fs.statSync(full);
  if (!stat.isFile() || stat.size === 0) failures.push(`Required file is empty or invalid: ${rel}`);
}

for (const rel of requiredFiles.filter((file) => file.endsWith('.json'))) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  try {
    parsedJson[rel] = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    failures.push(`Invalid JSON in ${rel}: ${error.message}`);
  }
}

const manifest = parsedJson['config/lab.manifest.json'];
if (manifest) {
  if (manifest.lab?.phone_first !== true) failures.push('Manifest must keep phone_first=true.');
  if (manifest.integrations?.openrouter?.secret !== 'OPENROUTER_API_KEY') {
    failures.push('OpenRouter integration must reference OPENROUTER_API_KEY rather than a literal key.');
  }
  const serialized = JSON.stringify(manifest);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized)) failures.push('Manifest appears to contain a literal API key.');
}

const suite = parsedJson['evals/character/astra-certification.v1.json'];
if (suite) {
  if (!Array.isArray(suite.trials) || suite.trials.length !== 15) {
    failures.push('ASTRA certification suite must contain exactly 15 bootstrap trials.');
  }
  const requiredDimensions = ['identity_fidelity', 'user_agency', 'consent_boundary_handling'];
  for (const dim of requiredDimensions) {
    if (!suite.dimensions?.includes(dim)) failures.push(`ASTRA suite missing protected dimension: ${dim}`);
  }
  if (suite.thresholds?.live_candidate_average !== 2.4) warnings.push('ASTRA live-candidate threshold differs from current Foundry guidance.');
  if (suite.thresholds?.live_certified_average !== 2.7) warnings.push('ASTRA live-certified threshold differs from current Foundry guidance.');
}

for (const [rel, json] of Object.entries(parsedJson)) {
  if (rel.startsWith('schemas/') && !json.$schema) failures.push(`${rel} is missing $schema.`);
  if (rel.startsWith('schemas/') && !json.title) failures.push(`${rel} is missing title.`);
}

const result = {
  ok: failures.length === 0,
  root,
  checked_files: requiredFiles.length,
  failures,
  warnings
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
