/**
 * Copies every object (bytes, content type, ACL) from the filesystem provider
 * to the S3 provider. Idempotent: objects already present in the target are
 * skipped, so it can be re-run safely. The source is never modified.
 *
 * Usage: OBJECT_STORAGE_LOCAL_DIR=... OBJECT_STORAGE_S3_BUCKET=... \
 *        npm run storage:migrate [-- --dry-run]
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  FilesystemObjectStorageAdapter,
  S3ObjectStorageAdapter,
} from "../server/objectStorage";

const METADATA_SUFFIX = ".metadata.json";

async function listKeys(root: string, dir = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  const keys: string[] = [];
  for (const entry of entries) {
    const rel = dir ? dir + "/" + entry.name : entry.name;
    if (entry.isDirectory()) keys.push(...(await listKeys(root, rel)));
    else if (!entry.name.endsWith(METADATA_SUFFIX)) keys.push(rel);
  }
  return keys;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const root = path.resolve(
    process.env.OBJECT_STORAGE_LOCAL_DIR || ".data/object-storage",
  );
  const source = new FilesystemObjectStorageAdapter(process.env);
  const target = new S3ObjectStorageAdapter(process.env);

  let copied = 0;
  let skipped = 0;
  for (const key of await listKeys(root)) {
    if (!key.startsWith("uploads/")) {
      console.warn("Ignoré (hors uploads/) : " + key);
      continue;
    }
    if (await target.exists(key)) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      const body = await readFile(path.join(root, key));
      const meta = await source.getMetadata(key);
      await target.writeDirectUpload(
        key.slice("uploads/".length),
        body,
        meta.contentType || "application/octet-stream",
      );
      const acl = await source.getAclPolicy(key);
      if (acl) await target.setAclPolicy(key, acl);
    }
    copied++;
  }
  console.log(
    (dryRun ? "[dry-run] " : "") + `${copied} copié(s), ${skipped} déjà présent(s)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
