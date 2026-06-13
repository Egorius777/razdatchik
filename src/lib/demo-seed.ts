import type { Lesson, PrismaClient, Student, User, Workspace } from "@prisma/client";
import { calculateLessonAmounts } from "./money";
import { buildLessonCreateData, upsertWeeklyPayouts } from "./settlement";
import { scheduledAtFromSlot } from "./schedule";
import { getPreviousWeekBounds, getWeekBounds } from "./utils";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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

export type DemoSeedSummary = {
  workspaceId: string;
  workspaceName: string;
  distributor: { id: string; name: string; telegramId: string };
  tutors: Array<{ id: string; name: string; telegramId: string }>;
  students: number;
  lessons: number;
  paymentsConfirmed: number;
  paymentsPending: number;
  payoutsPending: number;
};

function dayOffset(base: Date, days: number, hour = 11, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function userLabel(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || user.id;
}

async function clearWorkspaceData(prisma: PrismaClient, workspaceId: string) {
  await prisma.paymentLesson.deleteMany({ where: { payment: { workspaceId } } });
  await prisma.payment.deleteMany({ where: { workspaceId } });
  await prisma.lesson.deleteMany({ where: { workspaceId } });
  await prisma.scheduleSlot.deleteMany({ where: { workspaceId } });
  await prisma.payout.deleteMany({ where: { workspaceId } });
  await prisma.student.deleteMany({ where: { workspaceId } });
  await prisma.receiptFile.deleteMany({ where: { workspaceId } });
}

async function resolveSeedActors(prisma: PrismaClient): Promise<{
  workspace: Workspace;
  distributor: User;
  tutors: User[];
}> {
  const distTg = process.env.SEED_DISTRIBUTOR_TELEGRAM_ID;
  const tutorTg = process.env.SEED_TUTOR_TELEGRAM_ID;

  if (distTg && tutorTg) {
    const distributor = await prisma.user.findUnique({ where: { telegramId: BigInt(distTg) } });
    const tutor = await prisma.user.findUnique({ where: { telegramId: BigInt(tutorTg) } });
    if (!distributor || !tutor) {
      throw new Error("SEED_*_TELEGRAM_ID: пользователь не найден в БД. Сначала зайдите в Mini App.");
    }

    let workspace = await prisma.workspace.findFirst({ where: { ownerUserId: distributor.id } });
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: "Моя сеть",
          ownerUserId: distributor.id,
          cardDetails: "4276 **** **** 1234 (Сбер)",
          settlementWeekday: 1,
        },
      });
    }

    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: distributor.id } },
      create: { workspaceId: workspace.id, userId: distributor.id, role: "Distributor", status: "Active" },
      update: { role: "Distributor", status: "Active" },
    });
    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: tutor.id } },
      create: { workspaceId: workspace.id, userId: tutor.id, role: "Tutor", status: "Active" },
      update: { role: "Tutor", status: "Active" },
    });

    return { workspace, distributor, tutors: [tutor] };
  }

  const workspaces = await prisma.workspace.findMany({
    include: {
      owner: true,
      memberships: { where: { status: "Active" }, include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const workspace =
    workspaces.find((w) => w.owner.telegramId !== BigInt(1001)) ?? workspaces[0];

  if (!workspace) {
    throw new Error("Нет workspace. Зайдите как раздатчик и создайте сеть в Mini App.");
  }

  const distributor = workspace.owner;
  let tutors = workspace.memberships.filter((m) => m.role === "Tutor").map((m) => m.user);

  if (tutors.length === 0) {
    const otherUser = await prisma.user.findFirst({
      where: { id: { not: distributor.id } },
      orderBy: { createdAt: "asc" },
    });
    if (!otherUser) {
      throw new Error(
        "Нужен второй аккаунт (репетитор). Зайдите им в Mini App хотя бы один раз."
      );
    }
    await prisma.membership.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: otherUser.id },
      },
      create: {
        workspaceId: workspace.id,
        userId: otherUser.id,
        role: "Tutor",
        status: "Active",
      },
      update: { role: "Tutor", status: "Active" },
    });
    tutors = [otherUser];
  }

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: distributor.id } },
    create: { workspaceId: workspace.id, userId: distributor.id, role: "Distributor", status: "Active" },
    update: { role: "Distributor", status: "Active" },
  });

  return { workspace, distributor, tutors: tutors.slice(0, 2) };
}

