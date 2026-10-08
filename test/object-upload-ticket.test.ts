import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { issueObjectUploadTicket, verifyObjectUploadTicket } from "../server/security/objectUploadTicket";
import { resolveJwtSecret } from "../server/security";

const objectId = "123e4567-e89b-42d3-a456-426614174000";

test("ticket authorizes only the requesting user, exact object and a valid signature", () => {
  const ticket = issueObjectUploadTicket(objectId, 101);
  assert.equal(verifyObjectUploadTicket(ticket, objectId, 101), true);
  assert.equal(verifyObjectUploadTicket(ticket, objectId, 102), false);
  assert.equal(verifyObjectUploadTicket(ticket, "123e4567-e89b-42d3-a456-426614174001", 101), false);
  assert.equal(verifyObjectUploadTicket(ticket + "bad", objectId, 101), false);
  assert.equal(verifyObjectUploadTicket("", objectId, 101), false);
  assert.equal(verifyObjectUploadTicket(undefined, objectId, 101), false);
  assert.throws(() => issueObjectUploadTicket("not-an-object", 101));
});

test("expired or incorrectly scoped upload tickets are rejected", () => {
  const expired = jwt.sign(
    { purpose: "object-upload", objectId, userId: 101 },
    resolveJwtSecret(),
    { expiresIn: -1, audience: "roadmapmentor-object-upload", issuer: "roadmapmentor" },
  );
  assert.equal(verifyObjectUploadTicket(expired, objectId, 101), false);

  const wrongAudience = jwt.sign(
    { purpose: "object-upload", objectId, userId: 101 },
    resolveJwtSecret(),
    { expiresIn: "10m", audience: "another-service", issuer: "roadmapmentor" },
  );
  assert.equal(verifyObjectUploadTicket(wrongAudience, objectId, 101), false);
});
