/** Amounts are stored in the currency's smallest unit, never as floating-point values. */
export type Money = number;

export type PaymentMethod = 'CASH' | 'CARD' | 'KHQR';

export interface ProductSummary {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: Money;
  currency: string;
}

export interface CartLine extends ProductSummary {
  quantity: number;
}
