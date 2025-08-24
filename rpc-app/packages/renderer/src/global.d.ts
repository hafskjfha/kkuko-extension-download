interface ExtensionClientState {
    serverNumber: null | string;
    roomNumber: null | number;
    play: "연습중" | "대기중" | "로비" | "플레이중" | "";
    rpcConnection: boolean;
}

type FromMain = {
    type: "log";
    data: {
        log: string;
        logType: "info" | "warning" | "error";
        date: string;
    };
} | 
{ type: "game", data: ExtensionClientState } | 
{ type: "word", data: { word: string, theme?: string } };

declare global {
    interface Window {
        electronAPI: {
            sendPing: (msg: string) => void;
            onPong: (callback: (msg: string) => void) => void;
            getAppVersion: () => Promise<{ version: string, buildDate: string }>;
            openExternal: (url: string) => void;
            getLatest: () => Promise<{ version: string, releaseDate: string, changes: string[], updateURL: string } | { error: string }>;
            onMessageFromMain: (callback: (data: FromMain) => void) => void;
            getAllWords: () => Promise<{ data: { id: number; word: string; themes: string; }[]}>;
            getGameStatus: () => Promise<ExtensionClientState>;
        };
    }
}

export { };
