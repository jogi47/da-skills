import { formatMoney } from '../../../../packages/core/src';
import { markShipped } from '../../../api/src/orders/order.service';
import type { OrderRow } from '../../../api/src/db';

export function OrderPage({ order }: { order: OrderRow }) {
  return (
    <div>
      <h1>Order {order.id}</h1>
      <p>{formatMoney(order.totalPence)}</p>
      <button onClick={() => markShipped(order.id)}>Mark shipped</button>
    </div>
  );
}
