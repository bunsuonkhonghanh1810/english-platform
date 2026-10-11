import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { saveExam } from "../src/lib/data-service";
import { SEED_EXAM } from "../src/lib/seed-data";
import { seedAdminIfNotExist } from "../src/actions/auth";

async function main() {
  console.log("Seeding default admin...");
  await seedAdminIfNotExist();

  console.log("Seeding full 40-question exam ENG001 to Neon Postgres...");
  const saved = await saveExam({
    title: SEED_EXAM.title,
    code: SEED_EXAM.code,
    totalQuestions: SEED_EXAM.totalQuestions,
    sections: SEED_EXAM.sections,
  });

  console.log("Successfully seeded exam:", saved.code, saved.title);
  process.exit(0);
}

main().catch((err) => {
  console.error("Lỗi seed:", err);
  process.exit(1);
});
