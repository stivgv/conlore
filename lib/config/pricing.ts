// Pricing configuration for court bookings
// Update these values to change pricing across the entire application

export const PRICING = {
  /** Base price per hour in euros */
  PER_HOUR: 20,
  /** Additional fee for court lighting (evening bookings after 18:00) */
  LIGHT_FEE: 5,
  /** Optional ball rental fee */
  BALLS_FEE: 8,
} as const
