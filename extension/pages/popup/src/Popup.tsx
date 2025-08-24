import '@src/Popup.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect, useRef } from 'react';
import { Gamepad2, Server, Users, Activity } from 'lucide-react';

const WS_PORT = 27893;

interface GameState {
    serverNumber: number | string;
    roomNumber: null | number;
    play: string;
}

interface WSMessage {
    p_type: string;
    data?: GameState;
}

const Popup = () => {
    const [isConnecting, setIsConnecting] = useState(true);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const connectWebSocket = () => {
            try {
                const ws = new WebSocket(`ws://localhost:${WS_PORT}/`);
                wsRef.current = ws;

                ws.onopen = () => {
                    // console.log('WebSocket 연결됨');
                    setConnectionError(null);

                    // 연결되면 게임 상태 요청
                    ws.send(JSON.stringify({ p_type: "p-state" }));
                };

                ws.onmessage = (event) => {
                    try {
                        const message: WSMessage = JSON.parse(event.data);

                        if (message.p_type === "p-sendState" && message.data) {
                            setGameState(message.data);
                            setIsConnecting(false);
                        }
                    } catch (error) {
                        // console.error('메시지 파싱 오류:', error);
                    }
                };

                ws.onerror = (error) => {
                    // console.error('WebSocket 오류:', error);
                    setConnectionError('연결에 실패했습니다');
                    setIsConnecting(false);
                };

                ws.onclose = () => {
                    // console.log('WebSocket 연결 종료됨');
                    setConnectionError('연결이 끊어졌습니다. 앱이 실행되고 있나요?');
                };

            } catch (error) {
                // console.error('WebSocket 연결 오류:', error);
                setConnectionError('연결할 수 없습니다. 앱이 실행되고 있나요?');
                setIsConnecting(false);
            }
        };

        connectWebSocket();

        // 컴포넌트 언마운트 시 연결 종료
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const formatServerNumber = (serverNumber: number | string): string => {
        return typeof serverNumber === 'number' ? serverNumber === -1 ? "게임 미접속" :`${serverNumber}번 서버` : `${serverNumber}`;
    };

    const formatRoomNumber = (roomNumber: null | number): string => {
        return roomNumber ? `${roomNumber}번 방` : '방 미입장';
    };

    if (isConnecting && !connectionError) {
        return (
            <div className={cn('w-80 p-6 bg-white')}>
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-600">정보 받아오는 중...</p>
                </div>
            </div>
        );
    }

    if (connectionError) {
        return (
            <div className={cn('w-80 p-6 bg-white')}>
                <div className="flex flex-col items-center justify-center space-y-4">
                    <Activity className="h-8 w-8 text-red-500" />
                    <p className="text-sm text-red-600">{connectionError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('w-80 p-6 bg-white shadow-lg')}>
            <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-4 border-b">
                    <Gamepad2 className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-800">끄투코리아 게임 상태</h2>
                </div>

                {gameState && (
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <Server className="h-4 w-4 text-green-600" />
                            <div>
                                <p className="text-xs text-gray-500">서버</p>
                                <p className="text-sm font-medium text-gray-800">
                                    {formatServerNumber(gameState.serverNumber)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <Users className="h-4 w-4 text-purple-600" />
                            <div>
                                <p className="text-xs text-gray-500">방</p>
                                <p className="text-sm font-medium text-gray-800">
                                    {formatRoomNumber(gameState.roomNumber)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                            <Activity className="h-4 w-4 text-blue-600" />
                            <div>
                                <p className="text-xs text-gray-500">현재 상태</p>
                                <p className="text-sm font-medium text-gray-800">{gameState.play || "NULL"}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);