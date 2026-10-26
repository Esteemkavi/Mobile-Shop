import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { passwordHash } from "../security.js";

if (!process.stdin.isTTY) {
  console.error("Run this command in an interactive terminal so your password stays hidden.");
  process.exit(1);
}

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stderr.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stderr.write(prompt);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function setEnvValue(lines, key, value) {
  let found = false;
  const result = lines.flatMap((line) => {
    if (!line.startsWith(`${key}=`)) return [line];
    if (found) return [];
    found = true;
    return [`${key}=${value}`];
  });
  if (!found) result.push(`${key}=${value}`);
  return result;
}

try {
  const password = await readSecret("New admin password (min 14 characters): ");
  if (password.length < 14 || password.length > 256) {
    throw new Error("Use a password between 14 and 256 characters.");
  }
  const confirmation = await readSecret("Confirm admin password: ");
  if (password !== confirmation) throw new Error("Passwords did not match.");

  const envPath = path.resolve(process.env.ADMIN_ENV_PATH || ".env");
  const original = await fs.readFile(envPath, "utf8");
  let lines = original.split(/\r?\n/);
  lines = setEnvValue(lines, "ADMIN_USERNAME", "admin");
  lines = setEnvValue(lines, "ADMIN_PASSWORD_HASH", passwordHash(password));

  const tempPath = `${envPath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${lines.join("\n").replace(/\n+$/, "")}\n`, { mode: 0o600, flag: "wx" });
  await fs.rename(tempPath, envPath);
  await fs.chmod(envPath, 0o600);

  if (process.platform === "linux" && process.env.XDG_RUNTIME_DIR) {
    const restart = spawnSync("systemctl", ["--user", "restart", "nextgen-api.service"], { stdio: "ignore" });
    if (restart.status !== 0) throw new Error("Password saved, but the API could not restart. Run systemctl --user restart nextgen-api.service.");
  }
  console.log("Admin login configured. The password is stored as a hash and was not displayed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
