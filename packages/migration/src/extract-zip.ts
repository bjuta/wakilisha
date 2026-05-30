import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ZIP_URL = 'https://storage.readdy-site.link/project_files/d0ae344a-1996-4233-9b59-53c8c2189ac8/cc10a676-788f-417c-82ef-6c35fd6bffcb_wakilisha_supabase_import_2026-05-30.zip?v=4b1e21fc25f31493758e2b52cd0bd2cd';
const OUTPUT_DIR = new URL('../../../data/supabase-imports/2026-05-30/raw/', import.meta.url).pathname;

async function downloadAndExtract() {
  console.log('Creating output directory...');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Downloading zip...');
  console.log('URL:', ZIP_URL);

  await new Promise((resolve, reject) => {
    get(ZIP_URL, { timeout: 300000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log('Following redirect to:', response.headers.location);
        get(response.headers.location, { timeout: 300000 }, (redirectResponse) => {
          handleResponse(redirectResponse, resolve, reject);
        }).on('error', reject);
      } else {
        handleResponse(response, resolve, reject);
      }
    }).on('error', reject);
  });

  console.log('Extraction complete! Files placed in:', OUTPUT_DIR);
}

function handleResponse(response, resolve, reject) {
  if (response.statusCode !== 200) {
    reject(new Error(`Download failed with status ${response.statusCode}`));
    return;
  }

  const totalSize = parseInt(response.headers['content-length'] || '0', 10);
  let downloaded = 0;
  let lastLogged = 0;

  response.on('data', (chunk) => {
    downloaded += chunk.length;
    if (totalSize && downloaded - lastLogged > 10 * 1024 * 1024) {
      const percent = ((downloaded / totalSize) * 100).toFixed(1);
      console.log(`Downloaded: ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB (${percent}%)`);
      lastLogged = downloaded;
    }
  });

  console.log('Extracting CSVs...');
  
  pipeline(
    response,
    unzipper.Parse()
  ).then(async (parsed) => {
    for await (const entry of parsed) {
      const fileName = entry.path;
      
      if (fileName.endsWith('.csv')) {
        const outputPath = new URL(fileName, `file://${OUTPUT_DIR}/`).pathname;
        console.log('Extracting:', fileName);
        await pipeline(entry, createWriteStream(outputPath));
      } else {
        entry.autodrain();
      }
    }
    resolve();
  }).catch(reject);
}

downloadAndExtract().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});