import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FilesystemObjectStorageAdapter,
  S3ObjectStorageAdapter,
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
  assert.equal(
    resolveObjectStorageProviderName({ OBJECT_STORAGE_PROVIDER: "s3" }),
    "s3",
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

function fakeS3() {
  const objects = new Map<string, { body: Buffer; type?: string; meta: Record<string, string> }>();
  const client: any = {
    async send(cmd: any) {
      const i = cmd.input;
      const name = cmd.constructor.name;
      if (name === "HeadObjectCommand") {
        const o = objects.get(i.Key);
        if (!o) throw Object.assign(new Error("nf"), { name: "NotFound" });
        return { ContentType: o.type, ContentLength: o.body.length, Metadata: o.meta };
      }
      if (name === "PutObjectCommand") {
        objects.set(i.Key, { body: i.Body, type: i.ContentType, meta: {} });
        return {};
      }
      if (name === "CopyObjectCommand") {
        const o = objects.get(i.Key)!;
        objects.set(i.Key, { ...o, type: i.ContentType, meta: i.Metadata });
        return {};
      }
      throw new Error("unexpected " + name);
    },
  };
  return { client, objects };
}

test("s3 adapter stores objects under prefix, keeps canonical paths and ACL", async () => {
  const { client, objects } = fakeS3();
  const adapter = new S3ObjectStorageAdapter(
    { OBJECT_STORAGE_S3_BUCKET: "b", OBJECT_STORAGE_S3_PREFIX: "/prod/" },
    client,
  );
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const target = await adapter.createUploadTarget(id);
  assert.equal(target.objectPath, "/objects/uploads/" + id);
  assert.equal(target.requiresAuth, true);

  await adapter.writeDirectUpload!(id, Buffer.from("x"), "image/png");
  assert.ok(objects.has("prod/uploads/" + id));
  await assert.rejects(adapter.writeDirectUpload!(id, Buffer.from("x"), "image/png"), /already exists/);

  const key = "uploads/" + id;
  assert.equal(await adapter.exists(key), true);
  assert.equal(await adapter.exists("uploads/missing"), false);
  assert.equal(await adapter.getAclPolicy(key), null);
  await adapter.setAclPolicy(key, { owner: "u1", visibility: "private" });
  assert.deepEqual(await adapter.getAclPolicy(key), { owner: "u1", visibility: "private" });
  assert.equal((await adapter.getMetadata(key)).contentType, "image/png");
  await assert.rejects(adapter.setAclPolicy("uploads/missing", { owner: "u", visibility: "private" }), /not found/i);
  assert.equal(adapter.normalizeObjectEntityPath("/api/objects/local-upload/" + id), "/objects/uploads/" + id);
});

test("s3 adapter requires a bucket", () => {
  assert.throws(() => new S3ObjectStorageAdapter({}), /OBJECT_STORAGE_S3_BUCKET/);
});
