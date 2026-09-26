import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

/**
 * File storage abstraction for uploaded documents.
 *
 * The default "local" driver writes to UPLOAD_DIR on the server's disk, which
 * is the simplest reliable option for a single-server deployment (back the
 * directory up alongside the database). To move to S3 / GCS / Azure later,
 * implement `StorageDriver` for that provider and select it via
 * STORAGE_DRIVER; stored `storageKey`s stay valid as object keys.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; size: number }>;
}

const root = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

function safePath(key: string) {
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

const localDriver: StorageDriver = {
  async put(key, data) {
    const full = safePath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" }); // never overwrite an existing file
  },
  async get(key) {
    const full = safePath(key);
    const { size } = await stat(full);
    return { body: Readable.toWeb(createReadStream(full)) as ReadableStream, size };
  },
};

export const storage: StorageDriver = localDriver;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // DRHP drafts and financial models can be large
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
export const UPLOAD_ACCEPT = Object.keys(ALLOWED_MIME_TYPES).join(",");

/** Builds a unique, non-guessable key; the original filename is kept only in the DB. */
export function makeStorageKey(prefix: string, mimeType: string) {
  return `${prefix}/${randomUUID()}.${ALLOWED_MIME_TYPES[mimeType] ?? "bin"}`;
}
