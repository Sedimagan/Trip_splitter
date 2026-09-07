export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface TripMember {
  id: string;
  role: "OWNER" | "MEMBER";
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  pending: boolean;
}

export type SplitType = "SELF" | "EQUAL" | "CUSTOM";

export interface ExpenseSplit {
  userId: string;
  name: string;
  amount: number;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  splitType: SplitType;
  paidById: string;
  paidByName: string;
  createdById: string;
  createdByName: string;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
  splits: ExpenseSplit[];
}

export interface Trip {
  id: string;
  name: string;
  currency: string;
  createdById: string;
  createdAt: string;
  members: TripMember[];
}

export interface TripListItem extends Trip {
  totalExpense: number;
  myBalance: number;
  expenseCount: number;
}

export interface UserBalance {
  userId: string;
  name: string;
  totalPaid: number;
  totalShare: number;
  net: number;
}

export interface Settlement {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

export interface TripSummary {
  totalExpense: number;
  balances: UserBalance[];
  settlements: Settlement[];
}

export interface TripDetail extends Trip {
  expenses: Expense[];
  summary: TripSummary;
}
