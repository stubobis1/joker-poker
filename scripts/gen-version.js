import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const hash = execSync('git rev-parse --short HEAD').toString().trim();
writeFileSync(new URL('../client/version.js', import.meta.url), `export const COMMIT_HASH = '${hash}';\n`);
console.log(`version.js → ${hash}`);
