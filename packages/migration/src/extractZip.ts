import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';

const DEFAULT_DRIVE_URL =
  'https://drive.google.com/file/d/13JlPAmlYUm-yl9kYtYqIYuykprX267YR/view?usp=drive_link';

const DEFAULT_TARGET_DIR = path.join(
  process.cwd(),
  'data',
  'supabase-imports',
  '2026-05-30'
);

const DEFAULT_CACHE_DIR = path.join(process.cwd(), '.tmp');
const DEFAULT_ZIP_PATH = path.join(DEFAULT_CACHE_DIR, 'wakilisha_supabase_import_2026-05-30.zip');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function parseGoogleDriveFileId(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('id');
  } catch {
    return null;
  }
}

function toGoogleDriveDownloadUrl(url: string): string {
  const fileId = parseGoogleDriveFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function extractConfirmUrl(html: string, originalDownloadUrl: string): string | null {
  const confirmMatch = html.match(/confirm=([0-9A-Za-z_\-]+)/);
  const uuidMatch = html.match(/uuid=([0-9A-Za-z_\-]+)/);
  const fileId = parseGoogleDriveFileId(originalDownloadUrl) ?? new URL(originalDownloadUrl).searchParams.get('id');

  if (!confirmMatch?.[1] || !fileId) return null;

  const url = new URL('https://drive.google.com/uc');
  url.searchParams.set('export', 'download');
  url.searchParams.set('id', fileId);
  url.searchParams.set('confirm', confirmMatch[1]);
  if (uuidMatch?.[1]) url.searchParams.set('uuid', uuidMatch[1]);
  return url.toString();
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  ensureDir(path.dirname(outputPath));

  const downloadUrl = toGoogleDriveDownloadUrl(url);
  const firstResponse = await fetch(downloadUrl, { redirect: 'follow' });

  if (!firstResponse.ok) {
    throw new Error(`Download failed: ${firstResponse.status} ${firstResponse.statusText}`);
  }

  const contentType = firstResponse.headers.get('content-type') ?? '';

  if (contentType.includes('text/html')) {
    const html = await firstResponse.text();
    const confirmUrl = extractConfirmUrl(html, downloadUrl);

    if (!confirmUrl) {
      throw new Error(
        'Google Drive returned an HTML page instead of the zip. Make sure the file permission is set to "Anyone with the link can view".'
      );
    }

    const secondResponse = await fetch(confirmUrl, { redirect: 'follow' });
    if (!secondResponse.ok || !secondResponse.body) {
      throw new Error(`Confirmed download failed: ${secondResponse.status} ${secondResponse.statusText}`);
    }

    await pipeline(secondResponse.body as unknown as NodeJS.ReadableStream, fs.createWriteStream(outputPath));
    return;
  }

  if (!firstResponse.body) {
    throw new Error('Download response had no body.');
  }

  await pipeline(firstResponse.body as unknown as NodeJS.ReadableStream, fs.createWriteStream(outputPath));
}

async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip file not found: ${zipPath}`);
  }

  ensureDir(targetDir);

  await fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: targetDir }))
    .promise();
}

function findRawDir(targetDir: string): string | null {
  const direct = path.join(targetDir, 'raw');
  if (fs.existsSync(direct)) return direct;

  const nested = path.join(targetDir, 'data', 'supabase-imports', '2026-05-30', 'raw');
  if (fs.existsSync(nested)) return nested;

  return null;
}

async function main(): Promise<void> {
  const sourceUrl = process.env.WAKILISHA_IMPORT_ZIP_URL ?? DEFAULT_DRIVE_URL;
  const zipPath = process.env.WAKILISHA_IMPORT_ZIP_PATH ?? DEFAULT_ZIP_PATH;
  const targetDir = process.env.WAKILISHA_IMPORT_TARGET_DIR ?? DEFAULT_TARGET_DIR;
  const skipDownload = process.env.WAKILISHA_SKIP_DOWNLOAD === '1';

  console.log(`Target directory: ${targetDir}`);

  if (!skipDownload) {
    console.log(`Downloading import zip from: ${sourceUrl}`);
    await downloadFile(sourceUrl, zipPath);
    console.log(`Downloaded zip to: ${zipPath}`);
  } else {
    console.log(`Skipping download. Using local zip: ${zipPath}`);
  }

  console.log('Extracting zip...');
  await extractZip(zipPath, targetDir);

  const rawDir = findRawDir(targetDir);
  if (!rawDir) {
    throw new Error(
      `Extraction completed, but no raw/ CSV folder was found under ${targetDir}. Check zip structure.`
    );
  }

  const csvCount = fs.readdirSync(rawDir).filter((file) => file.toLowerCase().endsWith('.csv')).length;
  console.log(`CSV extraction complete. Found ${csvCount} CSV files in: ${rawDir}`);
  console.log('Next: run npm run migration:audit');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
