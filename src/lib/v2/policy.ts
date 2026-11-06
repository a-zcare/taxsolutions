import type { StaffRole, Prisma } from '@prisma/client';
export type Actor = {
  id: string;
  role: StaffRole;
  email: string;
  name: string;
  locale: string;
};
export function manager(actor: Actor) {
  return actor.role === 'OWNER' || actor.role === 'ADMIN';
}
export function assertManager(actor: Actor) {
  if (!manager(actor)) throw Error('FORBIDDEN');
}
export function assertOwner(actor: Actor) {
  if (actor.role !== 'OWNER') throw Error('FORBIDDEN');
}
export function assertAssigned(actor: Actor, assignedId: string | null) {
  if (!manager(actor) && assignedId !== actor.id) throw Error('NOT_FOUND');
}
export const bookingScope = (actor: Actor): Prisma.BookingWhereInput =>
  manager(actor) ? {} : { staffId: actor.id };
export const taskScope = (actor: Actor): Prisma.TaskWhereInput =>
  manager(actor) ? {} : { assignedId: actor.id };
export const clientScope = (actor: Actor): Prisma.ClientWhereInput =>
  manager(actor)
    ? {}
    : {
        OR: [
          { ownerId: actor.id },
          { bookings: { some: { staffId: actor.id } } },
          { tasks: { some: { assignedId: actor.id } } },
        ],
      };
