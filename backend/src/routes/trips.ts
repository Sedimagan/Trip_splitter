import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { findOrCreateInvitedUser } from "../lib/members";
import { computeTripSummary } from "../lib/balances";
import { emitToTrip, tripRoom } from "../lib/realtime";

const router = Router();
router.use(requireAuth);

const memberInputSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).optional(),
});

const createTripSchema = z.object({
  name: z.string().min(1, "Trip name is required"),
  currency: z.string().min(1).default("USD"),
  members: z.array(memberInputSchema).default([]),
});

async function assertMember(tripId: string, userId: string) {
  const membership = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  return !!membership;
}

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createTripSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, currency, members } = parsed.data;
  const ownerId = req.userId!;

  const invitedUsers = await Promise.all(
    members.map((m) => findOrCreateInvitedUser(m))
  );

  const memberIds = new Set<string>([ownerId, ...invitedUsers.map((u) => u.id)]);

  const trip = await prisma.trip.create({
    data: {
      name,
      currency,
      createdById: ownerId,
      members: {
        create: Array.from(memberIds).map((userId) => ({
          userId,
          role: userId === ownerId ? "OWNER" : "MEMBER",
        })),
      },
    },
    include: { members: { include: { user: true } } },
  });

  return res.status(201).json(serializeTrip(trip));
});

router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const memberships = await prisma.tripMember.findMany({
    where: { userId },
    include: {
      trip: {
        include: {
          members: { include: { user: true } },
          expenses: { include: { splits: true } },
        },
      },
    },
    orderBy: { trip: { createdAt: "desc" } },
  });

  const trips = memberships.map(({ trip }) => {
    const summary = computeTripSummary(
      trip.members.map((m) => ({ id: m.user.id, name: m.user.name })),
      trip.expenses
    );
    return {
      ...serializeTrip(trip),
      totalExpense: summary.totalExpense,
      myBalance: summary.balances.find((b) => b.userId === userId)?.net ?? 0,
      expenseCount: trip.expenses.length,
    };
  });

  return res.json(trips);
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const tripId = req.params.id;
  const userId = req.userId!;
  if (!(await assertMember(tripId, userId))) {
    return res.status(403).json({ error: "You are not a member of this trip" });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: { include: { user: true } },
      expenses: {
        include: {
          splits: { include: { user: true } },
          paidBy: true,
          createdBy: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  const summary = computeTripSummary(
    trip.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    trip.expenses
  );

  return res.json({
    ...serializeTrip(trip),
    expenses: trip.expenses.map(serializeExpense),
    summary,
  });
});

router.post("/:id/members", async (req: AuthedRequest, res) => {
  const tripId = req.params.id;
  const userId = req.userId!;
  if (!(await assertMember(tripId, userId))) {
    return res.status(403).json({ error: "You are not a member of this trip" });
  }
  const parsed = memberInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const invited = await findOrCreateInvitedUser(parsed.data);
  const membership = await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId, userId: invited.id } },
    update: {},
    create: { tripId, userId: invited.id },
    include: { user: true },
  });

  emitToTrip(tripId, "trip:member-added", { tripId, member: serializeMember(membership) });

  return res.status(201).json(serializeMember(membership));
});

function serializeMember(m: { id: string; role: string; user: { id: string; name: string; email: string | null; phone: string | null; isPlaceholder: boolean } }) {
  return {
    id: m.id,
    role: m.role,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    phone: m.user.phone,
    pending: m.user.isPlaceholder,
  };
}

function serializeTrip(trip: any) {
  return {
    id: trip.id,
    name: trip.name,
    currency: trip.currency,
    createdById: trip.createdById,
    createdAt: trip.createdAt,
    members: trip.members.map(serializeMember),
  };
}

function serializeExpense(exp: any) {
  return {
    id: exp.id,
    tripId: exp.tripId,
    title: exp.title,
    description: exp.description,
    amount: exp.amount,
    currency: exp.currency,
    splitType: exp.splitType,
    paidById: exp.paidById,
    paidByName: exp.paidBy.name,
    createdById: exp.createdById,
    createdByName: exp.createdBy.name,
    receiptUrl: exp.receiptUrl,
    createdAt: exp.createdAt,
    updatedAt: exp.updatedAt,
    splits: exp.splits.map((s: any) => ({
      userId: s.userId,
      name: s.user.name,
      amount: s.amount,
    })),
  };
}

export { serializeTrip, serializeExpense, assertMember, tripRoom };
export default router;
