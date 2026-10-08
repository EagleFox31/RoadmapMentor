import jwt from "jsonwebtoken";
import { resolveJwtSecret } from "../security";

const PURPOSE = "object-upload";
const AUDIENCE = "roadmapmentor-object-upload";
const ISSUER = "roadmapmentor";
const OBJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ten-minute user-bound capability for an application-proxied upload.
 * Authorization still requires the normal bearer token and a live user.
 * Sent as a request header, not a query parameter, to keep it out of URLs/logs.
 */
export function issueObjectUploadTicket(objectId: string, userId: number): string {
  if (!OBJECT_ID.test(objectId) || !Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid object upload ticket parameters");
  }
  return jwt.sign(
    { purpose: PURPOSE, objectId, userId },
    resolveJwtSecret(),
    { expiresIn: "10m", audience: AUDIENCE, issuer: ISSUER },
  );
}

export function verifyObjectUploadTicket(
  token: unknown,
  objectId: string,
  userId: number,
): boolean {
  if (typeof token !== "string" || !OBJECT_ID.test(objectId)) {
    return false;
  }
  try {
    const claims = jwt.verify(token, resolveJwtSecret(), {
      audience: AUDIENCE, issuer: ISSUER,
    });
    return typeof claims !== "string" &&
      claims.purpose === PURPOSE &&
      claims.objectId === objectId &&
      claims.userId === userId;
  } catch {
    return false;
  }
}
