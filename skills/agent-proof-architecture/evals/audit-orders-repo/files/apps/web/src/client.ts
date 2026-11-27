export const api = {
  orders: {
    ship: (id: string) => fetch(`/orders/${id}/ship`, { method: 'POST' }),
  },
};
