import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "../lib/logger";

interface Room {
  code: string;
  host: WebSocket;
  guest: WebSocket | null;
  hostAlive: boolean;
  guestAlive: boolean;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getUniqueRoomCode(): string {
  let code = generateRoomCode();
  let attempts = 0;
  while (rooms.has(code) && attempts < 100) {
    code = generateRoomCode();
    attempts++;
  }
  return code;
}

function send(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function findRoomBySocket(ws: WebSocket): Room | undefined {
  for (const room of rooms.values()) {
    if (room.host === ws || room.guest === ws) {
      return room;
    }
  }
  return undefined;
}

function cleanupRoom(room: Room) {
  rooms.delete(room.code);
  logger.info({ code: room.code }, "Room cleaned up");
}

function handleDisconnect(ws: WebSocket) {
  const room = findRoomBySocket(ws);
  if (!room) return;

  if (room.host === ws) {
    if (room.guest && room.guest.readyState === WebSocket.OPEN) {
      send(room.guest, { type: "partner_disconnected" });
    }
    cleanupRoom(room);
  } else if (room.guest === ws) {
    room.guest = null;
    if (room.host.readyState === WebSocket.OPEN) {
      send(room.host, { type: "partner_disconnected" });
    }
  }
}

function handleMessage(ws: WebSocket, raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  switch (msg.type) {
    case "create_room": {
      const existing = findRoomBySocket(ws);
      if (existing) {
        handleDisconnect(ws);
      }
      const code = getUniqueRoomCode();
      const room: Room = {
        code,
        host: ws,
        guest: null,
        hostAlive: true,
        guestAlive: true,
      };
      rooms.set(code, room);
      send(ws, { type: "room_created", code });
      logger.info({ code }, "Room created");
      break;
    }

    case "join_room": {
      const existing = findRoomBySocket(ws);
      if (existing) {
        handleDisconnect(ws);
      }
      const code = (msg.code || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: "error", message: "Room not found" });
        return;
      }
      if (room.guest) {
        send(ws, { type: "error", message: "Room is full" });
        return;
      }
      if (room.host === ws) {
        send(ws, { type: "error", message: "Cannot join your own room" });
        return;
      }
      room.guest = ws;
      room.guestAlive = true;
      send(ws, { type: "room_joined", code, role: "guest" });
      send(room.host, { type: "guest_joined" });
      logger.info({ code }, "Guest joined room");
      break;
    }

    case "start_game": {
      const room = findRoomBySocket(ws);
      if (!room || room.host !== ws) return;
      if (!room.guest) return;
      send(room.host, { type: "game_start", role: "host" });
      send(room.guest, { type: "game_start", role: "guest" });
      logger.info({ code: room.code }, "Game started");
      break;
    }

    case "player_input": {
      const room = findRoomBySocket(ws);
      if (!room) return;
      const target = room.host === ws ? room.guest : room.host;
      if (target && target.readyState === WebSocket.OPEN) {
        send(target, { type: "remote_input", inputs: msg.inputs });
      }
      break;
    }

    case "player_pause":
    case "player_unpause": {
      const room = findRoomBySocket(ws);
      if (!room) return;
      const target = room.host === ws ? room.guest : room.host;
      if (target && target.readyState === WebSocket.OPEN) {
        send(target, { type: msg.type === "player_pause" ? "remote_pause" : "remote_unpause" });
      }
      break;
    }

    case "change_level": {
      const room = findRoomBySocket(ws);
      if (!room || room.host !== ws) return;
      if (room.guest && room.guest.readyState === WebSocket.OPEN) {
        send(room.guest, { type: "remote_change_level" });
      }
      break;
    }

    case "start_level": {
      const room = findRoomBySocket(ws);
      if (!room || room.host !== ws) return;
      if (room.guest && room.guest.readyState === WebSocket.OPEN) {
        send(room.guest, { type: "remote_start_level" });
      }
      break;
    }

    case "player_death": {
      const room = findRoomBySocket(ws);
      if (!room) return;
      const target = room.host === ws ? room.guest : room.host;
      if (target && target.readyState === WebSocket.OPEN) {
        send(target, { type: "remote_death" });
      }
      break;
    }

    case "select_world": {
      const room = findRoomBySocket(ws);
      if (!room || room.host !== ws) return;
      const wi = msg.worldIndex;
      const seed = msg.seed;
      if (!Number.isInteger(wi) || wi < 0 || wi > 9) {
        send(ws, { type: "error", message: "Invalid world index" });
        return;
      }
      if (!Number.isInteger(seed) || seed < 1 || seed > 2147483646) {
        send(ws, { type: "error", message: "Invalid seed" });
        return;
      }
      if (room.guest && room.guest.readyState === WebSocket.OPEN) {
        send(room.guest, { type: "world_selected", worldIndex: wi, seed });
      }
      break;
    }

    case "game_state": {
      const room = findRoomBySocket(ws);
      if (!room || room.host !== ws) return;
      if (room.guest && room.guest.readyState === WebSocket.OPEN) {
        send(room.guest, { type: "game_state", state: msg.state });
      }
      break;
    }

    case "leave_room": {
      handleDisconnect(ws);
      send(ws, { type: "left_room" });
      break;
    }

    case "pong": {
      const room = findRoomBySocket(ws);
      if (room) {
        if (room.host === ws) room.hostAlive = true;
        else room.guestAlive = true;
      }
      break;
    }

    default:
      send(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
  }
}

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");

    ws.on("message", (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
      handleDisconnect(ws);
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
      handleDisconnect(ws);
    });
  });

  const pingInterval = setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.hostAlive && room.host.readyState === WebSocket.OPEN) {
        room.host.terminate();
        continue;
      }
      if (room.guest && !room.guestAlive && room.guest.readyState === WebSocket.OPEN) {
        room.guest.terminate();
        continue;
      }
      room.hostAlive = false;
      room.guestAlive = false;
      send(room.host, { type: "ping" });
      if (room.guest) {
        send(room.guest, { type: "ping" });
      }
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  logger.info("WebSocket server attached on /ws");
  return wss;
}
