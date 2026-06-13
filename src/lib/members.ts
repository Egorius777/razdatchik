import { prisma } from "./db";
import { formatPersonName, type PersonRef } from "./people";

export async function loadUsersByIds(
  ids: string[]
): Promise<Map<string, PersonRef & { id: string }>> {
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, username: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

export async function attachTutorToPayouts<T extends { tutorId: string }>(payouts: T[]) {
  const map = await loadUsersByIds([...new Set(payouts.map((p) => p.tutorId))]);
  return payouts.map((p) => {
    const tutor = map.get(p.tutorId) ?? null;
    return {
      ...p,
      tutor,
      tutorName: formatPersonName(tutor),
    };
  });
}
