import crypto from "node:crypto";

export const SESSION_COOKIE = "nextgen_admin_session";
export const CSRF_COOKIE = "nextgen_admin_csrf";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  const [scheme, saltText, hashText] = encoded.split(":");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length < 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

export function cookieOptions(secure, maxAge) {
  return {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS);
}

export function sessionTtlMs() {
  return SESSION_TTL_MS;
}

export function validSlug(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(value);
}

export function normalizeGuest(firstNameValue, lastNameValue, contactValue) {
  const firstName = String(firstNameValue || "").trim();
  const lastName = String(lastNameValue || "").trim();
  const contact = String(contactValue || "").trim();
  if (firstName.length < 1 || firstName.length > 60 || lastName.length < 1 || lastName.length > 60) {
    throw new Error("Name must be between 1 and 60 characters.");
  }
  if (contact.length > 120 || !contact) throw new Error("Enter a valid email address or phone number.");
  if (contact.includes("@")) {
    const normalized = contact.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address or phone number.");
    return { firstName, lastName, contactType: "email", contactValue: normalized };
  }
  if (!/^[\d\s()+.-]+$/.test(contact)) throw new Error("Enter a valid email address or phone number.");
  const normalized = contact.replace(/\D/g, "");
  if (normalized.length < 7 || normalized.length > 15) throw new Error("Enter a valid email address or phone number.");
  return { firstName, lastName, contactType: "phone", contactValue: normalized };
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    const key = part.slice(0, index).trim();
    try { return [key, decodeURIComponent(part.slice(index + 1).trim())]; }
    catch { return [key, ""]; }
  }).filter(([key]) => key));
}
