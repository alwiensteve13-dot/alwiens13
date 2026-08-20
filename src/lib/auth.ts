import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "path";

// Initialize a local SQLite database for authentication
const dbPath = path.join(process.cwd(), "auth.db");
const sqlite = new Database(dbPath);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || "sangat-rahasia-bws-maluku-2026-auth-key",
  database: sqlite,
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
