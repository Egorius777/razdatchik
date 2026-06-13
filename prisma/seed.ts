import { PrismaClient, type Lesson, type Student } from "@prisma/client";
import { calculateLessonAmounts } from "../src/lib/money";
import { buildLessonCreateData, upsertWeeklyPayouts } from "../src/lib/settlement";
import { scheduledAtFromSlot } from "../src/lib/schedule";
import { getPreviousWeekBounds, getWeekBounds } from "../src/lib/utils";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const PAYER_NAMES = [
  "Елена В.",
  "Игорь К.",
  "Анна М.",
  "Сергей П.",
  "Ольга Н.",
  "Дмитрий С.",
  "Наталья Р.",
  "Павел Т.",
  "Виктория Л.",
  "Андрей Г.",
  "Марина И.",
  "Константин Ф.",
];

const STUDENT_SPECS = [
  { name: "Катя", price: 2000, commission: 25, tutorIdx: 0 },
  { name: "Миша", price: 2500, commission: 20, tutorIdx: 0 },
  { name: "Саша", price: 1800, commission: 30, tutorIdx: 0 },
  { name: "Даша", price: 2200, commission: 25, tutorIdx: 1 },
  { name: "Артём", price: 3000, commission: 15, tutorIdx: 1 },
];

function dayOffset(base: Date, days: number, hour = 11, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  await rm(path.join(process.cwd(), "data"), { recursive: true, force: true });

  const distributor = await prisma.user.upsert({
    where: { telegramId: BigInt(1001) },
    create: {
      telegramId: BigInt(1001),
      firstName: "Андрей",
      lastName: "Раздатчиков",
      username: "distributor",
      timezone: "Europe/Moscow",
    },
    update: { timezone: "Europe/Moscow" },
  });

  const tutorAlex = await prisma.user.upsert({
    where: { telegramId: BigInt(1002) },
    create: {
      telegramId: BigInt(1002),
      firstName: "Алексей",
      lastName: "Петров",
      username: "tutor_alex",
      timezone: "Asia/Yekaterinburg",
    },
    update: { timezone: "Asia/Yekaterinburg" },
  });

  const tutorMaria = await prisma.user.upsert({
    where: { telegramId: BigInt(1003) },
    create: {
      telegramId: BigInt(1003),
      firstName: "Марина",
      lastName: "Соколова",
      username: "tutor_maria",
      timezone: "Europe/Moscow",
    },
    update: { timezone: "Europe/Moscow" },
  });

  const tutors = [tutorAlex, tutorMaria];

  const existingWorkspace = await prisma.workspace.findFirst({
    where: { ownerUserId: distributor.id, name: "Демо сеть" },
  });
  if (existingWorkspace) {
    await prisma.workspace.delete({ where: { id: existingWorkspace.id } });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: "Демо сеть",
      ownerUserId: distributor.id,
      cardDetails: "4276 **** **** 1234 (Сбер)",
      settlementWeekday: 1,
    },
  });

  await prisma.membership.createMany({
    data: [
      { workspaceId: workspace.id, userId: distributor.id, role: "Distributor", status: "Active" },
      { workspaceId: workspace.id, userId: tutorAlex.id, role: "Tutor", status: "Active" },
      { workspaceId: workspace.id, userId: tutorMaria.id, role: "Tutor", status: "Active" },
    ],
  });

  const students: Student[] = [];
  for (let i = 0; i < STUDENT_SPECS.length; i++) {
    const spec = STUDENT_SPECS[i];
    const student = await prisma.student.create({
      data: {
        workspaceId: workspace.id,
        tutorId: tutors[spec.tutorIdx].id,
        name: spec.name,
        payerName: PAYER_NAMES[i],
        contact: `+7 9${String(10 + i).padStart(2, "0")} ***-**-${String(10 + i).padStart(2, "0")}`,
        defaultPrice: spec.price,
        commissionType: "Percent",
        commissionValue: spec.commission,
        status: "Active",
      },
    });
    students.push(student);
  }

  const prevWeek = getPreviousWeekBounds(new Date(), 1);
  const currWeek = getWeekBounds(new Date(), 1);
  const currWeekKey = `${currWeek.start.getFullYear()}-${String(currWeek.start.getMonth() + 1).padStart(2, "0")}-${String(currWeek.start.getDate()).padStart(2, "0")}`;

  // Шаблон расписания (текущая неделя материализуется при открытии)
  const slotSpecs = [
    { studentIdx: 0, tutorIdx: 0, weekday: 1, startTime: "11:00" },
    { studentIdx: 0, tutorIdx: 0, weekday: 3, startTime: "11:00" },
    { studentIdx: 1, tutorIdx: 0, weekday: 2, startTime: "16:00" },
    { studentIdx: 2, tutorIdx: 0, weekday: 5, startTime: "10:00" },
    { studentIdx: 3, tutorIdx: 1, weekday: 1, startTime: "14:00" },
    { studentIdx: 4, tutorIdx: 1, weekday: 4, startTime: "18:00" },
  ];

  for (const spec of slotSpecs) {
    await prisma.scheduleSlot.create({
      data: {
        workspaceId: workspace.id,
        tutorId: tutors[spec.tutorIdx].id,
        studentId: students[spec.studentIdx].id,
        weekday: spec.weekday,
        startTime: spec.startTime,
        durationMin: 60,
        isActive: true,
      },
    });
  }

  // Прошлая неделя — проведённые уроки (основа для выплат)
  const prevLessonPlan = [
    { studentIdx: 0, days: [0, 2, 4] },
    { studentIdx: 1, days: [1, 3] },
    { studentIdx: 3, days: [0, 2] },
  ];

  const prevDoneLessons: Lesson[] = [];
  for (const plan of prevLessonPlan) {
    const student = students[plan.studentIdx];
    for (const day of plan.days) {
      const lesson = await prisma.lesson.create({
        data: buildLessonCreateData(student, {
          workspaceId: workspace.id,
          studentId: student.id,
          tutorId: student.tutorId,
          scheduledAt: dayOffset(prevWeek.start, day, 11),
          status: "Done",
          createdById: student.tutorId,
        }),
      });
      prevDoneLessons.push(lesson);
    }
  }

  // Текущая неделя — уже проведённые + запланированные
  const currDonePlan = [
    { studentIdx: 0, day: 0, hour: 11 },
    { studentIdx: 1, day: 1, hour: 16 },
    { studentIdx: 3, day: 0, hour: 14 },
    { studentIdx: 4, day: 2, hour: 18 },
  ];

  const currDoneLessons: Lesson[] = [];
  for (const plan of currDonePlan) {
    const student = students[plan.studentIdx];
    const lesson = await prisma.lesson.create({
      data: buildLessonCreateData(student, {
        workspaceId: workspace.id,
        studentId: student.id,
        tutorId: student.tutorId,
        scheduledAt: dayOffset(currWeek.start, plan.day, plan.hour),
        status: "Done",
        createdById: student.tutorId,
      }),
    });
    currDoneLessons.push(lesson);
  }

  // Запланированные из шаблона слотов
  for (const spec of slotSpecs) {
    const student = students[spec.studentIdx];
    const scheduledAt = scheduledAtFromSlot(
      currWeekKey,
      spec.weekday,
      spec.startTime,
      tutors[spec.tutorIdx].timezone ?? "Europe/Moscow"
    );
    const exists = await prisma.lesson.findFirst({
      where: {
        workspaceId: workspace.id,
        studentId: student.id,
        scheduledAt,
      },
    });
    if (!exists) {
      const slot = await prisma.scheduleSlot.findFirst({
        where: {
          workspaceId: workspace.id,
          studentId: student.id,
          weekday: spec.weekday,
          startTime: spec.startTime,
        },
      });
      await prisma.lesson.create({
        data: {
          ...buildLessonCreateData(student, {
            workspaceId: workspace.id,
            studentId: student.id,
            tutorId: student.tutorId,
            scheduledAt,
            status: "Planned",
            createdById: student.tutorId,
          }),
          scheduleSlotId: slot?.id,
        },
      });
    }
  }

  const receiptsDir = path.join(process.cwd(), "data", "receipts", workspace.id);
  await mkdir(receiptsDir, { recursive: true });

  async function createReceipt(name: string, uploadedById: string) {
    const receiptPath = path.join(receiptsDir, `${name}.txt`);
    await writeFile(receiptPath, `Чек: ${name}`);
    return prisma.receiptFile.create({
      data: {
        workspaceId: workspace.id,
        path: receiptPath,
        mime: "text/plain",
        size: 20,
        uploadedById,
      },
    });
  }

  const receipt1 = await createReceipt("katya-payment", tutorAlex.id);
  const receipt2 = await createReceipt("misha-payment", tutorAlex.id);
  const receipt3 = await createReceipt("dasha-payment", tutorMaria.id);
  const receipt4 = await createReceipt("artem-pending", tutorMaria.id);
  const readBack = await readFile(path.join(receiptsDir, "katya-payment.txt"));
  if (readBack.toString() !== "Чек: katya-payment") {
    throw new Error("Receipt file IO failed");
  }

  // Подтверждённые оплаты (прошлая + текущая неделя)
  const confirmedPayments = [
    {
      studentIdx: 0,
      amount: 6000,
      reportedAt: dayOffset(prevWeek.start, 4, 19),
      lessonIds: prevDoneLessons.filter((l) => l.studentId === students[0].id).map((l) => l.id),
      receiptId: receipt1.id,
      tutorId: tutorAlex.id,
    },
    {
      studentIdx: 1,
      amount: 5000,
      reportedAt: dayOffset(prevWeek.start, 5, 20),
      lessonIds: prevDoneLessons.filter((l) => l.studentId === students[1].id).map((l) => l.id),
      receiptId: receipt2.id,
      tutorId: tutorAlex.id,
    },
    {
      studentIdx: 3,
      amount: 4400,
      reportedAt: dayOffset(prevWeek.start, 3, 18),
      lessonIds: prevDoneLessons.filter((l) => l.studentId === students[3].id).map((l) => l.id),
      receiptId: receipt3.id,
      tutorId: tutorMaria.id,
    },
    {
      studentIdx: 0,
      amount: 2000,
      reportedAt: dayOffset(currWeek.start, 0, 21),
      lessonIds: currDoneLessons.filter((l) => l.studentId === students[0].id).map((l) => l.id),
      receiptId: null,
      tutorId: tutorAlex.id,
    },
  ];

  for (const p of confirmedPayments) {
    const student = students[p.studentIdx];
    const confirmedAt = new Date(p.reportedAt);
    confirmedAt.setHours(confirmedAt.getHours() + 2);
    await prisma.payment.create({
      data: {
        workspaceId: workspace.id,
        studentId: student.id,
        tutorId: p.tutorId,
        amount: p.amount,
        status: "Confirmed",
        receiptFileId: p.receiptId ?? undefined,
        reportedById: p.tutorId,
        reportedAt: p.reportedAt,
        confirmedById: distributor.id,
        confirmedAt,
        lessons: {
          create: p.lessonIds.slice(0, 3).map((lessonId) => ({ lessonId })),
        },
      },
    });
  }

  const artemLesson = currDoneLessons.find((l) => l.studentId === students[4].id)!;

  // Очередь на подтверждение (текущая неделя)
  await prisma.payment.create({
    data: {
      workspaceId: workspace.id,
      studentId: students[4].id,
      tutorId: tutorMaria.id,
      amount: 3000,
      status: "Reported",
      receiptFileId: receipt4.id,
      reportedById: tutorMaria.id,
      reportedAt: dayOffset(currWeek.start, 2, 17),
      note: "Оплата за урок",
      lessons: { create: [{ lessonId: artemLesson.id }] },
    },
  });

  await prisma.payment.create({
    data: {
      workspaceId: workspace.id,
      studentId: students[2].id,
      tutorId: tutorAlex.id,
      amount: 1800,
      status: "Reported",
      reportedById: tutorAlex.id,
      reportedAt: dayOffset(currWeek.start, 1, 12, 30),
      note: "Перевод от плательщика",
    },
  });

  const settlement = await upsertWeeklyPayouts(workspace.id, 1);

  // Контрольный пример из брифа: Катя 2000, 25%, 3 урока
  const katyaPrevLessons = prevDoneLessons.filter((l) => l.studentId === students[0].id);
  const amounts = calculateLessonAmounts({
    price: 2000,
    commissionType: "Percent",
    commissionValue: 25,
  });
  if (amounts.tutorAmount.toNumber() !== 1500 || amounts.commissionAmount.toNumber() !== 500) {
    throw new Error("Brief calculation example failed");
  }
  if (katyaPrevLessons.length !== 3) {
    throw new Error(`Expected 3 Katya prev lessons, got ${katyaPrevLessons.length}`);
  }
  const katyaTutorTotal = katyaPrevLessons.reduce((s, l) => s + Number(l.tutorAmount), 0);
  if (katyaTutorTotal !== 4500) {
    throw new Error(`Katya tutor total mismatch: ${katyaTutorTotal}`);
  }

  const alexPayout = settlement.payouts.find((p) => p.tutorId === tutorAlex.id);
  const mariaPayout = settlement.payouts.find((p) => p.tutorId === tutorMaria.id);
  if (!alexPayout || !mariaPayout) {
    throw new Error("Missing tutor payouts after settlement");
  }

  const pendingCount = await prisma.payment.count({
    where: { workspaceId: workspace.id, status: "Reported" },
  });
  const confirmedCount = await prisma.payment.count({
    where: { workspaceId: workspace.id, status: "Confirmed" },
  });
  const lessonCount = await prisma.lesson.count({ where: { workspaceId: workspace.id } });

  console.log("Seed OK — демо как после недели работы:");
  console.log(`  workspace: ${workspace.id}`);
  console.log(`  distributor: ${distributor.firstName} (${distributor.id})`);
  console.log(`  tutors: ${tutorAlex.firstName}, ${tutorMaria.firstName}`);
  console.log(`  students: ${students.length} (с payerName)`);
  console.log(`  lessons: ${lessonCount}`);
  console.log(`  payments: ${confirmedCount} confirmed, ${pendingCount} in queue`);
  console.log(`  payouts pending: ${settlement.payouts.length}`);
  console.log(`    ${tutorAlex.firstName}: ${alexPayout.netAmount} ₽ (${alexPayout.lessonCount} уроков)`);
  console.log(`    ${tutorMaria.firstName}: ${mariaPayout.netAmount} ₽ (${mariaPayout.lessonCount} уроков)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
