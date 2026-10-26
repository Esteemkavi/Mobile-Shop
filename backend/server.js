import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { pool } from "./db.js";
import {
  CSRF_COOKIE, SESSION_COOKIE, cookieOptions, createToken, hashToken,
  normalizeGuest, parseCookies, sessionExpiry, sessionTtlMs, validSlug,
  verifyPassword,
} from "./security.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const secureCookies = process.env.COOKIE_SECURE === "true";
const username = process.env.ADMIN_USERNAME || "admin";
const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";
const dataDir = path.resolve(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "data"));
const uploadsDir = path.join(dataDir, "uploads");
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../mobile-app/dist");
const allowedOrigins = new Set((process.env.CORS_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
const categoriesDefaults = [
  { slug: "mobile-skins", name: "Mobile Skins", subtitle: "Premium Skin Collections", icon: "◆", display_order: 1 },
  { slug: "screen-guard", name: "Screen Guard", subtitle: "Premium Screen Protection", icon: "◇", display_order: 2 },
  { slug: "tempered-glass", name: "Unbreakable Tempered Glass", subtitle: "Premium Protection", icon: "◇", display_order: 3 },
  { slug: "smartphones", name: "Smartphones", subtitle: "Sales & Latest Models", icon: "▣", display_order: 4 },
];

await fs.mkdir(uploadsDir, { recursive: true });
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.disable("x-powered-by");
app.use(helmet({
  // This server is served directly over HTTP on the private LAN. Do not make
  // browsers upgrade the app's same-origin JS/CSS requests to unavailable HTTPS.
  strictTransportSecurity: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // React Native Web injects its generated layout rules at runtime.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://raw.githubusercontent.com"],
      connectSrc: ["'self'", ...allowedOrigins],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has(origin) || origin === `${req.protocol}://${req.get("host")}`)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  } else if (origin && req.path.startsWith("/api/")) {
    return res.status(403).json({ error: "Origin is not allowed." });
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "1mb", strict: true }));
app.use("/uploads", express.static(uploadsDir, {
  dotfiles: "deny", index: false, fallthrough: false,
  setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=86400, immutable"); },
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
const publicWriteLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });
const guestWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
const parseCookiesMiddleware = (req, _res, next) => { req.cookies = parseCookies(req.headers.cookie); next(); };
app.use(parseCookiesMiddleware);

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  return origin === `${req.protocol}://${req.get("host")}` || allowedOrigins.has(origin);
}

async function requireAdmin(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: "Admin login required." });
  try {
    const { rows } = await pool.query(
      "SELECT username, csrf_hash FROM nextgen_app.admin_sessions WHERE token_hash = $1 AND expires_at > now()",
      [hashToken(token)],
    );
    if (!rows[0]) return res.status(401).json({ error: "Admin session expired. Please sign in again." });
    req.admin = rows[0];
    next();
  } catch (error) { next(error); }
}

function requireCsrf(req, res, next) {
  if (!sameOrigin(req)) return res.status(403).json({ error: "Request origin could not be verified." });
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.get("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken || hashToken(cookieToken) !== req.admin.csrf_hash) {
    return res.status(403).json({ error: "Security token is invalid. Refresh the admin page and try again." });
  }
  next();
}

function requireText(value, label, maxLength) {
  const clean = String(value ?? "").trim();
  if (!clean || clean.length > maxLength) throw new Error(`${label} is required and must be ${maxLength} characters or fewer.`);
  return clean;
}

function validateProduct(body) {
  const id = String(body.id || crypto.randomUUID()).trim();
  const categorySlug = requireText(body.category_slug, "Category", 63);
  const name = requireText(body.name, "Product name", 180);
  const imageUrl = requireText(body.image_url, "Product image", 2048);
  if (!/^\/uploads\/[A-Za-z0-9-]+\.(?:jpg|png|webp)$/i.test(imageUrl) && !/^https:\/\//i.test(imageUrl)) throw new Error("Image must be an uploaded image or HTTPS URL.");
  const price = body.price === "" || body.price == null ? null : Number(body.price);
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 9999999999)) throw new Error("Price must be a non-negative number.");
  const description = String(body.description ?? "").trim();
  if (description.length > 4000) throw new Error("Description is too long.");
  return {
    id, categorySlug, name, imageUrl, price, description,
    isNewArrival: body.is_new_arrival === true || body.is_new_arrival === "true",
    isActive: body.is_active === false || body.is_active === "false" ? false : true,
  };
}

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) { next(error); }
});

