// composables/useImageUpload.ts
//
// uploadImageToS3 was the last Nuxt reference in the entire
// package (useNuxtApp → $api → S3 presigned URL). Replaced with the
// storage adapter's uploadImage(file). validateImageFile, the
// instant-preview/cleanup flow, and swapOnLoad's SVG-onload workaround are
// all unchanged — none of that logic was ever Nuxt-specific.
import { useStorageAdapter } from "@/adapters";

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = [
 "image/jpeg",
 "image/png",
 "image/webp",
 "image/gif",
 "image/svg+xml",
];

export interface UploadResult {
 previewUrl: string; // ObjectURL (blob) — immediate preview
 permanentUrl: string; // adapter-returned URL — swap in after upload
 cleanup: () => void; // call this to revoke the ObjectURL
}

export class ImageUploadError extends Error {
 constructor(message: string) {
 super(message);
 this.name = "ImageUploadError";
 }
}

export function validateImageFile(file: File): void {
 if (!ALLOWED_TYPES.includes(file.type)) {
 throw new ImageUploadError(
 `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF.`,
 );
 }
 const sizeMB = file.size / (1024 * 1024);
 if (sizeMB > MAX_FILE_SIZE_MB) {
 throw new ImageUploadError(
 `File too large: ${sizeMB.toFixed(1)}MB. Maximum allowed: ${MAX_FILE_SIZE_MB}MB.`,
 );
 }
}

export function swapOnLoad(
 permanentUrl: string,
 onReady: () => void,
 cleanup: () => void,
): void {
 // SVGs served from a remote URL don't reliably fire img.onload — swap
 // immediately. Also true for base64 data URLs (the local adapter's
 // default), which is why this check stays as-is rather than narrowing it.
 if (
 permanentUrl.match(/\.svg(\?|$)/i) ||
 permanentUrl.includes("image/svg")
 ) {
 onReady();
 cleanup();
 return;
 }

 const img = new Image();
 img.onload = () => {
 onReady();
 cleanup();
 };
 img.onerror = () => cleanup();
 img.src = permanentUrl;
}

/**
 * Called from within a component's setup — useStorageAdapter() requires
 * that timing, which is why this is a composable rather than a plain
 * export like the three functions above (none of which need injection).
 *
 * Returns handleImageUploadFlow pre-bound to the active adapter, so call
 * sites keep the exact same 4-argument call shape they always had.
 */
export function useImageUploader() {
 const adapter = useStorageAdapter();

 /**
 * Full flow: instant preview → upload → swap → cleanup
 *
 * @param file The File from the input event
 * @param onPreview Called immediately with the blob ObjectURL for instant display
 * @param onSuccess Called with the permanent URL once the upload finishes
 * @param onError Called with a human-readable error message
 */
 async function handleImageUploadFlow(
 file: File,
 onPreview: (objectUrl: string) => void,
 onSuccess: (permanentUrl: string, cleanup: () => void) => void,
 onError: (message: string) => void,
 ): Promise<void> {
 const objectUrl = URL.createObjectURL(file);
 onPreview(objectUrl);

 try {
 validateImageFile(file);
 const permanentUrl = await adapter.uploadImage(file);
 // Hand cleanup to the caller — they revoke AFTER the new image loads
 onSuccess(permanentUrl, () => URL.revokeObjectURL(objectUrl));
 } catch (err) {
 const message =
 err instanceof ImageUploadError
 ? err.message
 : "Upload failed. Please try again.";
 URL.revokeObjectURL(objectUrl); // safe to revoke immediately on error
 onError(message);
 }
 // No finally — caller controls revocation timing
 }

 return { handleImageUploadFlow, swapOnLoad, validateImageFile };
}
