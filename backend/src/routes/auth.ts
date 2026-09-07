import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken, requireAuth, AuthedRequest } from "../lib/auth";

const router = Router();

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone is required",
  });

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(
        Boolean
      ) as any,
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    if (!existing.isPlaceholder) {
      return res.status(409).json({ error: "An account with this email/phone already exists" });
    }
    // Claim a placeholder account created when someone invited this person to a trip.
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        passwordHash,
        isPlaceholder: false,
      },
    });
    const token = signToken(user.id);
    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  }

  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash },
  });
  const token = signToken(user.id);
  return res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
  });
});

const loginSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    password: z.string().min(1),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone is required",
  });

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, phone, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(
        Boolean
      ) as any,
    },
  });

  if (!user || !user.passwordHash || user.isPlaceholder) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(user.id);
  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
  });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone });
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

/**
 * Soft-deletes the account: the user is scrubbed of personal info and can no
 * longer log in, but their id and historical expenses/splits stay in place
 * so trip balances for other members keep adding up correctly. Requires the
 * current password so a stolen/leaked (but not yet expired) token can't be
 * used to destroy the account.
 */
router.delete("/me", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || !user.passwordHash) {
    return res.status(404).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: "Deleted user",
      email: null,
      phone: null,
      passwordHash: null,
      deletedAt: new Date(),
    },
  });

  return res.status(204).send();
});

export default router;
