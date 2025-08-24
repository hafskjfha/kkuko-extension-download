import electron from 'electron';
const { app, BrowserWindow, ipcMain, shell } = electron;
import type { BrowserWindow as BrowserWindowType } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import { buildDate } from '../build-info';
import { ExtensionClientState, ResData, WsMessage } from './types';
import { GameWebSocketServer } from './websocketServer';
import { SERVER_MAP, isValidServer } from './const';
import logger from 'electron-log/main';
import { WordDatabase } from './db';
import { DiscordRPC } from './rpc';
import { Debugger } from './debug';

const WS_PORT = 27893;

let mainWindow: BrowserWindowType | null = null;
let wsServer: GameWebSocketServer;
let DB: WordDatabase;
let discordRPC: DiscordRPC;
const debuggerInstance = new Debugger();

logger.initialize();
console.log(logger.transports.file.getFile().path);

const extensionClientState: ExtensionClientState = {
    serverNumber: null,
    roomNumber: null,
    play: "",
    rpcConnection: false
};

function resetExtensionClientState() {
    try {
        extensionClientState.serverNumber = null;
        extensionClientState.roomNumber = null;
        extensionClientState.play = "";
        discordRPC?.clearActivity();
    } catch (err) {
        sendLog("error", `Failed to reset extension state: ${err}`);
    }
}

export const sendLog = (logType: "info" | "warning" | "error", msg: string) => {
    try {
        switch (logType) {
            case 'info':
                logger.info(msg);
                break;
            case 'warning':
                logger.warn(msg);
                break;
            case 'error':
                logger.error(msg);
                break;
        }
        mainWindow?.webContents.send("fromMain", {
            type: "log",
            data: { log: msg, logType, date: new Date().toISOString() }
        });
    } catch (err) {
        console.error("Logging failed:", err);
    }
};

function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 900,
            height: 680,
            icon: path.join(__dirname, '../../icon/png', 'icon-64x64.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                devTools: isDev,
                preload: path.join(__dirname, "preload.js"),
            },
        });

        mainWindow.loadURL(
            isDev
                ? "http://localhost:5173"
                : `file://${path.join(__dirname, "../../../renderer/dist/index.html")}`
        );

        if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });

        try {
            wsServer = new GameWebSocketServer(WS_PORT);
            sendLog("info", "wsServer is on!");
        } catch (err) {
            sendLog("error", `Failed to start WS server: ${err}`);
        }

        try {
            DB = new WordDatabase();
            sendLog("info", "Database is on!");
        } catch (err) {
            sendLog("error", `Database init failed: ${err}`);
        }

        try {
            discordRPC = new DiscordRPC();
            sendLog("info", "Discord RPC is on!");
            discordRPC.on("status", (loggedIn: boolean) => {
                extensionClientState.rpcConnection = loggedIn;
                sendState();
            });
            
        } catch (err) {
            sendLog("error", `Discord RPC init failed: ${err}`);
        }

        const sendState = () => {
            try {
                extensionClientState.rpcConnection = discordRPC.isLoggedIn;
                wsServer?.broadcast(JSON.stringify({ p_type: "p-sendState", data: extensionClientState }));
                mainWindow?.webContents.send("fromMain", { type: "game", data: extensionClientState });
                if (extensionClientState.serverNumber === null) return;
                discordRPC?.update(extensionClientState.serverNumber, extensionClientState.roomNumber, extensionClientState.play);
            } catch (err) {
                sendLog("error", `Failed to send state: ${err}`);
            }
        };

        const processWord = (word: string, theme: string) => {
            mainWindow?.webContents.send("fromMain", { type: "word", data: { word, theme } });
            DB?.addWord({ word, themes: theme });
            debuggerInstance.word(word, theme);
        }

        wsServer?.on("message", (msg: WsMessage) => {
            try {
                sendLog("info", `Main process received WS message: ${JSON.stringify(msg)}`);
                switch (msg.p_type) {
                    case "d-endGame":
                        extensionClientState.play = "대기중";
                        sendState();
                        break;
                    case "d-inSorR":
                        const temp = msg.data.server?.toString() ?? "";
                        if (isValidServer(temp)) {
                            const server = SERVER_MAP[temp];
                            const roomId = msg.data.roomId ? msg.data.roomId % 1000 : null;
                            const play = msg.data.roomId ? msg.data.roomId > 1000 ? "연습중" : "대기중" : "로비";
                            extensionClientState.play = play;
                            extensionClientState.roomNumber = roomId;
                            extensionClientState.serverNumber = server + "서버";
                            sendState();
                        } else {
                            resetExtensionClientState();
                            sendState();
                        }
                        break;
                    case "d-startGame":
                        extensionClientState.play = extensionClientState.play !== "연습중" ? '플레이중' : "연습중";
                        sendState();
                        break;
                    case "g-word":
                        try {
                            if (msg.data.word.includes('<') || msg.data.word.includes('>')) return;
                            msg.data.word.split(' ').forEach(word => {
                                processWord(word, msg.data.theme ?? "");
                            });
                        } catch (err) {
                            sendLog("error", `Word handling failed: ${err}`);
                        }
                        break;
                    case "p-sendState":
                    case "p-state":
                        sendState();
                        break;
                    default:
                        sendLog("warning", `Unknown data: ${JSON.stringify(msg)}`);
                }
            } catch (err) {
                sendLog("error", `WS message handling failed: ${err}`);
            }
        });

        wsServer?.on("close", () => {
            sendLog("info", "extension connection is closed.");
            resetExtensionClientState();
            sendState();
        });

        mainWindow.setResizable(true);
        mainWindow.on("closed", () => {
            mainWindow = null;
            app.quit();
        });
        mainWindow.focus();
    } catch (err) {
        sendLog("error", `Failed to create main window: ${err}`);
    }
}

