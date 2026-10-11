import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

function createDb() {
  if (!connectionString) {
    // Trả về mock hoặc throw rõ ràng nếu chưa có DATABASE_URL
    return null;
  }
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export const db = createDb();
export { schema };
