import { betterAuth } from "better-auth";

let sqlite: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  const dbPath = path.join(process.cwd(), "auth.db");
  sqlite = new Database(dbPath);
} catch (err) {
  console.warn("better-sqlite3 native module fallback:", err);
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "sangat-rahasia-bws-maluku-2026-auth-key",
  database: sqlite || {
    provider: "sqlite",
    url: ":memory:"
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ url, user }) => {
      console.log("\n\n=======================================================");
      console.log("🔑 PERMINTAAN ATUR ULANG SANDI (LUPA SANDI)");
      console.log("=======================================================");
      console.log(`Email Pengelola: ${user?.email || "Tidak diketahui"}`);
      console.log(`\nSilakan salin dan buka tautan berikut di browser Anda:`);
      console.log(`👉 ${url}\n`);
      console.log("=======================================================\n\n");
    }
  },
  trustedOrigins: ["https://*", "http://*"]
});
