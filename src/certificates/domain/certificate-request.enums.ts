/** Allowed accident / certificate types (`tipo_constancia`). */
export const ACCIDENT_TYPES = [
  'VIVIENDA',
  'VEHICULAR',
  'ACCIDENTE_TRANSITO',
] as const;
export type AccidentType = (typeof ACCIDENT_TYPES)[number];

/** Lifecycle statuses of a certificate request. */
export const REQUEST_STATUSES = [
  'PENDIENTE',
  'REALIZADA',
  'FIRMADA',
  'RETIRADA',
  'CANCELADA',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Fee payment statuses (`estado_arancel`). */
export const PAYMENT_STATUSES = ['PENDIENTE', 'ABONADO', 'EXENTO'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Accepted payment methods when estado is ABONADO. */
export const PAYMENT_METHODS = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'DEBITO',
  'CREDITO',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
