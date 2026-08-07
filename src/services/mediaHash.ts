import { createSHA256 } from "hash-wasm";

export interface MediaHashProgress {
  processedBytes: number;
  totalBytes: number;
  progress: number;
}

export interface MediaHashOptions {
  chunkSizeBytes?: number;
  signal?: AbortSignal;
  onProgress?: (progress: MediaHashProgress) => void;
}

const DEFAULT_HASH_CHUNK_BYTES = 4 * 1024 * 1024;

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw new DOMException("Media hashing was paused.", "AbortError");
}

export async function hashBlobSha256(
  blob: Blob,
  options: MediaHashOptions = {},
): Promise<string> {
  const chunkSize = Math.max(
    256 * 1024,
    Math.floor(options.chunkSizeBytes ?? DEFAULT_HASH_CHUNK_BYTES),
  );
  const hasher = await createSHA256();
  hasher.init();
  let offset = 0;

  while (offset < blob.size) {
    throwIfAborted(options.signal);
    const end = Math.min(offset + chunkSize, blob.size);
    const chunk = new Uint8Array(
      await blob.slice(offset, end).arrayBuffer(),
    );
    throwIfAborted(options.signal);
    hasher.update(chunk);
    offset = end;
    options.onProgress?.({
      processedBytes: offset,
      totalBytes: blob.size,
      progress: blob.size > 0 ? offset / blob.size : 1,
    });
    await Promise.resolve();
  }

  throwIfAborted(options.signal);
  return hasher.digest("hex") as string;
}

export const hashFileSha256 = hashBlobSha256;
