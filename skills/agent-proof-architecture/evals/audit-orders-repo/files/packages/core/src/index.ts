import { DEFAULT_CURRENCY } from '../../../apps/api/src/config';

export function formatMoney(pence: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100);
}
