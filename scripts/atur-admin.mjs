#!/usr/bin/env node
/**
 * Atur akun pengelola (admin) Neraca Air.
 *
 *   node scripts/atur-admin.mjs
 *
 * - Menanyakan email dan kata sandi admin (sandi tidak ditampilkan saat diketik).
 * - Menyimpan ADMIN_EMAIL, ADMIN_PASSWORD_HASH, dan AUTH_SECRET ke file .env.
 * - Menampilkan nilai yang perlu disalin ke Environment Variables di Vercel.
 *
 * Sandi asli TIDAK disimpan di mana pun — hanya hash-nya.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";

const ENV_PATH = resolve(process.cwd(), ".env");

// Satu interface readline untuk semua pertanyaan (lebih andal daripada membuat ulang).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let muted = false;
const originalWrite = rl._writeToOutput?.bind(rl);
rl._writeToOutput = (str) => {
  if (muted && str !== "\r\n" && str !== "\n") {
    rl.output.write("*".repeat(Math.min(str.length, 1)));
    return;
  }
  if (originalWrite) originalWrite(str);
  else rl.output.write(str);
};

const lines = rl[Symbol.asyncIterator]();

async function ask(question, { hidden = false } = {}) {
  muted = false;
  process.stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden && process.stdin.isTTY) process.stdout.write("\n");
  return value ?? "";
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return content.replace(/\s*$/, "") + `\n${line}\n`;
}

function getEnvValue(content, key) {
  const m = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

async function main() {
  console.log("\n=== Atur akun pengelola Neraca Air ===\n");

  const email = (await ask("Email admin: ")).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Email tidak valid.");
    rl.close();
    process.exit(1);
  }

  const password = await ask("Kata sandi baru (min. 10 karakter): ", { hidden: true });
  if (password.length < 10) {
    console.error("Kata sandi terlalu pendek (minimal 10 karakter).");
    process.exit(1);
  }
  const confirm = await ask("Ulangi kata sandi: ", { hidden: true });
  if (password !== confirm) {
    console.error("Kata sandi tidak sama.");
    process.exit(1);
  }

  let env = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  let secret = getEnvValue(env, "AUTH_SECRET");
  if (secret.length < 32) secret = randomBytes(32).toString("base64url");

  const passwordHash = hashPassword(password);
  env = setEnvValue(env, "ADMIN_EMAIL", email);
  env = setEnvValue(env, "ADMIN_PASSWORD_HASH", passwordHash);
  env = setEnvValue(env, "AUTH_SECRET", secret);
  writeFileSync(ENV_PATH, env);

  console.log("\nTersimpan di .env. Restart server lokal agar berlaku.\n");
  console.log("Salin 3 nilai berikut ke Vercel > Project > Settings > Environment Variables:");
  console.log("------------------------------------------------------------------");
  console.log(`ADMIN_EMAIL=${email}`);
  console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
  console.log(`AUTH_SECRET=${secret}`);
  console.log("------------------------------------------------------------------");
  console.log("Setelah diisi di Vercel, lakukan Redeploy.\n");
  rl.close();
}

main();
