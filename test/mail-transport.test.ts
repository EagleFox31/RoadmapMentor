import assert from "node:assert/strict";
import { test } from "node:test";
import { createMailTransport } from "../server/services/mailTransport";

const message = { from: "App <a@b.test>", to: "c@d.test", subject: "Sujet", html: "<p>x</p>" };

test("RESEND_API_KEY selects Resend and posts the message with a bearer key", async () => {
  const calls: any[] = [];
  const transport = createMailTransport({ RESEND_API_KEY: "re_secret" }, async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ id: "msg_1" }) };
  });
  assert.equal(transport.provider, "resend");
  assert.deepEqual(await transport.send(message), { id: "msg_1" });
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers.Authorization, "Bearer re_secret");
  assert.deepEqual(JSON.parse(calls[0].init.body), message);
});

test("a Resend error is actionable and never leaks the key", async () => {
  const transport = createMailTransport({ RESEND_API_KEY: "re_secret" }, async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: "The domain is not verified" }),
  }));
  await assert.rejects(transport.send(message), (error: Error) => {
    assert.match(error.message, /403.*domain is not verified/);
    assert.ok(!error.message.includes("re_secret"));
    return true;
  });
});

test("provider selection: SMTP when only MAIL_HOST, explicit override, none otherwise", async () => {
  assert.equal(createMailTransport({ MAIL_HOST: "smtp.test" }).provider, "smtp");
  assert.equal(createMailTransport({ RESEND_API_KEY: "k", MAIL_HOST: "smtp.test", MAIL_PROVIDER: "smtp" }).provider, "smtp");
  assert.equal(createMailTransport({ RESEND_API_KEY: "k", MAIL_HOST: "smtp.test" }).provider, "resend");
  const none = createMailTransport({});
  assert.equal(none.provider, "none");
  await assert.rejects(none.send(message), /No mail provider/);
  assert.throws(() => createMailTransport({ MAIL_PROVIDER: "resend" }), /RESEND_API_KEY/);
});
