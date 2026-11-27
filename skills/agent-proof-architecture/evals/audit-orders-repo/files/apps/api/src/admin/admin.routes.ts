import { db } from '../db';

export const adminRoutes = {
  // Cancel an order from the admin screen.
  'POST /admin/orders/:id/cancel': async (params: { id: string }) => {
    await db.orders.update(params.id, { status: 'cancelled', updatedAt: new Date() });
    return { ok: true };
  },
};
