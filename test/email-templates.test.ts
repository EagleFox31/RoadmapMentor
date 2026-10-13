import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../server/services/emailLayout";
import { buildInvitationEmail, buildOtpEmail } from "../server/services/emailTemplates";

const appUrl = "https://roadmapmentor.example.org";

test("escapeHtml neutralises markup and quotes", () => {
  assert.equal(escapeHtml(`<b a="1">'&`), "&lt;b a=&quot;1&quot;&gt;&#39;&amp;");
});

test("OTP e-mail keeps the code in subject and body, and escapes the user name", () => {
  const { subject, html } = buildOtpEmail({
    appUrl, to: "learner@example.org", code: "717618", purpose: "REGISTRATION", userName: "<script>x</script>",
  });
  assert.match(subject, /717618/);
  assert.match(html, /<div class="code-digits">717618<\/div>/);
  assert.ok(!html.includes("<script>x</script>"));
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;"));
  assert.ok(html.includes(`href="${appUrl}/roadmap"`));
});

test("invitation e-mail uses the branded layout, the invite link and escapes user values", () => {
  const { subject, html } = buildInvitationEmail({
    appUrl,
    to: "learner@example.org",
    mentorName: "Ada <Lovelace>",
    roadmapTitle: "ShopFlow — Python → PCAP & GenAI",
    token: "abc_DEF-123",
    expiresAt: new Date("2026-10-20T12:00:00Z"),
  });
  assert.match(subject, /Ada <Lovelace> vous invite/);
  assert.ok(html.includes('class="container"'));
  assert.equal(html.split(`${appUrl}/invite/abc_DEF-123`).length - 1, 3, "button + fallback href + fallback text");
  assert.ok(html.includes("Ada &lt;Lovelace&gt;"));
  assert.ok(!html.includes("Ada <Lovelace>"));
  assert.ok(html.includes("ShopFlow — Python → PCAP &amp; GenAI"));
  assert.ok(html.includes("20 octobre 2026"));
});
