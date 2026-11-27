import { db } from '../db';

// Cancels orders that were placed more than 30 days ago and never shipped.
export async function cancelStaleOrders(now = new Date()) {
  for (const order of db.orders.rows.values()) {
    const ageDays = (now.getTime() - order.updatedAt.getTime()) / 86_400_000;
    if (order.status === 'placed' && ageDays > 30) {
      await db.orders.update(order.id, { status: 'cancelled', updatedAt: now });
    }
  }
}