app.get("/api/catalog", async (_req, res, next) => {
  try {
    const [categoryResult, productResult] = await Promise.all([
      pool.query("SELECT slug, name, subtitle, icon, display_order FROM nextgen_app.categories WHERE is_active = true ORDER BY display_order, name"),
      pool.query(`SELECT p.id, p.category_slug, p.name, p.image_url, p.price, p.description, p.is_new_arrival
        FROM nextgen_app.products p JOIN nextgen_app.categories c ON c.slug = p.category_slug
        WHERE p.is_active = true AND c.is_active = true ORDER BY p.created_at DESC, p.name`),
    ]);
    const catalog = Object.fromEntries(categoryResult.rows.map((row) => [row.slug, []]));
    const arrivals = [];
    for (const row of productResult.rows) {
      const item = { id: row.id, name: row.name, image: row.image_url, price: row.price, description: row.description };
      (catalog[row.category_slug] ||= []).push(item);
      if (row.is_new_arrival) arrivals.push(item);
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ categories: categoryResult.rows, catalog, arrivals });
  } catch (error) { next(error); }
});

app.get("/api/product-likes", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT product_key, like_count FROM nextgen_app.product_like_counts ORDER BY product_key");
    res.json({ counts: rows });
  } catch (error) { next(error); }
});

app.post("/api/guests", guestWriteLimiter, async (req, res, next) => {
  try {
    const guest = normalizeGuest(req.body.first_name, req.body.last_name, req.body.contact);
    const id = crypto.randomUUID();
    const { rows } = await pool.query(`INSERT INTO nextgen_app.guests (id, first_name, last_name, contact_type, contact_value)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (contact_type, contact_value) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, updated_at = now()
      RETURNING id`, [id, guest.firstName, guest.lastName, guest.contactType, guest.contactValue]);
    res.status(200).json({ id: rows[0].id });
  } catch (error) {
    if (error instanceof Error && !error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.post("/api/product-likes/adjust", publicWriteLimiter, async (req, res, next) => {
  const { product_key: productKey, p_delta: delta } = req.body || {};
  const guestId = String(req.body?.guest_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guestId)) return res.status(400).json({ error: "Invalid guest ID." });
  if (typeof productKey !== "string" || !productKey.trim() || productKey.length > 255 || ![1, -1].includes(delta)) return res.status(400).json({ error: "Invalid product like update." });
  try {
    const guestResult = await pool.query("SELECT 1 FROM nextgen_app.guests WHERE id=$1", [guestId]);
    if (!guestResult.rowCount) return res.status(401).json({ error: "Guest session not found. Please explore again." });
    const { rows } = await pool.query(`INSERT INTO nextgen_app.product_like_counts AS counts (product_key, like_count, updated_at)
      VALUES ($1, GREATEST($2, 0), now()) ON CONFLICT (product_key) DO UPDATE
      SET like_count = GREATEST(0, counts.like_count + $2), updated_at = now()
      RETURNING like_count`, [productKey.trim(), delta]);
    res.json({ like_count: rows[0].like_count });
  } catch (error) { next(error); }
});

app.post("/api/admin/login", loginLimiter, async (req, res, next) => {
  const user = String(req.body?.username || "");
  const password = req.body?.password;
  if (req.headers.origin && !sameOrigin(req)) return res.status(403).json({ error: "Request origin could not be verified." });
  if (!passwordHash || user !== username || !verifyPassword(password, passwordHash)) return res.status(401).json({ error: "Invalid username or password." });
  try {
    const token = createToken();
    const csrf = createToken();
    const expires = sessionExpiry();
    await pool.query("DELETE FROM nextgen_app.admin_sessions WHERE expires_at <= now()");
    await pool.query("INSERT INTO nextgen_app.admin_sessions (token_hash, username, csrf_hash, expires_at) VALUES ($1, $2, $3, $4)", [hashToken(token), user, hashToken(csrf), expires]);
    res.cookie(SESSION_COOKIE, token, cookieOptions(secureCookies, sessionTtlMs()));
    res.cookie(CSRF_COOKIE, csrf, { ...cookieOptions(secureCookies, sessionTtlMs()), httpOnly: false });
    res.json({ username: user, csrfToken: csrf });
  } catch (error) { next(error); }
});

app.get("/api/admin/session", requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, csrfToken: req.cookies[CSRF_COOKIE] });
});

