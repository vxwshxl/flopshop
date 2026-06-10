export type Role = "user" | "delivery" | "admin" | "banned";

export type OrderType = "pickup" | "delivery";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "upi" | "split";
export type PaymentStatus = "pending" | "paid";

export interface Hostel {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Walk-in customer (not a login account) — used to pre-fill manual orders. */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  room_number: string | null;
  hostel_block: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  room_number: string | null;
  hostel_block: string | null;
  role: Role;
  is_active: boolean;
  is_online: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  image_url: string | null;
  details: ProductDetails | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}

/** Extra info imported from OpenFoodFacts. */
export interface ProductDetails {
  source?: string;
  off_code?: string;
  brand?: string;
  quantity?: string;
  ingredients?: string;
  categories?: string;
  /** How the image is framed inside its square: object-position x/y (0–100%) and zoom. */
  image_position?: { x: number; y: number; scale: number };
  nutrition?: {
    energy_kcal?: number | null;
    fat?: number | null;
    carbs?: number | null;
    sugars?: number | null;
    protein?: number | null;
    salt?: number | null;
  };
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  /** Cost price snapshot at order time — profit history must not move when a product's cost is later edited. */
  cost_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_room: string | null;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  delivery_person_earning: number;
  admin_delivery_earning: number;
  total_amount: number;
  delivery_person_id: string | null;
  otp_code: string | null;
  payment_method: PaymentMethod;
  /** For split payments: amount paid by cash / UPI (sum to total_amount). */
  paid_cash: number;
  paid_upi: number;
  payment_status: PaymentStatus;
  notes: string | null;
  is_manual: boolean;
  invoice_number: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  delivery_person?: Pick<Profile, "id" | "full_name"> | null;
}

export interface Purchase {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  supplier: string | null;
  purchase_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  label: string | null;
  updated_at: string;
}

export type SettingsMap = Record<string, string>;

// Cart (client-side, Zustand)
export interface CartItem {
  id: string; // product id
  name: string;
  price: number; // selling_price
  image_url: string | null;
  current_stock: number;
  quantity: number;
}
