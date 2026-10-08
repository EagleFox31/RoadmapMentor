import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ObjectPermission } from "../server/objectAcl";
import {
  FilesystemObjectStorageAdapter,
  S3ObjectStorageAdapter,
  ObjectStorageService,
  ObjectOwnershipError,
  ObjectAlreadyExistsError,
  type ObjectStorageAdapter,
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
      { owner: "99", visibility: "private" },
    );

    const key = "uploads/123e4567-e89b-12d3-a456-426614174000";
    assert.equal(await adapter.exists(key), true);

    const metadata = await adapter.getMetadata(key);
    assert.equal(metadata.contentType, "image/png");
    assert.equal(Number(metadata.size), Buffer.byteLength("fake-image-bytes"));

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
        if (i.IfNoneMatch !== "*") throw new Error("upload must use If-None-Match *");
        if (objects.has(i.Key)) {
          throw Object.assign(new Error("precondition failed"), {
            name: "PreconditionFailed", $metadata: { httpStatusCode: 412 },
          });
        }
        objects.set(i.Key, { body: i.Body, type: i.ContentType, meta: i.Metadata ?? {} });
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

  await adapter.writeDirectUpload!(id, Buffer.from("x"), "image/png", { owner: "u1", visibility: "private" });
  assert.ok(objects.has("prod/uploads/" + id));
  await assert.rejects(adapter.writeDirectUpload!(id, Buffer.from("changed"), "image/png", { owner: "u2", visibility: "private" }), ObjectAlreadyExistsError);
  assert.equal(objects.get("prod/uploads/" + id)?.body.toString(), "x");

  const key = "uploads/" + id;
  assert.equal(await adapter.exists(key), true);
  assert.equal(await adapter.exists("uploads/missing"), false);
  assert.deepEqual(await adapter.getAclPolicy(key), { owner: "u1", visibility: "private" });
  assert.deepEqual(await adapter.getAclPolicy(key), { owner: "u1", visibility: "private" });
  assert.equal((await adapter.getMetadata(key)).contentType, "image/png");
  await assert.rejects(adapter.setAclPolicy("uploads/missing", { owner: "u", visibility: "private" }), /not found/i);
  assert.equal(adapter.normalizeObjectEntityPath("/api/objects/local-upload/" + id), "/objects/uploads/" + id);
});

test("s3 adapter requires a bucket", () => {
  assert.throws(() => new S3ObjectStorageAdapter({}), /OBJECT_STORAGE_S3_BUCKET/);
});

