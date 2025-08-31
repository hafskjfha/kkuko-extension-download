import electron from 'electron';
const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = electron;
import type { BrowserWindow as BrowserWindowType, Tray as TrayType } from 'electron';
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
let tray: TrayType | null = null;
let wsServer: GameWebSocketServer;
let DB: WordDatabase;
let discordRPC: DiscordRPC;
const debuggerInstance = new Debugger();
let isQuiting = false;
const isHiddenStart = process.argv.includes('--hidden');

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

function createTray() {
    try {
        const trayIconPath = path.join(__dirname, '../../icon/png', 'icon-16x16.png');
        tray = new Tray(trayIconPath);
        
        const updateTrayMenu = () => {
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: '창 열기',
                    click: () => {
                        showWindow();
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: `상태: ${extensionClientState.play || "대기중"}`,
                    enabled: false
                },
                {
                    label: `서버: ${extensionClientState.serverNumber || "연결 안됨"}`,
                    enabled: false
                },
                {
                    label: `방: ${extensionClientState.roomNumber || "없음"}`,
                    enabled: false
                },
                {
                    label: `Discord RPC: ${extensionClientState.rpcConnection ? "연결됨" : "연결 안됨"}`,
                    enabled: false
                },
                {
                    type: 'separator'
                },
                {
                    label: '시작 프로그램 등록',
                    type: 'checkbox',
                    checked: app.getLoginItemSettings().openAtLogin,
                    click: (menuItem) => {
                        app.setLoginItemSettings({
                            openAtLogin: menuItem.checked,
                            openAsHidden: true
                        });
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '종료',
                    click: () => {
                        isQuiting = true;
                        app.quit();
                    }
                }
            ]);
            
            tray?.setContextMenu(contextMenu);
        };

        updateTrayMenu();
        
        // 트레이 메뉴를 주기적으로 업데이트
        const updateInterval = setInterval(() => {
            if (tray && !tray.isDestroyed()) {
                updateTrayMenu();
            } else {
                clearInterval(updateInterval);
            }
        }, 5000);

        tray.setToolTip('kkuko-extension-app');
        
        tray.on('click', () => {
            showWindow();
        });

        tray.on('double-click', () => {
            showWindow();
        });

        sendLog("info", "System tray created successfully");
    } catch (err) {
        sendLog("error", `Failed to create system tray: ${err}`);
    }
}

function showWindow() {
    try {
        if (mainWindow === null) {
            createWindow();
        } else {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
        }
    } catch (err) {
        sendLog("error", `Failed to show window: ${err}`);
    }
}

function hideWindow() {
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.hide();
        }
    } catch (err) {
        sendLog("error", `Failed to hide window: ${err}`);
    }
}

function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 900,
            height: 680,
            icon: path.join(__dirname, '../../icon/png', 'icon-64x64.png'),
            show: !isHiddenStart, // 자동 시작시에는 숨김
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

        // 웹소켓 서버 초기화
        if (!wsServer) {
            try {
                wsServer = new GameWebSocketServer(WS_PORT);
                sendLog("info", "wsServer is on!");
            } catch (err) {
                sendLog("error", `Failed to start WS server: ${err}`);
            }
        }

        // 데이터베이스 초기화
        if (!DB) {
            try {
                const userDataPath = app.getPath('userData');
                DB = new WordDatabase(userDataPath);
                (async () => {
                    await DB.initialize();
                })();
                sendLog("info", "Database is on!");
            } catch (err) {
                sendLog("error", `Database init failed: ${err}`);
            }
        }

        // Discord RPC 초기화
        if (!discordRPC) {
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
            (async () => await DB?.addWord({ word, themes: theme }))();
            debuggerInstance.word(word, theme);
        }

        // WebSocket 이벤트 핸들러는 한 번만 등록
        if (!wsServer?.listenerCount('message')) {
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
        }

        if (!wsServer?.listenerCount('close')) {
            wsServer?.on("close", () => {
                sendLog("info", "extension connection is closed.");
                resetExtensionClientState();
                sendState();
            });
        }

        mainWindow.setResizable(true);
        
        // 창 닫기 동작을 트레이로 숨기기로 변경
        mainWindow.on("close", (event) => {
            if (!isQuiting) {
                event.preventDefault();
                hideWindow();
                sendLog("info", "Window hidden to tray");
                return false;
            }
        });

        mainWindow.on("closed", () => {
            mainWindow = null;
        });

        // 자동 시작으로 열린 경우가 아니면 창을 포커스
        if (!isHiddenStart) {
            mainWindow.focus();
        }

    } catch (err) {
        sendLog("error", `Failed to create main window: ${err}`);
    }
}

// 앱이 이미 실행 중인지 확인하고 단일 인스턴스만 실행되도록 함
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // 두 번째 인스턴스가 실행되려고 할 때 기존 창을 보여줌
        showWindow();
    });

    app.on("ready", () => {
        try {
            createTray();
            createWindow();
            
            // macOS가 아닌 경우 Dock에서 앱 숨기기
            if (process.platform !== 'darwin') {
                app.dock?.hide();
            }
        } catch (err) {
            sendLog("error", `App ready handler failed: ${err}`);
        }
    });
}

app.on("activate", () => {
    showWindow();
});

app.on("window-all-closed", () => {
    // 트레이 앱이므로 창이 모두 닫혀도 앱을 종료하지 않음
    // app.quit()을 호출하지 않음
});

app.on("before-quit", () => {
    isQuiting = true;
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

// 트레이 관련 IPC 핸들러들
ipcMain.handle('hide-to-tray', () => {
    try {
        hideWindow();
        return { success: true };
    } catch (err) {
        sendLog("error", `Failed to hide to tray: ${err}`);
        return { error: "Failed to hide to tray" };
    }
});

ipcMain.handle('get-auto-start-status', () => {
    try {
        return app.getLoginItemSettings().openAtLogin;
    } catch (err) {
        sendLog("error", `Failed to get auto start status: ${err}`);
        return false;
    }
});

ipcMain.handle('set-auto-start', (_, enable: boolean) => {
    try {
        app.setLoginItemSettings({
            openAtLogin: enable,
            openAsHidden: enable, // 자동 시작 시 숨김 모드로 시작
            args: enable ? ['--hidden'] : []
        });
        sendLog("info", `Auto start ${enable ? 'enabled' : 'disabled'}`);
        return { success: true };
    } catch (err) {
        sendLog("error", `Failed to set auto start: ${err}`);
        return { error: "Failed to set auto start" };
    }
});