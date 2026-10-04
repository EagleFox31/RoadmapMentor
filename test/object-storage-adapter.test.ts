import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FilesystemObjectStorageAdapter,
  resolveObjectStorageProviderName,
} from "../server/objectStorage";

test("storage provider is selected from configuration", () => {
  assert.equal(
    resolveObjectStorageProviderName({ OBJECT_STORAGE_PROVIDER: "filesystem" }),
    "filesystem",
  );
  assert.equal(
    resolveObjectStorageProviderName({ OBJECT_STORAGE_PROVIDER: "replit" }),
    "replit",
  );
  assert.equal(resolveObjectStorageProviderName({}), "replit");
  assert.throws(
    () =>
      resolveObjectStorageProviderName({
        OBJECT_STORAGE_PROVIDER: "unknown",
      }),
    /OBJECT_STORAGE_PROVIDER/,
  );
});

test("filesystem adapter stores bytes metadata and ACL without Replit", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "roadmapmentor-storage-"));
  try {
    const adapter = new FilesystemObjectStorageAdapter({
      OBJECT_STORAGE_LOCAL_DIR: root,
    });

    const target = await adapter.createUploadTarget(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    assert.equal(target.requiresAuth, true);
    assert.equal(
      target.objectPath,
      "/objects/uploads/123e4567-e89b-12d3-a456-426614174000",
    );

    await adapter.writeDirectUpload!(
      "123e4567-e89b-12d3-a456-426614174000",
      Buffer.from("fake-image-bytes"),
      "image/png",
    );

    const key = "uploads/123e4567-e89b-12d3-a456-426614174000";
    assert.equal(await adapter.exists(key), true);

    const metadata = await adapter.getMetadata(key);
    assert.equal(metadata.contentType, "image/png");
    assert.equal(Number(metadata.size), Buffer.byteLength("fake-image-bytes"));

    assert.equal(await adapter.getAclPolicy(key), null);
    await adapter.setAclPolicy(key, {
      owner: "99",
      visibility: "private",
    });
    assert.deepEqual(await adapter.getAclPolicy(key), {
      owner: "99",
      visibility: "private",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