app.post("/api/admin/logout", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    await pool.query("DELETE FROM nextgen_app.admin_sessions WHERE token_hash = $1", [hashToken(req.cookies[SESSION_COOKIE])]);
    res.clearCookie(SESSION_COOKIE, cookieOptions(secureCookies));
    res.clearCookie(CSRF_COOKIE, { ...cookieOptions(secureCookies), httpOnly: false });
    res.sendStatus(204);
  } catch (error) { next(error); }
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDir),
  filename: (_req, file, callback) => {
    const ext = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" })[file.mimetype];
    callback(null, `${crypto.randomUUID()}${ext || ""}`);
  },
});
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return callback(new Error("Upload a JPG, PNG, or WebP image."));
    callback(null, true);
  },
});
const uploadImages = multer({
  storage: imageStorage,
  limits: { fileSize: 1024 * 1024, files: 30, fields: 1, fieldSize: 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return callback(new Error("Upload JPG, PNG, or WebP images only."));
    callback(null, true);
  },
});
async function removeUploadedFiles(files = []) {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
}
function receiveProductImages(req, res, next) {
  uploadImages.array("images", 30)(req, res, async (error) => {
    if (error) {
      await removeUploadedFiles(req.files);
      return next(error);
    }
    next();
  });
}

app.get("/api/admin/categories", requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT slug, name, subtitle, icon, display_order, is_active FROM nextgen_app.categories ORDER BY display_order, name");
    res.json({ categories: rows });
  } catch (error) { next(error); }
});

