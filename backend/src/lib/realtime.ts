import { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setIo(io: Server) {
  ioInstance = io;
}

export function tripRoom(tripId: string) {
  return `trip:${tripId}`;
}

export function emitToTrip(tripId: string, event: string, payload: unknown) {
  ioInstance?.to(tripRoom(tripId)).emit(event, payload);
}