test("direct upload is supported for filesystem and S3, not for legacy indirect uploads", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "roadmapmentor-direct-"));
  try {
    const local = new ObjectStorageService(new FilesystemObjectStorageAdapter({
      OBJECT_STORAGE_LOCAL_DIR: root,
    }));
    const { client } = fakeS3();
    const remote = new ObjectStorageService(new S3ObjectStorageAdapter(
      { OBJECT_STORAGE_S3_BUCKET: "test-bucket" }, client,
    ));
    const indirect = new ObjectStorageService({ name: "replit" } as ObjectStorageAdapter);

    assert.equal(local.supportsDirectUpload(), true);
    assert.equal(remote.supportsDirectUpload(), true);
    assert.equal(indirect.supportsDirectUpload(), false);
    await assert.rejects(indirect.writeDirectUpload("ignored", Buffer.from("x"), "image/png", { owner: "u1", visibility: "private" }), /not supported/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("S3 upload target, upload bytes, private ACL and owner enforcement work together", async () => {
  const { client, objects } = fakeS3();
  const storage = new ObjectStorageService(new S3ObjectStorageAdapter(
    { OBJECT_STORAGE_S3_BUCKET: "bucket", OBJECT_STORAGE_S3_PREFIX: "prod" }, client,
  ));

  const { uploadURL, objectPath, requiresAuth } = await storage.getObjectEntityUploadTarget();
  assert.equal(requiresAuth, true);
  assert.match(uploadURL, /^\/api\/objects\/local-upload\/[0-9a-f-]{36}$/);
  const objectId = uploadURL.split("/").at(-1)!;
  assert.equal(objectPath, "/objects/uploads/" + objectId);

  await storage.writeDirectUpload(objectId, Buffer.from("image-data"), "image/png", { owner: "learner-1", visibility: "private" });
  assert.equal(objects.get("prod/uploads/" + objectId)?.body.toString(), "image-data");

  await storage.trySetObjectEntityAclPolicy(objectPath, { owner: "learner-1", visibility: "private" });
  const objectKey = await storage.getObjectEntityFile(objectPath);
  assert.equal(await storage.canAccessObjectEntity({
    objectFile: objectKey, userId: "learner-1", requestedPermission: ObjectPermission.READ,
  }), true);
  assert.equal(await storage.canAccessObjectEntity({
    objectFile: objectKey, userId: "learner-2", requestedPermission: ObjectPermission.READ,
  }), false);

  await assert.rejects(
    storage.trySetObjectEntityAclPolicy(objectPath, { owner: "learner-2", visibility: "public" }),
    ObjectOwnershipError,
  );
  assert.equal(await storage.canAccessObjectEntity({
    objectFile: objectKey, userId: "anonymous", requestedPermission: ObjectPermission.READ,
  }), false);
});

test("S3 concurrent writes are first-writer-wins and never lose private owner metadata", async () => {
  const { client, objects } = fakeS3();
  const adapter = new S3ObjectStorageAdapter({ OBJECT_STORAGE_S3_BUCKET: "bucket" }, client);
  const id = "123e4567-e89b-42d3-a456-426614174012";
  const requests = await Promise.allSettled([
    adapter.writeDirectUpload!(id, Buffer.from("alice"), "image/png", { owner: "alice", visibility: "private" }),
    adapter.writeDirectUpload!(id, Buffer.from("bob"), "image/png", { owner: "bob", visibility: "private" }),
  ]);
  assert.equal(requests.filter(x => x.status === "fulfilled").length, 1);
  const rejected = requests.find(x => x.status === "rejected") as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof ObjectAlreadyExistsError);
  const stored = objects.get("uploads/" + id)!;
  const content = stored.body.toString();
  assert.ok(content === "alice" || content === "bob");
  assert.deepEqual(await adapter.getAclPolicy("uploads/" + id), {
    owner: content, visibility: "private",
  });
});

test("an S3 upload without ownership cannot be adopted on progress submission", async () => {
  const { client, objects } = fakeS3();
  const id = "123e4567-e89b-42d3-a456-426614174013";
  objects.set("uploads/" + id, { body: Buffer.from("old"), type: "image/png", meta: {} });
  const service = new ObjectStorageService(new S3ObjectStorageAdapter({ OBJECT_STORAGE_S3_BUCKET: "bucket" }, client));
  await assert.rejects(
    service.trySetObjectEntityAclPolicy("/objects/uploads/" + id, { owner: "other", visibility: "private" }),
    ObjectOwnershipError,
  );
});

test("filesystem direct uploads persist private owner and refuse second write", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "roadmapmentor-safe-direct-"));
  try {
    const service = new ObjectStorageService(new FilesystemObjectStorageAdapter({ OBJECT_STORAGE_LOCAL_DIR: root }));
    const id = "123e4567-e89b-42d3-a456-426614174014";
    await service.writeDirectUpload(id, Buffer.from("original"), "image/png", { owner: "alice", visibility: "private" });
    await assert.rejects(
      service.writeDirectUpload(id, Buffer.from("tamper"), "image/png", { owner: "bob", visibility: "private" }),
      ObjectAlreadyExistsError,
    );
    const key = await service.getObjectEntityFile("/objects/uploads/" + id);
    assert.equal(await service.getObjectOwner(key), "alice");
    assert.equal((await readFile(path.join(root, "uploads", id))).toString(), "original");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