app.post("/api/admin/categories", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const slug = requireText(req.body?.slug, "Slug", 63);
    if (!validSlug(slug)) return res.status(400).json({ error: "Slug may contain lowercase letters, digits, and hyphens." });
    const name = requireText(req.body?.name, "Category name", 100);
    const subtitle = String(req.body?.subtitle || "").trim().slice(0, 160);
    const icon = String(req.body?.icon || "◇").trim().slice(0, 8) || "◇";
    const order = Number.isInteger(Number(req.body?.display_order)) ? Number(req.body.display_order) : 0;
    const { rows } = await pool.query(`INSERT INTO nextgen_app.categories (slug, name, subtitle, icon, display_order)
      VALUES ($1, $2, $3, $4, $5) RETURNING slug, name, subtitle, icon, display_order, is_active`, [slug, name, subtitle, icon, order]);
    res.status(201).json({ category: rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "That category slug already exists." });
    if (!error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.patch("/api/admin/categories/:slug", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const name = requireText(req.body?.name, "Category name", 100);
    const subtitle = String(req.body?.subtitle || "").trim().slice(0, 160);
    const icon = String(req.body?.icon || "◇").trim().slice(0, 8) || "◇";
    const order = Number.isInteger(Number(req.body?.display_order)) ? Number(req.body.display_order) : 0;
    const active = req.body?.is_active === false ? false : true;
    const { rows } = await pool.query(`UPDATE nextgen_app.categories SET name=$2, subtitle=$3, icon=$4, display_order=$5, is_active=$6, updated_at=now()
      WHERE slug=$1 RETURNING slug, name, subtitle, icon, display_order, is_active`, [req.params.slug, name, subtitle, icon, order, active]);
    if (!rows[0]) return res.status(404).json({ error: "Category not found." });
    res.json({ category: rows[0] });
  } catch (error) {
    if (!error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.delete("/api/admin/categories/:slug", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const { rows: productRows } = await pool.query("SELECT EXISTS (SELECT 1 FROM nextgen_app.products WHERE category_slug=$1) AS used", [req.params.slug]);
    if (productRows[0].used) return res.status(409).json({ error: "This category still has products. Move them first, then remove the category." });
    const result = await pool.query("DELETE FROM nextgen_app.categories WHERE slug=$1", [req.params.slug]);
    if (!result.rowCount) return res.status(404).json({ error: "Category not found." });
    res.sendStatus(204);
  } catch (error) { next(error); }
});

app.get("/api/admin/products", requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT p.id, p.category_slug, p.name, p.image_url, p.price, p.description,
      p.is_new_arrival, p.is_active, p.created_at, c.name AS category_name
      FROM nextgen_app.products p JOIN nextgen_app.categories c ON c.slug=p.category_slug
      ORDER BY p.created_at DESC, p.name`);
    res.json({ products: rows });
  } catch (error) { next(error); }
});

app.post("/api/admin/uploads", requireAdmin, requireCsrf, uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Select an image to upload." });
  res.status(201).json({ image_url: `/uploads/${req.file.filename}` });
});

app.post("/api/admin/products", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const product = validateProduct(req.body);
    const { rows } = await pool.query(`INSERT INTO nextgen_app.products (id, category_slug, name, image_url, price, description, is_new_arrival, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [product.id, product.categorySlug, product.name, product.imageUrl, product.price, product.description, product.isNewArrival, product.isActive]);
    res.status(201).json({ product: rows[0] });
  } catch (error) {
    if (error.code === "23503") return res.status(400).json({ error: "Choose an existing category." });
    if (error.code === "23505") return res.status(409).json({ error: "Product already exists." });
    if (!error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.post("/api/admin/products/bulk", requireAdmin, requireCsrf, receiveProductImages, async (req, res, next) => {
  const files = req.files || [];
  let client;
  let transactionStarted = false;
  try {
    if (!files.length) throw new Error("Select at least one product image.");
    let metadata;
    try { metadata = JSON.parse(req.body?.products || ""); }
    catch { throw new Error("Product details could not be read. Please try again."); }
    if (!Array.isArray(metadata) || metadata.length !== files.length) throw new Error("Each image needs its own product details.");
    const productsToInsert = metadata.map((item, index) => validateProduct({
      ...item,
      image_url: `/uploads/${files[index].filename}`,
    }));
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const created = [];
    for (const product of productsToInsert) {
      const { rows } = await client.query(`INSERT INTO nextgen_app.products (id, category_slug, name, image_url, price, description, is_new_arrival, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [product.id, product.categorySlug, product.name, product.imageUrl, product.price, product.description, product.isNewArrival, product.isActive]);
      created.push(rows[0]);
    }
    await client.query("COMMIT");
    transactionStarted = false;
    res.status(201).json({ count: created.length, products: created });
  } catch (error) {
    if (transactionStarted && client) await client.query("ROLLBACK").catch(() => {});
    await removeUploadedFiles(files);
    if (error.code === "23503") return res.status(400).json({ error: "Choose an existing category for every product." });
    if (error.code === "23505") return res.status(409).json({ error: "One or more products already exist." });
    if (!error.code) return res.status(400).json({ error: error.message });
    next(error);
  } finally {
    client?.release();
  }
});

app.patch("/api/admin/products/:id", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const product = validateProduct({ ...req.body, id: req.params.id });
    const { rows } = await pool.query(`UPDATE nextgen_app.products SET category_slug=$2, name=$3, image_url=$4, price=$5, description=$6,
      is_new_arrival=$7, is_active=$8, updated_at=now() WHERE id=$1 RETURNING *`, [product.id, product.categorySlug, product.name, product.imageUrl, product.price, product.description, product.isNewArrival, product.isActive]);
    if (!rows[0]) return res.status(404).json({ error: "Product not found." });
    res.json({ product: rows[0] });
  } catch (error) {
    if (error.code === "23503") return res.status(400).json({ error: "Choose an existing category." });
    if (!error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.delete("/api/admin/products/:id", requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM nextgen_app.products WHERE id=$1", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Product not found." });
    res.sendStatus(204);
  } catch (error) { next(error); }
});

app.use("/admin", express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "admin"), { index: false }));
app.get("/admin", (_req, res) => res.sendFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "admin/index.html")));
app.get("/admin/", (_req, res) => res.redirect(308, "/admin"));
app.use(express.static(webDir, { index: "index.html", fallthrough: true }));
app.get(/^(?!\/api\/|\/uploads\/|\/admin(?:\/|$)).*/, async (_req, res, next) => {
  try { await fs.access(path.join(webDir, "index.html")); res.sendFile(path.join(webDir, "index.html")); }
  catch { next(); }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Each uploaded image must be 1 MB or smaller. Select it again so the browser can optimize it before upload."
      : error.code === "LIMIT_FILE_COUNT" ? "Choose 30 images or fewer."
      : "Image upload failed. Check the selected files and try again.";
    return res.status(400).json({ error: message });
  }
  if (error.message === "Upload a JPG, PNG, or WebP image." || error.message === "Upload JPG, PNG, or WebP images only.") return res.status(400).json({ error: error.message });
  if (error.code === "ENOENT") return res.status(404).json({ error: "Not found." });
  console.error("Request failed:", error.message);
  res.status(500).json({ error: "Server error. Check the backend service log." });
});

const server = app.listen(port, host, () => console.log(`NextGen API listening on ${host}:${port}`));
const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
