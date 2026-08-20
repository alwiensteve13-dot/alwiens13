import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), "auth.db");
    const db = new Database(dbPath);
    const row = db.prepare("SELECT count(*) as count FROM user").get() as { count: number };
    return NextResponse.json({ hasUsers: row.count > 0 });
  } catch (e) {
    // If the table doesn't exist yet, it means no users have been created
    return NextResponse.json({ hasUsers: false });
  }
}
