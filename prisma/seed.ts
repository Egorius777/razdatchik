import { PrismaClient } from "@prisma/client";
import { calculateLessonAmounts } from "../src/lib/money";
import { buildLessonCreateData, upsertWeeklyPayouts } from "../src/lib/settlement";
import { getPreviousWeekBounds } from "../src/lib/utils";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  await rm(path.join(process.cwd(), "data"), { recursive: true, force: true });

  const distributor = await prisma.user.upsert({
    where: { telegramId: BigInt(1001) },
    create: { telegramId: BigInt(1001), firstName: "Раздатчик", username: "distributor" },
    update: {},
  });

  const tutor = await prisma.user.upsert({
    where: { telegramId: BigInt(1002) },
    create: { telegramId: BigInt(1002), firstName: "Репетитор", username: "tutor" },
    update: {},
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Демо сеть",
      ownerUserId: distributor.id,
      cardDetails: "4276 **** **** 1234",
      settlementWeekday: 1,
    },
  });

  await prisma.membership.createMany({
    data: [
      { workspaceId: workspace.id, userId: distributor.id, role: "Distributor", status: "Active" },
      { workspaceId: workspace.id, userId: tutor.id, role: "Tutor", status: "Active" },
    ],
  });

  const student = await prisma.student.create({
    data: {
      workspaceId: workspace.id,
      tutorId: tutor.id,
      name: "Ученик демо",
      defaultPrice: 2000,
      commissionType: "Percent",
      commissionValue: 25,
      status: "Active",
    },
  });

  const { start, end } = getPreviousWeekBounds(new Date(), 1);
  const lessonDates = [0, 2, 4].map((offset) => {
    const d = new Date(start);
    d.setDate(start.getDate() + offset);
    d.setHours(12, 0, 0, 0);
    return d;
  });

  for (const scheduledAt of lessonDates) {
    await prisma.lesson.create({
      data: buildLessonCreateData(student, {
        workspaceId: workspace.id,
        studentId: student.id,
        tutorId: tutor.id,
        scheduledAt,
        status: "Done",
        createdById: tutor.id,
      }),
    });
  }

  const amounts = calculateLessonAmounts({
    price: 2000,
    commissionType: "Percent",
    commissionValue: 25,
  });
  const perLessonTutor = amounts.tutorAmount.toNumber();
  const perLessonCommission = amounts.commissionAmount.toNumber();

  if (perLessonTutor !== 1500 || perLessonCommission !== 500) {
    throw new Error(
      `Calculation mismatch: tutor=${perLessonTutor}, commission=${perLessonCommission}`
    );
  }

  const lessons = await prisma.lesson.findMany({ where: { workspaceId: workspace.id } });
  const totalTutor = lessons.reduce((s, l) => s + Number(l.tutorAmount), 0);
  const totalCommission = lessons.reduce((s, l) => s + Number(l.commissionAmount), 0);

  if (totalTutor !== 4500 || totalCommission !== 1500) {
    throw new Error(`Seed totals mismatch: tutor=${totalTutor}, commission=${totalCommission}`);
  }

  const otherStudent = await prisma.student.create({
    data: {
      workspaceId: workspace.id,
      tutorId: distributor.id,
      name: "Чужой ученик",
      defaultPrice: 3000,
      commissionType: "Percent",
      commissionValue: 30,
    },
  });

  const tutorStudents = await prisma.student.findMany({
    where: { workspaceId: workspace.id, tutorId: tutor.id },
  });
  if (tutorStudents.length !== 1 || tutorStudents[0].id !== student.id) {
    throw new Error("Tutor scope check failed in seed");
  }
  void otherStudent;

  const settlement = await upsertWeeklyPayouts(workspace.id, 1);
  const tutorPayout = settlement.payouts.find((p) => p.tutorId === tutor.id);
  if (!tutorPayout || Number(tutorPayout.netAmount) !== 4500) {
    throw new Error(`Payout mismatch: ${tutorPayout?.netAmount}`);
  }

  const receiptsDir = path.join(process.cwd(), "data", "receipts", workspace.id);
  await mkdir(receiptsDir, { recursive: true });
  const receiptPath = path.join(receiptsDir, "demo.txt");
  await writeFile(receiptPath, "demo receipt");
  const receipt = await prisma.receiptFile.create({
    data: {
      workspaceId: workspace.id,
      path: receiptPath,
      mime: "text/plain",
      size: 12,
      uploadedById: tutor.id,
    },
  });
  const readBack = await readFile(receiptPath);
  if (readBack.toString() !== "demo receipt") {
    throw new Error("Receipt file IO failed");
  }
  void receipt;

  console.log("Seed OK:");
  console.log(`  workspace: ${workspace.id}`);
  console.log(`  distributor: ${distributor.id}`);
  console.log(`  tutor: ${tutor.id}`);
  console.log(`  student: ${student.id}`);
  console.log(`  lessons: ${lessons.length}, tutor total: ${totalTutor}, commission: ${totalCommission}`);
  console.log(`  payout net: ${tutorPayout.netAmount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
