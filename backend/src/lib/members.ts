import { prisma } from "./prisma";

export interface InviteInput {
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * Finds an existing user by email/phone, or creates a placeholder account so the
 * invitee shows up as a trip member immediately. When they later sign up with the
 * same email/phone, the signup flow "claims" this placeholder record.
 */
export async function findOrCreateInvitedUser(invite: InviteInput) {
  const { name, email, phone } = invite;
  if (!email && !phone) {
    throw new Error("Each invited member needs an email or phone number");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(
        Boolean
      ) as any,
    },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: name || email || phone || "Invited Traveler",
      email,
      phone,
      isPlaceholder: true,
    },
  });
}
