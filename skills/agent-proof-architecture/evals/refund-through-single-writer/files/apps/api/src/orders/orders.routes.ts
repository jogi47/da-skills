import { placeOrder, markShipped } from './order.service';

export const ordersRoutes = {
  'POST /orders': (body: any) => placeOrder(body),
  'POST /orders/:id/ship': (params: { id: string }) => markShipped(params.id),
};
