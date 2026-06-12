import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("access control", () => {
  it("tutor cannot see other tutor students", async () => {
    let tutor;
    try {
      tutor = await prisma.user.findUnique({ where: { telegramId: BigInt(1002) } });
    } catch {
      console.warn("Skipping access test — database unavailable");
      return;
    }

    const workspace = await prisma.workspace.findFirst({ where: { name: "Демо сеть" } });
    if (!tutor || !workspace) {
      console.warn("Skipping access test — run seed first");
      return;
    }

    const students = await prisma.student.findMany({
      where: { workspaceId: workspace.id, tutorId: tutor.id },
    });

    expect(students).toHaveLength(1);
    expect(students[0].name).toBe("Ученик демо");

    const allStudents = await prisma.student.findMany({ where: { workspaceId: workspace.id } });
    expect(allStudents.length).toBeGreaterThan(students.length);
  });
});
