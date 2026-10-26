import test from "node:test";
import assert from "node:assert/strict";
import {
  cookieOptions, hashToken, normalizeGuest, parseCookies, passwordHash,
  validSlug, verifyPassword,
} from "../security.js";

test("admin password hashes verify without storing the original password", () => {
  const hash = passwordHash("correct horse battery staple 2026");
  assert.match(hash, /^scrypt:/);
  assert.equal(verifyPassword("correct horse battery staple 2026", hash), true);
  assert.equal(verifyPassword("wrong password", hash), false);
  assert.equal(verifyPassword("x", "not-a-hash"), false);
});

test("guest contacts are normalized and validated", () => {
  assert.deepEqual(normalizeGuest(" Sam ", " Kumar ", "SAM@Example.com"), {
    firstName: "Sam", lastName: "Kumar", contactType: "email", contactValue: "sam@example.com",
  });
  assert.equal(normalizeGuest("Sam", "Kumar", "+91 98765-43210").contactValue, "919876543210");
  assert.throws(() => normalizeGuest("", "Kumar", "sam@example.com"));
  assert.throws(() => normalizeGuest("Sam", "Kumar", "invalid"));
});

test("category slugs and cookie parsing reject malformed values safely", () => {
  assert.equal(validSlug("tempered-glass"), true);
  assert.equal(validSlug("../products"), false);
  assert.deepEqual(parseCookies("a=one; nextgen_admin_csrf=a%2Fb"), { a: "one", nextgen_admin_csrf: "a/b" });
  assert.equal(hashToken("token").length, 64);
});

test("admin session cookies remain HttpOnly and SameSite strict", () => {
  const options = cookieOptions(true, 60_000);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "strict");
  assert.equal(options.path, "/");
});
