export interface User {
  id: string;
  role: 'admin' | 'member' | 'teacher';
  name: string;
  email: string;
  created_at: string;
  /** Hex color code for teachers (e.g. '#3b82f6'). NULL for admin/member. */
  color_code: string | null;
  /** Mobile phone number, collected at registration. */
  phone: string | null;
}

export interface Court {
  id: string;
  name: string;
  surface_type: string;
  is_active: boolean;
  open_time: string;
  close_time: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'no_show'
export type BookingType = 'member' | 'teacher'

export interface Booking {
  id: string;
  user_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: string;
  /** Nullable: the price may not yet be calculated at insert time */
  total_price: number | null;
  /** Nullable: payment is set asynchronously after booking creation */
  payment_status: PaymentStatus | null;
  /** 'member' for regular bookings, 'teacher' for lesson bookings */
  booking_type: BookingType;
  /** Name of the student — populated only for teacher bookings */
  student_name: string | null;
}
