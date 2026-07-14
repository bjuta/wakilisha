import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_REPORT_DIR } from './config.js';
import { generateSeedSql } from './db.js';

const reportDir = process.env.WAKILISHA_REPORT_DIR ?? DEFAULT_REPORT_DIR;
const outputDir = process.env.WAKILISHA_SEED_DIR ?? path.join(process.cwd(), 'archive', 'legacy-migrations', 'generated');

function copyIfBetter(sourceFile: string, targetFile: string): void {
  const sourcePath = path.join(reportDir, sourceFile);
  const targetPath = path.join(reportDir, targetFile);

  if (!fs.existsSync(sourcePath)) return;

  const sourceRows = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as unknown[];
  let targetRows: unknown[] = [];

  if (fs.existsSync(targetPath)) {
    targetRows = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as unknown[];
  }

  if (sourceRows.length > targetRows.length) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Using ${sourceFile} for ${targetFile} (${sourceRows.length} rows).`);
  }
}

copyIfBetter('entity-slugs.seed.json', 'entity-slugs.full.json');
copyIfBetter('entity-relationships.seed.json', 'entity-relationships.full.json');
copyIfBetter('relationship-review-queue.json', 'relationship-review-queue.full.json');

const seedPath = generateSeedSql(reportDir, outputDir);
console.log(`Usable seed SQL generated: ${seedPath}`);
