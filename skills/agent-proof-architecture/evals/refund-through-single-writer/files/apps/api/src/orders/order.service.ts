import { db, type OrderRow } from '../db';
import { notify } from '../notifications/notify';

export async function placeOrder(order: Omit<OrderRow, 'status' | 'updatedAt'>) {
  await db.orders.insert({ ...order, status: 'placed', updatedAt: new Date() });
  await notify({ type: 'order.placed', orderId: order.id, email: order.customerEmail });
}

export async function markShipped(orderId: string) {
  const order = await db.orders.get(orderId);
  if (!order) throw new Error('not found');
  if (order.status !== 'placed') throw new Error(`cannot ship an order that is ${order.status}`);
  await db.orders.update(orderId, { status: 'shipped', updatedAt: new Date() });
  await notify({ type: 'order.shipped', orderId, email: order.customerEmail });
}
