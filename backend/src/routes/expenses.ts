import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../lib/auth";
import { computeSplits, SplitType } from "../lib/splitCalc";
import { emitToTrip } from "../lib/realtime";
import { storeReceiptImage } from "../lib/storage";
import { serializeExpense, assertMember } from "./trips";

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image receipts are supported"));
  },
});

router.post("/upload", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = await storeReceiptImage(req.file.buffer, req.file.mimetype);
  return res.status(201).json({ url });
});

const expenseSchema = z.object({
  tripId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().min(1),
  splitType: z.enum(["SELF", "EQUAL", "CUSTOM"]),
  paidById: z.string().min(1),
  participantUserIds: z.array(z.string()).optional(),
  receiptUrl: z.string().optional().nullable(),
});

async function loadTripMemberIds(tripId: string): Promise<string[]> {
  const members = await prisma.tripMember.findMany({ where: { tripId } });
  return members.map((m) => m.userId);
}

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  const userId = req.userId!;

  if (!(await assertMember(data.tripId, userId))) {
    return res.status(403).json({ error: "You are not a member of this trip" });
  }
  const memberIds = await loadTripMemberIds(data.tripId);
  if (!memberIds.includes(data.paidById)) {
    return res.status(400).json({ error: "Payer must be a member of this trip" });
  }
  if (
    data.splitType === "CUSTOM" &&
    (!data.participantUserIds ||
      data.participantUserIds.some((id) => !memberIds.includes(id)))
  ) {
    return res.status(400).json({ error: "Split participants must be trip members" });
  }

  const splits = computeSplits(
    data.splitType as SplitType,
    data.amount,
    data.paidById,
    memberIds,
    data.participantUserIds
  );

  const expense = await prisma.expense.create({
    data: {
      tripId: data.tripId,
      title: data.title,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      splitType: data.splitType,
      paidById: data.paidById,
      createdById: userId,
      receiptUrl: data.receiptUrl ?? undefined,
      splits: { create: splits },
    },
    include: { splits: { include: { user: true } }, paidBy: true, createdBy: true },
  });

  const serialized = serializeExpense(expense);
  emitToTrip(data.tripId, "trip:expense-created", serialized);
  return res.status(201).json(serialized);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const expenseId = req.params.id;
  const userId = req.userId!;

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });
  if (!(await assertMember(existing.tripId, userId))) {
    return res.status(403).json({ error: "You are not a member of this trip" });
  }

  const parsed = expenseSchema.omit({ tripId: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const data = parsed.data;
  const memberIds = await loadTripMemberIds(existing.tripId);
  if (!memberIds.includes(data.paidById)) {
    return res.status(400).json({ error: "Payer must be a member of this trip" });
  }
  if (
    data.splitType === "CUSTOM" &&
    (!data.participantUserIds ||
      data.participantUserIds.some((id) => !memberIds.includes(id)))
  ) {
    return res.status(400).json({ error: "Split participants must be trip members" });
  }

  const splits = computeSplits(
    data.splitType as SplitType,
    data.amount,
    data.paidById,
    memberIds,
    data.participantUserIds
  );

  await prisma.expenseSplit.deleteMany({ where: { expenseId } });
  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      title: data.title,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      splitType: data.splitType,
      paidById: data.paidById,
      receiptUrl: data.receiptUrl ?? undefined,
      splits: { create: splits },
    },
    include: { splits: { include: { user: true } }, paidBy: true, createdBy: true },
  });

  const serialized = serializeExpense(expense);
  emitToTrip(existing.tripId, "trip:expense-updated", serialized);
  return res.json(serialized);
});

export default router;
