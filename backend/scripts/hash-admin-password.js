import readline from "node:readline";
import { passwordHash } from "../security.js";

if (!process.stdin.isTTY) {
  console.error("Run this command in an interactive terminal so your password is not echoed.");
  process.exit(1);
}

const readSecret = (prompt) => new Promise((resolve, reject) => {
  const stdin = process.stdin;
  let value = "";
  const onData = (buffer) => {
    for (const char of buffer.toString("utf8")) {
      if (char === "\u0003") { cleanup(); reject(new Error("Cancelled")); return; }
      if (char === "\r" || char === "\n") { cleanup(); process.stdout.write("\n"); resolve(value); return; }
      if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
      else if (char >= " ") value += char;
    }
  };
  const cleanup = () => { stdin.off("data", onData); stdin.setRawMode(false); stdin.pause(); };
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on("data", onData);
});

try {
  const password = await readSecret("New admin password (min 14 characters): ");
  if (password.length < 14 || password.length > 256) throw new Error("Use a password between 14 and 256 characters.");
  const confirm = await readSecret("Confirm admin password: ");
  if (password !== confirm) throw new Error("Passwords did not match.");
  console.log(`ADMIN_PASSWORD_HASH=${passwordHash(password)}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
