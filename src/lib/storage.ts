import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

/**
 * File storage abstraction for uploaded documents.
 *
 * - "local" (default): writes to UPLOAD_DIR on the server's disk.
 * - "supabase": a private Supabase Storage bucket (recommended with a
 *   Supabase database, and required on serverless hosts with no disk).
 * Stored `storageKey`s are plain object keys, so existing files can be
 * copied between drivers unchanged.
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

/**
 * Supabase Storage (private bucket). Set STORAGE_DRIVER=supabase plus
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET. The service
 * key stays on the server; files are still only served through the CRM's
 * authorised download routes.
 */
const supabaseDriver: StorageDriver = {
  async put(key, data, contentType) {
    const res = await fetch(supabaseObjectUrl(key), {
      method: "POST",
      headers: { ...supabaseHeaders(), "Content-Type": contentType, "x-upsert": "false" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase upload failed (${res.status}): ${await res.text()}`);
  },
  async get(key) {
    const res = await fetch(supabaseObjectUrl(key), { headers: supabaseHeaders() });
    if (!res.ok || !res.body) throw new Error(`Supabase download failed (${res.status})`);
    return { body: res.body, size: Number(res.headers.get("content-length") ?? 0) };
  },
};

function supabaseHeaders() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return { Authorization: `Bearer ${k}`, apikey: k };
}

function supabaseObjectUrl(key: string) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const bucket = process.env.SUPABASE_BUCKET ?? "crm-documents";
  if (!base) throw new Error("SUPABASE_URL is not set");
  if (key.includes("..")) throw new Error("Invalid storage key");
  return `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const storage: StorageDriver = process.env.STORAGE_DRIVER === "supabase" ? supabaseDriver : localDriver;

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
