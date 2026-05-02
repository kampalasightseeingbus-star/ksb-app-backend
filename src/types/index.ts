export interface User {
  id: number;
  full_name: string;
  phone: string;
  email?: string;
  password_hash: string;
  role: 'passenger' | 'driver' | 'admin';
  created_at: Date;
}

export interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  duration_minutes: number;
  price_ugx: number;
  created_at: Date;
}

export interface Bus {
  id: number;
  plate_number: string;
  model: string;
  total_seats: number;
  driver_id: number;
  route_id: number;
  created_at: Date;
}

export interface Schedule {
  id: number;
  route_id: number;
  bus_id: number;
  departure_time: Date;
  arrival_time: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: Date;
}

export interface Booking {
  id: number;
  user_id: number;
  schedule_id: number;
  seat_number: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  total_amount: number;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  qr_code: string;
  created_at: Date;
}

export interface Payment {
  id: number;
  booking_id: number;
  user_id: number;
  amount: number;
  currency: string;
  method: string;
  provider_ref: string;
  status: 'pending' | 'success' | 'failed';
  created_at: Date;
}

export interface AuthRequest extends Express.Request {
  user?: {
    id: number;
    role: string;
  };
}
