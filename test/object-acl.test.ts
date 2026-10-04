import test from "node:test";
import assert from "node:assert/strict";
import {
  ObjectPermission,
  canAccessObjectPolicy,
} from "../server/objectAcl";

test("public objects are readable without an authenticated owner", () => {
  assert.equal(
    canAccessObjectPolicy({
      aclPolicy: { owner: "42", visibility: "public" },
      requestedPermission: ObjectPermission.READ,
    }),
    true,
  );
});

test("public visibility does not grant write access", () => {
  assert.equal(
    canAccessObjectPolicy({
      userId: "7",
      aclPolicy: { owner: "42", visibility: "public" },
      requestedPermission: ObjectPermission.WRITE,
    }),
    false,
  );
});

test("private objects are accessible only to their owner", () => {
  const aclPolicy = { owner: "42", visibility: "private" } as const;

  assert.equal(
    canAccessObjectPolicy({
      userId: "42",
      aclPolicy,
      requestedPermission: ObjectPermission.READ,
    }),
    true,
  );
  assert.equal(
    canAccessObjectPolicy({
      userId: "7",
      aclPolicy,
      requestedPermission: ObjectPermission.READ,
    }),
    false,
  );
});

test("objects without ACL metadata remain inaccessible", () => {
  assert.equal(
    canAccessObjectPolicy({
      userId: "42",
      aclPolicy: null,
      requestedPermission: ObjectPermission.READ,
    }),
    false,
  );
});
