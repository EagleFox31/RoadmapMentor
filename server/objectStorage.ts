import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { Storage, type File } from "@google-cloud/storage";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough, type Readable } from "node:stream";
import {
  ACL_POLICY_METADATA_KEY,
  type ObjectAclPolicy,
  ObjectPermission,
  canAccessObjectPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export type ObjectStorageProviderName = "replit" | "filesystem" | "s3";

export type ObjectUploadTarget = {
  uploadURL: string;
  objectPath: string;
  requiresAuth: boolean;
};

export type StoredObjectMetadata = {
  contentType?: string;
  size?: number | string;
};

export interface ObjectStorageAdapter {
  readonly name: ObjectStorageProviderName;
  createUploadTarget(objectId: string): Promise<ObjectUploadTarget>;
  normalizeObjectEntityPath(rawPath: string): string;
  exists(objectKey: string): Promise<boolean>;
  getMetadata(objectKey: string): Promise<StoredObjectMetadata>;
  createReadStream(objectKey: string): Readable;
  getAclPolicy(objectKey: string): Promise<ObjectAclPolicy | null>;
  setAclPolicy(objectKey: string, aclPolicy: ObjectAclPolicy): Promise<void>;
  writeDirectUpload?(
    objectId: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectOwnershipError extends Error {
  constructor() {
    super("Object belongs to another user");
    this.name = "ObjectOwnershipError";
    Object.setPrototypeOf(this, ObjectOwnershipError.prototype);
  }
}

function normalizeObjectKey(objectKey: string): string {
  const normalized = objectKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.split("/").some((part) => part === "")
  ) {
    throw new ObjectNotFoundError();
  }
  return normalized;
}

function parsePrivateObjectDir(value: string): {
  bucketName: string;
  prefix: string;
} {
  const normalized = value.startsWith("/") ? value : "/" + value;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 1) {
    throw new Error("PRIVATE_OBJECT_DIR must contain a bucket name");
  }

  return {
    bucketName: parts[0],
    prefix: parts.slice(1).join("/"),
  };
}

class ReplitObjectStorageAdapter implements ObjectStorageAdapter {
  readonly name = "replit" as const;
  private readonly client: Storage;
  private readonly bucketName: string;
  private readonly prefix: string;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    const privateObjectDir = env.PRIVATE_OBJECT_DIR?.trim();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR is required when OBJECT_STORAGE_PROVIDER=replit",
      );
    }

    const parsed = parsePrivateObjectDir(privateObjectDir);
    this.bucketName = parsed.bucketName;
    this.prefix = parsed.prefix;
    this.client = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: REPLIT_SIDECAR_ENDPOINT + "/token",
        type: "external_account",
        credential_source: {
          url: REPLIT_SIDECAR_ENDPOINT + "/credential",
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  private objectName(objectKey: string): string {
    const safeKey = normalizeObjectKey(objectKey);
    return this.prefix ? this.prefix + "/" + safeKey : safeKey;
  }

  private file(objectKey: string): File {
    return this.client
      .bucket(this.bucketName)
      .file(this.objectName(objectKey));
  }

  async createUploadTarget(objectId: string): Promise<ObjectUploadTarget> {
    const objectKey = "uploads/" + objectId;
    const uploadURL = await signReplitObjectURL({
      bucketName: this.bucketName,
      objectName: this.objectName(objectKey),
      method: "PUT",
      ttlSec: 900,
    });

    return {
      uploadURL,
      objectPath: "/objects/" + objectKey,
      requiresAuth: false,
    };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const expectedPrefix =
      "/" +
      this.bucketName +
      "/" +
      (this.prefix ? this.prefix + "/" : "");

    if (!url.pathname.startsWith(expectedPrefix)) {
      return rawPath;
    }

    const objectKey = url.pathname.slice(expectedPrefix.length);
    return "/objects/" + objectKey;
  }

  async exists(objectKey: string): Promise<boolean> {
    const [exists] = await this.file(objectKey).exists();
    return exists;
  }

  async getMetadata(objectKey: string): Promise<StoredObjectMetadata> {
    const [metadata] = await this.file(objectKey).getMetadata();
    return {
      contentType: metadata.contentType || undefined,
      size: metadata.size,
    };
  }

  createReadStream(objectKey: string): Readable {
    return this.file(objectKey).createReadStream();
  }

  async getAclPolicy(objectKey: string): Promise<ObjectAclPolicy | null> {
    const [metadata] = await this.file(objectKey).getMetadata();
    const value = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
    if (!value) {
      return null;
    }
    return JSON.parse(value as string) as ObjectAclPolicy;
  }

  async setAclPolicy(
    objectKey: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<void> {
    const file = this.file(objectKey);
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }

    const [metadata] = await file.getMetadata();
    await file.setMetadata({
      metadata: {
        ...(metadata.metadata || {}),
        [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
      },
    });
  }
}

type FilesystemMetadata = StoredObjectMetadata & {
  aclPolicy?: ObjectAclPolicy | null;
};

export class FilesystemObjectStorageAdapter implements ObjectStorageAdapter {
  readonly name = "filesystem" as const;
  private readonly root: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.root = path.resolve(
      env.OBJECT_STORAGE_LOCAL_DIR || ".data/object-storage",
    );
  }

  private objectPath(objectKey: string): string {
    const safeKey = normalizeObjectKey(objectKey);
    const resolved = path.resolve(this.root, safeKey);
    const rootPrefix = this.root.endsWith(path.sep)
      ? this.root
      : this.root + path.sep;

    if (!resolved.startsWith(rootPrefix)) {
      throw new ObjectNotFoundError();
    }

    return resolved;
  }

  private metadataPath(objectKey: string): string {
    return this.objectPath(objectKey) + ".metadata.json";
  }

  async createUploadTarget(objectId: string): Promise<ObjectUploadTarget> {
    return {
      uploadURL: "/api/objects/local-upload/" + objectId,
      objectPath: "/objects/uploads/" + objectId,
      requiresAuth: true,
    };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    const prefix = "/api/objects/local-upload/";
    if (rawPath.startsWith(prefix)) {
      return "/objects/uploads/" + rawPath.slice(prefix.length);
    }

    return rawPath;
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await stat(this.objectPath(objectKey));
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(objectKey: string): Promise<StoredObjectMetadata> {
    const fileStats = await stat(this.objectPath(objectKey));
    try {
      const metadata = JSON.parse(
        await readFile(this.metadataPath(objectKey), "utf8"),
      ) as FilesystemMetadata;
      return {
        contentType: metadata.contentType,
        size: metadata.size ?? fileStats.size,
      };
    } catch {
      return {
        contentType: "application/octet-stream",
        size: fileStats.size,
      };
    }
  }

  createReadStream(objectKey: string): Readable {
    return createReadStream(this.objectPath(objectKey));
  }

  async getAclPolicy(objectKey: string): Promise<ObjectAclPolicy | null> {
    try {
      const metadata = JSON.parse(
        await readFile(this.metadataPath(objectKey), "utf8"),
      ) as FilesystemMetadata;
      return metadata.aclPolicy || null;
    } catch {
      return null;
    }
  }

  async setAclPolicy(
    objectKey: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<void> {
    if (!(await this.exists(objectKey))) {
      throw new ObjectNotFoundError();
    }

    const metadataPath = this.metadataPath(objectKey);
    let metadata: FilesystemMetadata = {};

    try {
      metadata = JSON.parse(
        await readFile(metadataPath, "utf8"),
      ) as FilesystemMetadata;
    } catch {
      const fileStats = await stat(this.objectPath(objectKey));
      metadata = {
        contentType: "application/octet-stream",
        size: fileStats.size,
      };
    }

    await writeFile(
      metadataPath,
      JSON.stringify({ ...metadata, aclPolicy }, null, 2),
      "utf8",
    );
  }

  async writeDirectUpload(
    objectId: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
      throw new Error("Invalid object id");
    }

    const objectKey = "uploads/" + objectId;
    const targetPath = this.objectPath(objectKey);
    await mkdir(path.dirname(targetPath), { recursive: true });

    try {
      await writeFile(targetPath, body, { flag: "wx" });
    } catch (error: any) {
      if (error?.code === "EEXIST") {
        throw new Error("Object already exists");
      }
      throw error;
    }

    const metadata: FilesystemMetadata = {
      contentType,
      size: body.byteLength,
      aclPolicy: null,
    };
    await writeFile(
      this.metadataPath(objectKey),
      JSON.stringify(metadata, null, 2),
      "utf8",
    );
  }
}


const S3_ACL_METADATA_KEY = "aclpolicy";

function isS3NotFound(error: any): boolean {
  return (
    error?.name === "NotFound" ||
    error?.name === "NoSuchKey" ||
    error?.$metadata?.httpStatusCode === 404
  );
}

/**
 * S3-compatible adapter (AWS S3, Cloudflare R2, MinIO, Scaleway...).
 * Uploads go through the application route, so the bucket needs no CORS
 * configuration and stays fully private.
 */
export class S3ObjectStorageAdapter implements ObjectStorageAdapter {
  readonly name = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    client?: S3Client,
  ) {
    const bucket = env.OBJECT_STORAGE_S3_BUCKET?.trim();
    if (!bucket) {
      throw new Error(
        "OBJECT_STORAGE_S3_BUCKET is required when OBJECT_STORAGE_PROVIDER=s3",
      );
    }
    this.bucket = bucket;
    this.prefix = (env.OBJECT_STORAGE_S3_PREFIX || "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    this.client =
      client ??
      new S3Client({
        region: env.OBJECT_STORAGE_S3_REGION?.trim() || "us-east-1",
        endpoint: env.OBJECT_STORAGE_S3_ENDPOINT?.trim() || undefined,
        forcePathStyle: env.OBJECT_STORAGE_S3_FORCE_PATH_STYLE === "true",
      });
  }

  private key(objectKey: string): string {
    const safeKey = normalizeObjectKey(objectKey);
    return this.prefix ? this.prefix + "/" + safeKey : safeKey;
  }

  async createUploadTarget(objectId: string): Promise<ObjectUploadTarget> {
    return {
      uploadURL: "/api/objects/local-upload/" + objectId,
      objectPath: "/objects/uploads/" + objectId,
      requiresAuth: true,
    };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    const prefix = "/api/objects/local-upload/";
    if (rawPath.startsWith(prefix)) {
      return "/objects/uploads/" + rawPath.slice(prefix.length);
    }
    return rawPath;
  }

  private async head(objectKey: string) {
    return this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(objectKey) }),
    );
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await this.head(objectKey);
      return true;
    } catch (error) {
      if (isS3NotFound(error)) return false;
      throw error;
    }
  }

  async getMetadata(objectKey: string): Promise<StoredObjectMetadata> {
    const head = await this.head(objectKey);
    return {
      contentType: head.ContentType || undefined,
      size: head.ContentLength,
    };
  }

  createReadStream(objectKey: string): Readable {
    const out = new PassThrough();
    this.client
      .send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key(objectKey) }),
      )
      .then((res) => (res.Body as Readable).on("error", (e) => out.destroy(e)).pipe(out))
      .catch((e) => out.destroy(e));
    return out;
  }

  async getAclPolicy(objectKey: string): Promise<ObjectAclPolicy | null> {
    const head = await this.head(objectKey);
    const value = head.Metadata?.[S3_ACL_METADATA_KEY];
    return value ? (JSON.parse(value) as ObjectAclPolicy) : null;
  }

  async setAclPolicy(
    objectKey: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<void> {
    let head;
    try {
      head = await this.head(objectKey);
    } catch (error) {
      if (isS3NotFound(error)) throw new ObjectNotFoundError();
      throw error;
    }
    const key = this.key(objectKey);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: key,
        CopySource: encodeURIComponent(this.bucket + "/" + key).replace(/%2F/g, "/"),
        MetadataDirective: "REPLACE",
        ContentType: head.ContentType,
        Metadata: {
          ...(head.Metadata || {}),
          [S3_ACL_METADATA_KEY]: JSON.stringify(aclPolicy),
        },
      }),
    );
  }

  async writeDirectUpload(
    objectId: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
      throw new Error("Invalid object id");
    }
    const objectKey = "uploads/" + objectId;
    if (await this.exists(objectKey)) {
      throw new Error("Object already exists");
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(objectKey),
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}

