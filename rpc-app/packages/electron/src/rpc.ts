import RPC from "discord-rpc";
import { EventEmitter } from "events";
import { sendLog } from "./main";

export class DiscordRPC extends EventEmitter {
    private client: RPC.Client | null = null;
    private client_id = "1396442355976110121";
    private timestamp: number | null = null;
    private reconnectInterval: NodeJS.Timeout | null = null;
    private _isLoggedIn = false;

    constructor() {
        super();
        this.initClient();
    }

    get isLoggedIn() {
        return this._isLoggedIn;
    }

    private set isLoggedIn(value: boolean) {
        if (this._isLoggedIn !== value) {
            this._isLoggedIn = value;
            this.emit("status", value); 
        }
    }

    private initClient() {
        this.client = new RPC.Client({ transport: "ipc" });

        this.client.on("ready", () => {
            this.isLoggedIn = true;
            sendLog("info", "Discord RPC connected.");
            this.stopReconnectLoop();
        });

        this.client.on("disconnected", () => {
            this.isLoggedIn = false;
            sendLog("warning", "Discord RPC disconnected.");
            this.startReconnectLoop();
        });

        this.client.on("error", (err) => {
            this.isLoggedIn = false;
            sendLog("error", `Discord RPC error: ${JSON.stringify(err)}`);
            this.startReconnectLoop();
        });

        this.login();
    }

    private async login() {
        if (!this.client) this.initClient();
        try {
            await this.client!.login({ clientId: this.client_id });
        } catch (error) {
            this.isLoggedIn = false;
            sendLog("error", `Error logging in to Discord RPC: ${JSON.stringify(error)}`);
            this.startReconnectLoop();
        }
    }

    private startReconnectLoop() {
        if (this.reconnectInterval) return;
        this.reconnectInterval = setInterval(() => {
            sendLog("info", "Trying to reconnect to Discord RPC...");
            this.login();
        }, 2 * 60 * 1000); // 2분
    }

    private stopReconnectLoop() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    public async update(server: string, room: number | null, play: string) {
        try {
            if (!this.client || !this.client.user || !this.isLoggedIn) {
                sendLog("warning", "Discord RPC client is not connected.");
                return;
            }
            if (this.timestamp === null) this.timestamp = Date.now();

            let state = `${server}`;
            if (room === null) state += " - 로비";
            else state += ` - ${room}번 방 ${play}`;

            this.client.setActivity({
                details: "끄투코리아 플레이 중",
                largeImageKey: "rkk",
                startTimestamp: this.timestamp,
                state: state,
            });
        } catch (error) {
            sendLog("error", `Error updating Discord RPC activity: ${JSON.stringify(error)}`);
        }
    }

    public clearActivity() {
        try {
            if (!this.client || !this.client.user || !this.isLoggedIn) {
                sendLog("warning", "Discord RPC client is not connected.");
                return;
            }
            this.client.clearActivity();
            this.timestamp = null;
        } catch (error) {
            sendLog("error", `Error clearing Discord RPC activity: ${JSON.stringify(error)}`);
        }
    }
}
