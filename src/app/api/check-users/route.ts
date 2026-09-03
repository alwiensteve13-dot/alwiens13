import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath = path.join(process.cwd(), "auth.db");
    const db = new Database(dbPath);
    const row = db.prepare("SELECT count(*) as count FROM user").get() as { count: number };
    return NextResponse.json({ hasUsers: row.count > 0 });
  } catch (e) {
    // Fallback on cloud platforms (e.g. Vercel) where SQLite binary is absent
    return NextResponse.json({ hasUsers: true });
  }
}