export function resolveObjectStorageProviderName(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageProviderName {
  const configured = env.OBJECT_STORAGE_PROVIDER?.trim().toLowerCase();
  if (!configured) {
    return "replit";
  }
  if (
    configured === "replit" ||
    configured === "filesystem" ||
    configured === "s3"
  ) {
    return configured;
  }
  throw new Error(
    "OBJECT_STORAGE_PROVIDER must be 'replit', 'filesystem' or 's3'",
  );
}

export function createObjectStorageAdapter(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageAdapter {
  const provider = resolveObjectStorageProviderName(env);
  if (provider === "filesystem") return new FilesystemObjectStorageAdapter(env);
  if (provider === "s3") return new S3ObjectStorageAdapter(env);
  return new ReplitObjectStorageAdapter(env);
}

export class ObjectStorageService {
  constructor(
    private readonly adapter: ObjectStorageAdapter =
      createObjectStorageAdapter(),
  ) {}

  getProviderName(): ObjectStorageProviderName {
    return this.adapter.name;
  }

  async getObjectEntityUploadTarget(): Promise<ObjectUploadTarget> {
    return await this.adapter.createUploadTarget(randomUUID());
  }

  async writeDirectUpload(
    objectId: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (!this.adapter.writeDirectUpload) {
      throw new Error(
        "Direct application uploads are not supported by the active object storage provider",
      );
    }
    await this.adapter.writeDirectUpload(objectId, body, contentType);
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const objectKey = normalizeObjectKey(
      objectPath.slice("/objects/".length),
    );
    if (!(await this.adapter.exists(objectKey))) {
      throw new ObjectNotFoundError();
    }
    return objectKey;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    return this.adapter.normalizeObjectEntityPath(rawPath);
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/objects/")) {
      return normalizedPath;
    }

    const objectKey = await this.getObjectEntityFile(normalizedPath);

    const existingPolicy = await this.adapter.getAclPolicy(objectKey);
    if (existingPolicy && existingPolicy.owner !== aclPolicy.owner) {
      throw new ObjectOwnershipError();
    }

    await this.adapter.setAclPolicy(objectKey, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    const aclPolicy = await this.adapter.getAclPolicy(objectFile);
    return canAccessObjectPolicy({
      userId,
      aclPolicy,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async downloadObject(
    objectFile: string,
    res: Response,
    cacheTtlSec: number = 3600,
  ) {
    try {
      const metadata = await this.adapter.getMetadata(objectFile);
      const aclPolicy = await this.adapter.getAclPolicy(objectFile);
      const isPublic = aclPolicy?.visibility === "public";
      const headers: Record<string, string | number> = {
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Cache-Control":
          (isPublic ? "public" : "private") + ", max-age=" + cacheTtlSec,
      };
      if (metadata.size !== undefined) {
        headers["Content-Length"] = metadata.size;
      }
      res.set(headers);

      const stream = this.adapter.createReadStream(objectFile);
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
}

async function signReplitObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    REPLIT_SIDECAR_ENDPOINT + "/object-storage/signed-object-url",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    throw new Error(
      "Failed to sign object URL, errorcode: " +
        response.status +
        ", make sure you're running on Replit",
    );
  }

  const payload = (await response.json()) as { signed_url: string };
  return payload.signed_url;
}
