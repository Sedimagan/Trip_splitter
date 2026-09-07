import { io, Socket } from "socket.io-client";
import { API_URL } from "./client";

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket && socket.connected && (socket.auth as any)?.token === token) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
  }
  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
