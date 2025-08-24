export interface ExtensionClientState {
    serverNumber: null | string;
    roomNumber: null | number;
    play: "연습중" | "대기중" | "로비" | "플레이중" | "";
    rpcConnection: boolean;
}

export interface ResData {
    version: string;
    releaseDate: string;
    changes: string[];
    updateURL: string;
}

export interface InOutServerOrRoom{
    p_type: "d-inSorR",
    data: {
        server: number | null,
        roomId: number | null
    }
}

export interface StartGame{
    p_type: "d-startGame",
    data: {
        round?: number
    }
}

export interface EndGame{
    p_type: "d-endGame",
    data: {
        
    }
}

export interface GetWord{
    p_type: "g-word",
    data: {
        word: string,
        theme?: string
    }
}

export interface GetClientState {
    p_type: "p-sendState",
    data: {
        serverNumber: number | string;
        roomNumber: null | number;
        play: string;
    }
}

export interface ReqClientState {
    p_type: "p-state"
}

export type WsMessage = InOutServerOrRoom | StartGame | EndGame | GetWord | GetClientState | ReqClientState;