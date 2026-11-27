import { ordersRoutes } from './orders/orders.routes';
import { adminRoutes } from './admin/admin.routes';

// Every new route file must be added here.
export const routes = { ...ordersRoutes, ...adminRoutes };
