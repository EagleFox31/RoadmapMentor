import assert from "node:assert/strict";
import { test } from "node:test";
import { api, BASE, register } from "./support/api";

test("filesystem upload tickets bind the upload URL to its requester", { skip: !BASE && "TEST_BASE_URL not set" }, async () => {
  const owner = await register("upload.owner");
  const attacker = await register("upload.other");

  const start = await api("POST", "/api/objects/upload", owner.token, {});
  assert.equal(start.status, 200, JSON.stringify(start.data));
  const { uploadURL, objectPath, uploadTicket, requiresAuth } = start.data;
  assert.equal(requiresAuth, true);
  assert.ok(uploadURL.startsWith("/api/objects/local-upload/"));
  assert.ok(objectPath.startsWith("/objects/uploads/"));
  assert.ok(typeof uploadTicket === "string" && uploadTicket.length > 20);

  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const put = (token: string, ticket: string | undefined, path = uploadURL) =>
    fetch(BASE + path, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        Authorization: `Bearer ${token}`,
        ...(ticket ? { "X-Upload-Ticket": ticket } : {}),
      },
      body: image,
    });

  assert.equal((await put(attacker.token, uploadTicket)).status, 403, "other user must not claim URL");
  assert.equal((await put(owner.token, undefined)).status, 403, "bearer alone is insufficient");
  const otherIdPath = uploadURL.slice(0, -1) + (uploadURL.endsWith("0") ? "1" : "0");
  assert.equal((await put(owner.token, uploadTicket, otherIdPath)).status, 403, "ticket cannot be replayed for another object");

  const saved = await put(owner.token, uploadTicket);
  assert.equal(saved.status, 201, await saved.text());

  // Retrying the same signed ticket cannot overwrite the first upload.
  const retry = await put(owner.token, uploadTicket);
  assert.equal(retry.status, 409, await retry.text());
  const file = await fetch(BASE + objectPath, { headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal(file.status, 200);
  assert.equal(await file.arrayBuffer().then(b => Buffer.from(b).toString("base64")), image.toString("base64"));
  assert.equal((await fetch(BASE + objectPath, { headers: { Authorization: `Bearer ${attacker.token}` } })).status, 403);
  assert.equal((await fetch(BASE + objectPath)).status, 401);
});
