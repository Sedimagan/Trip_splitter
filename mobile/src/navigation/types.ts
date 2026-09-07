export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  CreateTrip: undefined;
  TripDetail: { tripId: string; tripName: string };
  AddEditExpense: { tripId: string; expenseId?: string };
  DeleteAccount: undefined;
};
