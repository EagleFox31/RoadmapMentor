import test from "node:test";
import assert from "node:assert/strict";
import { OtpService } from "../server/services/otpService";
import {
  sendRegistrationOtpSchema,
  verifyRegistrationOtpSchema,
  sendLoginOtpSchema,
  verifyLoginOtpSchema,
} from "../shared/schema";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "roadmapmentor-test-secret";

test("OTP generator produces 6-digit numerical codes", () => {
  const service = new OtpService();
  for (let i = 0; i < 20; i++) {
    const code = service.generateCode();
    assert.match(code, /^\d{6}$/);
    const num = parseInt(code, 10);
    assert.ok(num >= 100000 && num <= 999999);
  }
});

test("OTP hashing is deterministic and uses sha256", () => {
  const service = new OtpService();
  const hash1 = service.hashCode("123456");
  const hash2 = service.hashCode("123456");
  const hashOther = service.hashCode("654321");

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hashOther);
  assert.equal(hash1.length, 64); // sha256 hex length
});

test("sendRegistrationOtpSchema enforces validation rules", () => {
  // Valid payload
  const valid = sendRegistrationOtpSchema.parse({
    fullName: "Pavel Durov",
    email: "PAVEL@Example.com",
    password: "securePassword123",
  });
  assert.equal(valid.email, "pavel@example.com");

  // Invalid email
  assert.throws(() => {
    sendRegistrationOtpSchema.parse({
      fullName: "Test",
      email: "not-an-email",
      password: "securePassword123",
    });
  });

  // Short password
  assert.throws(() => {
    sendRegistrationOtpSchema.parse({
      fullName: "Test",
      email: "test@example.com",
      password: "short",
    });
  });
});

test("verifyOtpSchemas enforce 6-digit codes", () => {
  const validReg = verifyRegistrationOtpSchema.parse({
    email: "user@example.com",
    code: "839201",
  });
  assert.equal(validReg.code, "839201");

  // Rejects 5 digits
  assert.throws(() => {
    verifyRegistrationOtpSchema.parse({
      email: "user@example.com",
      code: "12345",
    });
  });

  // Rejects letters
  assert.throws(() => {
    verifyLoginOtpSchema.parse({
      email: "user@example.com",
      code: "12345A",
    });
  });
});
