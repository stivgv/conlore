export interface User {
  id: string;
  role: 'admin' | 'member';
  name: string;
  email: string;
  created_at: string;
}

export interface Court {
  id: string;
  name: string;
  surface_type: string;
  is_active: boolean;
  open_time: string;
  close_time: string;
}

export interface Booking {
  id: string;
  user_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: string;
}
