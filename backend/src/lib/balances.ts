interface SplitRow {
  userId: string;
  amount: number;
}

interface ExpenseForBalance {
  paidById: string;
  amount: number;
  splits: SplitRow[];
}

interface MemberInfo {
  id: string;
  name: string;
}

export interface UserBalance {
  userId: string;
  name: string;
  totalPaid: number;
  totalShare: number;
  net: number; // positive = is owed money, negative = owes money
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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTripSummary(
  members: MemberInfo[],
  expenses: ExpenseForBalance[]
): TripSummary {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  members.forEach((m) => {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  });

  let totalExpense = 0;
  for (const exp of expenses) {
    totalExpense += exp.amount;
    paid.set(exp.paidById, (paid.get(exp.paidById) ?? 0) + exp.amount);
    for (const split of exp.splits) {
      share.set(split.userId, (share.get(split.userId) ?? 0) + split.amount);
    }
  }

  const balances: UserBalance[] = members.map((m) => {
    const totalPaid = round2(paid.get(m.id) ?? 0);
    const totalShare = round2(share.get(m.id) ?? 0);
    return {
      userId: m.id,
      name: m.name,
      totalPaid,
      totalShare,
      net: round2(totalPaid - totalShare),
    };
  });

  const settlements = simplifyDebts(balances);

  return { totalExpense: round2(totalExpense), balances, settlements };
}

function simplifyDebts(balances: UserBalance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ userId: b.userId, name: b.name, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ userId: b.userId, name: b.name, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = round2(Math.min(debtor.amount, creditor.amount));
    if (amount > 0.005) {
      settlements.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount,
      });
    }
    debtor.amount = round2(debtor.amount - amount);
    creditor.amount = round2(creditor.amount - amount);
    if (debtor.amount <= 0.005) i++;
    if (creditor.amount <= 0.005) j++;
  }

  return settlements;
}
