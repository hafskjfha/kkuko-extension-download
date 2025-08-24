import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from "events";
import { sendLog } from "./main";

export class GameWebSocketServer extends EventEmitter {
    private wss: WebSocketServer;
    private connections = new Map<string, WebSocket>();
    private extensionId: string | null = null;

    constructor(port: number) {
        super();
        this.wss = new WebSocketServer({ port });
        this.setup();
    }

    private setup() {
        try {
            this.wss.on("connection", (socket) => {
                const id = uuidv4();
                this.connections.set(id, socket);
                sendLog("info", `Client connected: ${id}`);

                socket.on("message", (msg) => {
                    try {
                        const messageString = msg.toString();
                        const data = JSON.parse(messageString);
                        if (this.extensionId === null && data.p_type && data.p_type !== "p-state") {
                            this.extensionId = id;
                        }
                        sendLog("info", `Message from ${id}: ${JSON.stringify(data)}`);

                        this.emit("message", data);
                    } catch (error) {
                        sendLog("error", `Error processing message: ${JSON.stringify(error)}`);
                    }
                });

                socket.on("close", () => {
                    sendLog("info", `Client disconnected: ${id}`);
                    this.connections.delete(id);
                    if (id === this.extensionId) {
                        this.emit("close", id);
                        this.extensionId = null;
                    }
                });
            })
        } catch (error) {
            sendLog("error", `Error setting up WebSocket server: ${JSON.stringify(error)}`);
        }
    }

    public broadcast(message: string) {
        try {
            this.wss.clients.forEach((client) => {
                if (client.readyState === client.OPEN) {
                    client.send(message);
                }
            });
        } catch (error) {
            sendLog("error", `Error broadcasting message: ${JSON.stringify(error)}`);
        }
    }

}