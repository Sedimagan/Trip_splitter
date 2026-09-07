export type SplitType = "SELF" | "EQUAL" | "CUSTOM";

export interface ComputedSplit {
  userId: string;
  amount: number;
}

/** Divides `amount` evenly across `userIds`, distributing the rounding remainder (in cents) across the first few participants so the split always sums exactly to `amount`. */
export function divideEqually(amount: number, userIds: string[]): ComputedSplit[] {
  if (userIds.length === 0) return [];
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / userIds.length);
  let remainder = totalCents - baseCents * userIds.length;

  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { userId, amount: (baseCents + extra) / 100 };
  });
}

export function computeSplits(
  splitType: SplitType,
  amount: number,
  paidById: string,
  allMemberIds: string[],
  participantUserIds: string[] | undefined
): ComputedSplit[] {
  if (splitType === "SELF") {
    return [{ userId: paidById, amount }];
  }
  if (splitType === "EQUAL") {
    return divideEqually(amount, allMemberIds);
  }
  // CUSTOM: split equally among the selected subset of trip members.
  const participants =
    participantUserIds && participantUserIds.length > 0 ? participantUserIds : [paidById];
  return divideEqually(amount, participants);
}
