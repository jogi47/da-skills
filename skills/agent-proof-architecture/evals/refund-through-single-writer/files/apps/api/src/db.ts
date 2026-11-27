export type OrderStatus = 'placed' | 'shipped' | 'cancelled';
export interface OrderRow { id: string; customerEmail: string; totalPence: number; status: OrderStatus; updatedAt: Date }

// Stand-in for the real database client.
export const db = {
  orders: {
    rows: new Map<string, OrderRow>(),
    async get(id: string) { return this.rows.get(id) ?? null; },
    async update(id: string, patch: Partial<OrderRow>) {
      const row = this.rows.get(id);
      if (!row) throw new Error(`order ${id} not found`);
      this.rows.set(id, { ...row, ...patch });
    },
    async insert(row: OrderRow) { this.rows.set(row.id, row); },
  },
};
