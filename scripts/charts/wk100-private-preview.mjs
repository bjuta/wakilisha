import { createHash } from 'node:crypto';
export { buildWk100PrivatePreview } from '../../supabase/functions/_shared/wk100-private-preview-core.mjs';
export function previewInputDigest(bytes) {
 if (typeof bytes !== 'string' && !(bytes instanceof Uint8Array)) throw new Error('wk100_preview_input_bytes');
 return createHash('sha256').update(bytes).digest('hex');
}
