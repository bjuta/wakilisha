import fs from 'node:fs';
import path from 'node:path';
import unzipper from 'unzipper';

const ZIP_NAME = 'wakilisha_supabase_import_2026-05-30.zip';
const ROOT_DIR = process.cwd();
const ZIP_PATH = path.join(ROOT_DIR, ZIP_NAME);
const EXTRACT_DIR = path.join(ROOT_DIR, 'data', 'supabase-imports', '2026-05-30', 'raw');

async function main() {
  if (!fs.existsSync(ZIP_PATH)) {
    console.error(`Zip file not found: ${ZIP_PATH}`);
    console.error(`Please upload "${ZIP_NAME}" to the repo root and run this script again.`);
    process.exit(1);
  }

  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  console.log(`Extracting ${ZIP_PATH} -> ${EXTRACT_DIR}`);

  const entries: string[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(ZIP_PATH)
      .pipe(unzipper.Parse())
      .on('entry', function (entry) {
        const fileName = entry.path;
        const entryPath = path.join(EXTRACT_DIR, fileName);
        if (fileName.endsWith('/')) {
          fs.mkdirSync(entryPath, { recursive: true });
          entry.autodrain();
        } else {
          fs.mkdirSync(path.dirname(entryPath), { recursive: true });
          entry.pipe(fs.createWriteStream(entryPath)).on('finish', () => {
            entries.push(fileName);
          });
        }
      })
      .on('close', resolve)
      .on('error', reject);
  });

  console.log(`Extracted ${entries.length} entries.`);
  console.log('CSV files found:');
  const csvs = entries.filter((e) => e.toLowerCase().endsWith('.csv'));
  csvs.forEach((csv) => console.log(`  - ${csv}`));
  console.log('');
  console.log('Next steps:');
  console.log('  1. npm install');
  console.log('  2. npm run legacy:migration:audit');
  console.log('  3. npm run legacy:migration:graph');
  console.log('  4. npm run legacy:migration:repair');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});