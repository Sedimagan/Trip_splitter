import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { env } from "./env";
import { prisma } from "./prisma";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "30d" });
}

/** Verifies the JWT, then checks the account still exists and hasn't been
 * deleted -- a JWT alone can't be revoked, so a deleted account's existing
 * tokens must be rejected here rather than relying on token expiry. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }
  const token = header.slice("Bearer ".length);
  let userId: string;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) {
    return res.status(401).json({ error: "This account no longer exists" });
  }
  req.userId = user.id;
  next();
}
