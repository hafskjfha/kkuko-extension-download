import electron from 'electron';
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld("electronAPI", {
    sendPing: (msg: string) => ipcRenderer.send("ping", msg),
    onPong: (callback: (msg: string) => void) => ipcRenderer.on("pong", (_, data) => callback(data)),
    getAppVersion: () => ipcRenderer.invoke("get-app-version"),
    openExternal: (url: string) => ipcRenderer.send('open-external', url),
    getLatest: () => ipcRenderer.invoke("get-latest"),
    onMessageFromMain: (callback: (data: any) => void) => ipcRenderer.on('fromMain', (_event, data) => callback(data)),
    getAllWords: () => ipcRenderer.invoke("get-all-words"),
    getGameStatus: () => ipcRenderer.invoke("get-game-status"),
});