export async function runDemoSeed(prisma: PrismaClient): Promise<DemoSeedSummary> {
  const { workspace, distributor, tutors: rawTutors } = await resolveSeedActors(prisma);

  const tutorAlex = rawTutors[0];
  const tutorMaria = rawTutors[1] ?? rawTutors[0];
  const tutors = rawTutors.length >= 2 ? [tutorAlex, tutorMaria] : [tutorAlex];
  const twoTutors = rawTutors.length >= 2;

  await prisma.user.update({
    where: { id: distributor.id },
    data: { timezone: distributor.timezone ?? "Europe/Moscow" },
  });
  await prisma.user.update({
    where: { id: tutorAlex.id },
    data: { timezone: tutorAlex.timezone ?? "Asia/Yekaterinburg" },
  });
  if (twoTutors) {
    await prisma.user.update({
      where: { id: tutorMaria.id },
      data: { timezone: tutorMaria.timezone ?? "Europe/Moscow" },
    });
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      cardDetails: workspace.cardDetails ?? "4276 **** **** 1234 (Сбер)",
      settlementWeekday: workspace.settlementWeekday || 1,
    },
  });

  await clearWorkspaceData(prisma, workspace.id);

  const studentSpecs = twoTutors
    ? STUDENT_SPECS
    : STUDENT_SPECS.map((s) => ({ ...s, tutorIdx: 0 }));

  const students: Student[] = [];
  for (let i = 0; i < studentSpecs.length; i++) {
    const spec = studentSpecs[i];
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

  const slotSpecs = [
    { studentIdx: 0, tutorIdx: 0, weekday: 1, startTime: "11:00" },
    { studentIdx: 0, tutorIdx: 0, weekday: 3, startTime: "11:00" },
    { studentIdx: 1, tutorIdx: 0, weekday: 2, startTime: "16:00" },
    { studentIdx: 2, tutorIdx: 0, weekday: 5, startTime: "10:00" },
    { studentIdx: 3, tutorIdx: twoTutors ? 1 : 0, weekday: 1, startTime: "14:00" },
    { studentIdx: 4, tutorIdx: twoTutors ? 1 : 0, weekday: 4, startTime: "18:00" },
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

  const prevLessonPlan = twoTutors
    ? [
        { studentIdx: 0, days: [0, 2, 4] },
        { studentIdx: 1, days: [1, 3] },
        { studentIdx: 3, days: [0, 2] },
      ]
    : [
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

  for (const spec of slotSpecs) {
    const student = students[spec.studentIdx];
    const tz = tutors[spec.tutorIdx].timezone ?? "Europe/Moscow";
    const scheduledAt = scheduledAtFromSlot(currWeekKey, spec.weekday, spec.startTime, tz);
    const existing = await prisma.lesson.findFirst({
      where: { workspaceId: workspace.id, studentId: student.id, scheduledAt },
    });
    if (existing) continue;

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

  const receiptsBase = process.env.RECEIPTS_DIR ?? path.join(process.cwd(), "data", "receipts");
  const receiptsDir = path.join(receiptsBase, workspace.id);
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

  const amounts = calculateLessonAmounts({
    price: 2000,
    commissionType: "Percent",
    commissionValue: 25,
  });
  if (amounts.tutorAmount.toNumber() !== 1500 || amounts.commissionAmount.toNumber() !== 500) {
    throw new Error("Brief calculation example failed");
  }

  const katyaPrevLessons = prevDoneLessons.filter((l) => l.studentId === students[0].id);
  if (katyaPrevLessons.length !== 3) {
    throw new Error(`Expected 3 Katya prev lessons, got ${katyaPrevLessons.length}`);
  }

  const pendingCount = await prisma.payment.count({
    where: { workspaceId: workspace.id, status: "Reported" },
  });
  const confirmedCount = await prisma.payment.count({
    where: { workspaceId: workspace.id, status: "Confirmed" },
  });
  const lessonCount = await prisma.lesson.count({ where: { workspaceId: workspace.id } });

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    distributor: {
      id: distributor.id,
      name: userLabel(distributor),
      telegramId: distributor.telegramId.toString(),
    },
    tutors: tutors.map((t) => ({
      id: t.id,
      name: userLabel(t),
      telegramId: t.telegramId.toString(),
    })),
    students: students.length,
    lessons: lessonCount,
    paymentsConfirmed: confirmedCount,
    paymentsPending: pendingCount,
    payoutsPending: settlement.payouts.length,
  };
}
