import type { LevelTile } from "./worlds/LevelGenerator";

export type OnlineRole = "host" | "guest";

export interface CustomMapData {
  tiles: LevelTile[];
  bgColor: string;
  groundColor: string;
  platformColor: string;
}

export interface PendingWorldSelection {
  worldIndex: number;
  seed: number;
  customMapData?: CustomMapData;
}

export interface RemoteInputs {
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
}

type MessageHandler = (msg: Record<string, unknown>) => void;

class OnlineMultiplayerManager {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private _role: OnlineRole | null = null;
  private _roomCode: string | null = null;
  private _connected = false;
  private remoteInputs: RemoteInputs = { left: false, right: false, jump: false, duck: false };
  private _pendingWorldIndex: number | null = null;
  private _pendingWorldSeed: number | null = null;
  private _pendingCustomMapData: CustomMapData | null = null;

  get role() { return this._role; }
  get roomCode() { return this._roomCode; }
  get connected() { return this._connected; }
  get pendingWorldIndex() { return this._pendingWorldIndex; }

  consumePendingWorld(): PendingWorldSelection | null {
    if (this._pendingWorldIndex === null || this._pendingWorldSeed === null) return null;
    const result: PendingWorldSelection = { worldIndex: this._pendingWorldIndex, seed: this._pendingWorldSeed };
    if (this._pendingCustomMapData) {
      result.customMapData = this._pendingCustomMapData;
    }
    this._pendingWorldIndex = null;
    this._pendingWorldSeed = null;
    this._pendingCustomMapData = null;
    return result;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._connected = true;
        resolve();
      };

      this.ws.onerror = () => {
        this._connected = false;
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "ping") {
            this.send({ type: "pong" });
            return;
          }
          if (msg.type === "world_selected") {
            this._pendingWorldIndex = msg.worldIndex;
            this._pendingWorldSeed = msg.seed;
            this._pendingCustomMapData = msg.customMapData || null;
          }
          this.emit(msg.type, msg);
        } catch {}
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.emit("disconnected", {});
      };
    });
  }

  private send(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private emit(type: string, msg: any) {
    const fns = this.handlers.get(type) || [];
    fns.forEach(fn => fn(msg));
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler?: MessageHandler) {
    if (!handler) {
      this.handlers.delete(type);
    } else {
      const fns = this.handlers.get(type) || [];
      this.handlers.set(type, fns.filter(fn => fn !== handler));
    }
  }

  removeAllListeners() {
    this.handlers.clear();
  }

  createRoom() {
    this.send({ type: "create_room" });
  }

  joinRoom(code: string) {
    this.send({ type: "join_room", code: code.toUpperCase().trim() });
  }

  startGame() {
    this.send({ type: "start_game" });
  }

  sendWorldSelect(worldIndex: number, seed: number, customMapData?: CustomMapData) {
    this.send({ type: "select_world", worldIndex, seed, customMapData });
  }

  sendStartLevel() {
    this.send({ type: "start_level" });
  }

  sendChangeLevel() {
    this.send({ type: "change_level" });
  }

  sendDeath() {
    this.send({ type: "player_death" });
  }

  sendPause() {
    this.send({ type: "player_pause" });
  }

  sendUnpause() {
    this.send({ type: "player_unpause" });
  }

  sendPosition(x: number, y: number, vx: number, vy: number) {
    this.send({ type: "game_state", state: { x, y, vx, vy } });
  }

  sendInputs(inputs: RemoteInputs) {
    this.send({ type: "player_input", inputs });
  }

  sendGameState(state: any) {
    this.send({ type: "game_state", state });
  }

  leaveRoom() {
    this.send({ type: "leave_room" });
    this._role = null;
    this._roomCode = null;
  }

  setRole(role: OnlineRole) {
    this._role = role;
  }

  setRoomCode(code: string) {
    this._roomCode = code;
  }

  getRemoteInputs(): RemoteInputs {
    return { ...this.remoteInputs };
  }

  updateRemoteInputs(inputs: RemoteInputs) {
    this.remoteInputs = { ...inputs };
  }

  resetRemoteInputs() {
    this.remoteInputs = { left: false, right: false, jump: false, duck: false };
  }

  disconnect() {
    this.removeAllListeners();
    this._role = null;
    this._roomCode = null;
    this._connected = false;
    this._pendingWorldIndex = null;
    this._pendingWorldSeed = null;
    this._pendingCustomMapData = null;
    this.resetRemoteInputs();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const onlineManager = new OnlineMultiplayerManager();
