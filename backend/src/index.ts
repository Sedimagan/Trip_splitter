import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth";
import tripRoutes from "./routes/trips";
import expenseRoutes from "./routes/expenses";
import { prisma } from "./lib/prisma";
import { setIo, tripRoom } from "./lib/realtime";
import { env, assertValidEnv, corsOriginList } from "./lib/env";

assertValidEnv();

const app = express();
app.set("trust proxy", 1); // required for correct client IPs (and rate limiting) behind a reverse proxy/load balancer

app.use(helmet());
app.use(compression());
app.use(cors({ origin: corsOriginList() }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Generous global limit against abuse; auth endpoints get a much stricter one below.
const globalLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/expenses", expenseRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  // Never leak internals (stack traces, driver errors) to clients in production.
  const message = status < 500 || !env.isProduction ? err.message : "Internal server error";
  res.status(status).json({ error: message || "Internal server error" });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOriginList() } });
setIo(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("Missing auth token"));
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    (socket as any).userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid auth token"));
  }
});

io.on("connection", (socket) => {
  socket.on("join-trip", async (tripId: string) => {
    const userId = (socket as any).userId as string;
    if (typeof tripId !== "string") return;
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (membership) {
      socket.join(tripRoom(tripId));
    }
  });

  socket.on("leave-trip", (tripId: string) => {
    if (typeof tripId === "string") socket.leave(tripRoom(tripId));
  });
});

server.listen(env.port, () => {
  console.log(`Trip Splitter API listening on port ${env.port} (${env.nodeEnv})`);
});
