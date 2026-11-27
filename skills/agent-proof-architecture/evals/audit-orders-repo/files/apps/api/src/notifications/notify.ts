type Event =
  | { type: 'order.placed'; orderId: string; email: string }
  | { type: 'order.shipped'; orderId: string; email: string };

export async function notify(event: Event) {
  switch (event.type) {
    case 'order.placed':
      return sendEmail(event.email, 'Thanks for your order', `Order ${event.orderId} is confirmed.`);
    case 'order.shipped':
      return sendEmail(event.email, 'Your order is on its way', `Order ${event.orderId} has shipped.`);
  }
}

async function sendEmail(to: string, subject: string, body: string) {
  console.log('email', { to, subject, body });
}
