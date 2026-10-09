export type Location = {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
};

export type Customer = {
  name: string;
  phone: string;
};

export type Order = {
  id: string;
  total: number;
};

export type OrderResult =
  | {
      ok: true;
      created: boolean;
      orderId: string;
      total: number;
      note?: string;
    }
  | { ok: false; reason: string };

export type NewOrder = {
  locationId: string;
  clientRef: string;
  customer: Customer;
  itemId: string;
  quantity: number;
};

export type SubmitResult =
  | {
      accepted: true;
      orderId: string;
      total: number;
    }
  | {
      accepted: false;
      reason: string;
    };

export interface PosClient {
  getLocations(): Promise<Location[]>;
  getMenu(locationId: string): Promise<MenuItem[]>;
  findOrdersByRef(ref: string): Promise<Order[]>;
  submitOrder(order: NewOrder): Promise<SubmitResult>;
}