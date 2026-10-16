import { prisma } from '../../infrastructure/prisma';

/** Sum of logged hours per task, for the tasks given. */
export async function loggedHoursFor(taskIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!taskIds.length) return map;
  const rows = await prisma.pmTimeEntry.groupBy({
    by: ['taskId'],
    where: { taskId: { in: taskIds }, isDeleted: false },
    _sum: { hours: true },
  });
  for (const r of rows) map.set(r.taskId, Number(r._sum.hours ?? 0));
  return map;
}
