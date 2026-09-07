import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth";
import tripRoutes from "./routes/trips";
import expenseRoutes from "./routes/expenses";
import { prisma } from "./lib/prisma";
import { setIo, tripRoom } from "./lib/realtime";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/expenses", expenseRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
setIo(io);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("Missing auth token"));
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    (socket as any).userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid auth token"));
  }
});

io.on("connection", (socket) => {
  socket.on("join-trip", async (tripId: string) => {
    const userId = (socket as any).userId as string;
    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });
    if (membership) {
      socket.join(tripRoom(tripId));
    }
  });

  socket.on("leave-trip", (tripId: string) => {
    socket.leave(tripRoom(tripId));
  });
});

const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => {
  console.log(`Trip Splitter API listening on port ${PORT}`);
});