app.on("ready", () => {
    try {
        createWindow();
    } catch (err) {
        sendLog("error", `App ready handler failed: ${err}`);
    }
});

app.on("activate", () => {
    if (mainWindow === null) createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

ipcMain.on("ping", (event, arg) => {
    try {
        console.log("렌더러에서 받은 메시지:", arg);
        event.reply("pong", "메인 프로세스가 응답함!");
    } catch (err) {
        sendLog("error", `Ping handler failed: ${err}`);
    }
});

ipcMain.handle("get-app-version", () => {
    try {
        const version = app.getVersion();
        return { version, buildDate };
    } catch (err) {
        sendLog("error", `Failed to get app version: ${err}`);
        return { error: "Version fetch failed" };
    }
});

ipcMain.on("open-external", (_, url) => {
    try {
        shell.openExternal(url);
    } catch (err) {
        sendLog("error", `Failed to open external URL: ${err}`);
    }
});

ipcMain.handle("get-latest", async () => {
    try {
        const res = await fetch("https://kkuko-utils.vercel.app/api/extendsion");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data: { data: ResData } = await res.json();
        sendLog("info", `Latest version info fetched: ${JSON.stringify(data)}`);
        return {
            version: data.data.version,
            releaseDate: data.data.releaseDate,
            changes: data.data.changes,
            updateURL: data.data.updateURL
        };
    } catch (error) {
        sendLog("error", `Failed to fetch latest version info: ${error}`);
        return { error: "Failed to fetch latest version info." };
    }
});

ipcMain.handle('get-all-words', () => {
    try {
        const words = DB?.getAllWords() ?? [];
        return { type: "words", data: words };
    } catch (err) {
        sendLog("error", `Failed to get all words: ${err}`);
        return { error: "Failed to get words" };
    }
});

ipcMain.handle('get-game-status', () => {
    try {
        return extensionClientState;
    } catch (err) {
        sendLog("error", `Failed to get game status: ${err}`);
        return { error: "Failed to get status" };
    }
});
