import { PrismaClient } from "@prisma/client";
import { runDemoSeed } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

runDemoSeed(prisma)
  .then((summary) => {
    console.log("Seed OK:", JSON.stringify(summary, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
