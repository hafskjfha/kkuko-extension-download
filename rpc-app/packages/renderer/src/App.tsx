import { useState, useEffect } from 'react';
import { Gamepad2, Users, Clock, Activity, BookOpen, FileText, Download, Search, Info, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { ScrollArea } from './components/ui/scroll-area';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';

interface WordData {
    id: number;
    word: string;
    theme: string | null;
}

interface LogEntry {
    timestamp: string;
    level: 'info' | 'error' | 'warning';
    message: string;
}

const DiscordRPCBridge = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showAppInfo, setShowAppInfo] = useState(false);
    const [showUpdateNotice, setShowUpdateNotice] = useState(false);
    const [appVersion, setAppVersion] = useState<string>('1.2.3');
    const [appBuildDate, setAppBuildDate] = useState<string>('2024-12-15');
    const [latestInfo, setLatestInfo] = useState<{version: string, releaseDate: string, changes: string[], updateURL: string}|null>(null);
    const [wordList, setWordList] = useState<WordData[]>([]);
    const [gameStatus, setGameStatus] = useState<{ serverNumber: string | null; roomNumber: number | null; play: string; rpcConnection: boolean; } | null>(null);
    const [appLogs, setAppLogs] = useState<LogEntry[]>([]);
    const [wordSet, setWordSet] = useState<Set<string>>(new Set());

    // 앱 정보
    const appInfo = {
        name: "끄코 Discord RPC Bridge",
        version: appVersion,
        buildDate: appBuildDate,
        author: "hafskjfha",
        description: "끄투코리아와 Discord Rich Presence를 연결하는 브릿지 앱입니다.",
        features: [
            "실시간 게임 상태 표시",
            "단어 목록 자동 수집",
            "Discord RPC 연동"
        ]
    };

    useEffect(() => {
        // 새 버전이 있을 때만 모달 표시 (임시로 3초 후 표시)
        if (latestInfo && appVersion !== latestInfo.version) {
            setShowUpdateNotice(true);
        }
    }, [latestInfo, appVersion]);

    const filteredWordList = wordList.filter(item => 
        item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.theme && item.theme.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const downloadWordList = () => {
        const textContent = wordList.map(item => 
            item.word
        ).join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `kkuko_words_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "게임중": return "bg-green-500";
            case "대기중": return "bg-yellow-500";
            case "로비": return "bg-blue-500";
            default: return "bg-gray-500";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "플레이중": return <Activity className="w-4 h-4" />;
            case "대기중": return <Clock className="w-4 h-4" />;
            case "로비": return <Users className="w-4 h-4" />;
            case "연습중": return <Gamepad2 className="w-4 h-4" />;
            default: return <Gamepad2 className="w-4 h-4" />;
        }
    };

    const getLogColor = (level: LogEntry['level']) => {
        switch (level) {
            case "error": return "text-red-400";
            case "warning": return "text-yellow-400";
            case "info": return "text-blue-400";
            default: return "text-gray-400";
        }
    };

    const handleUpdateCheck = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (latestInfo) {
            window.electronAPI.openExternal(latestInfo.updateURL);
        }
    };

    useEffect(() => {
        const fetchLatestInfo = async () => {
            const info = await window.electronAPI.getLatest();
            if ('error' in info) {
                return;
            }
            console.log("Latest info fetched:", info);
            setLatestInfo({...info, releaseDate: new Date(info.releaseDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })});
        };

        const fetchAppVersion = async () => {
            const version = await window.electronAPI.getAppVersion();
            setAppVersion(version.version);
            setAppBuildDate(new Date(version.buildDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }));
        };

        const fetchWordList = async () => {
            const words = await window.electronAPI.getAllWords();
            console.log("Fetched words:", words);
            setWordList(words.data?.map(({id, word, themes})=>({id, word, theme: themes || null})) ?? []);
            setWordSet(new Set(words.data?.map(({word}) => word) || []));
        };

        const fetchGameStatus = async () => {
            const status = await window.electronAPI.getGameStatus();
            setGameStatus(status);
        };

        const handleFromMain = () => {
            window.electronAPI.onMessageFromMain((data) => {
                if (data.type === "log") {
                    setAppLogs(prevLogs => [
                        {
                            timestamp: new Date().toISOString(),
                            level: data.data.logType,
                            message: data.data.log
                        },
                        ...prevLogs,
                    ].slice(0, 1000));
                }
                else if (data.type === "game") {
                    setGameStatus(data.data);
                }
                else if (data.type === "word") {
                    if (wordSet.has(data.data.word)) {
                        return;
                    }
                    setWordSet(prevSet => new Set(prevSet).add(data.data.word));
                    setWordList(prevWords => [
                        ...prevWords,
                        {
                            word: data.data.word,
                            theme: data.data.theme || null,
                            id: prevWords.length > 0 ? prevWords[prevWords.length - 1].id + 1 : 1
                        }
                    ]);
                }
                else {

                }
            });
        };

        fetchWordList();
        fetchLatestInfo();
        fetchAppVersion();
        fetchGameStatus();
        handleFromMain();
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            <div className="h-auto min-h-[160px] p-4 border-b border-gray-700 bg-gray-900">
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-white">
                            <Gamepad2 className="w-5 h-5 text-purple-400" />
                            게임 상태
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2 flex-1">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-300">서버:</span>
                                <span className="text-sm text-white">{gameStatus?.serverNumber || "미접속"}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-1">
                                <div className="w-4 h-4 bg-green-900 rounded flex items-center justify-center">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                </div>
                                <span className="text-sm font-medium text-gray-300">방:</span>
                                <span className="text-sm text-white">{gameStatus?.roomNumber ? `${gameStatus.roomNumber}번 방` : "미접속"}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-1">
                                <div className={`w-4 h-4 rounded flex items-center justify-center ${gameStatus?.rpcConnection ? 'bg-green-900' : 'bg-red-900'}`}>
                                    <div className={`w-2 h-2 rounded-full ${gameStatus?.rpcConnection ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                </div>
                                <span className="text-sm font-medium text-gray-300">Discord RPC:</span>
                                <span className={`text-sm ${gameStatus?.rpcConnection ? 'text-green-400' : 'text-red-400'}`}>
                                    {gameStatus?.rpcConnection ? "연결됨" : "연결 안됨"}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge className={`${getStatusColor(gameStatus?.play || "대기중")} text-white flex items-center gap-1`}>
                                    {getStatusIcon(gameStatus?.play || "대기중")}
                                    {gameStatus?.play || "대기중"}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 하단 탭 영역 - 더 많은 공간 확보 */}
            <div className="flex-1 p-4 bg-gray-900">
                <Tabs defaultValue="words" className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 mb-3 bg-gray-800 border-gray-700">
                        <TabsTrigger value="words" className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300">
                            <BookOpen className="w-4 h-4" />
                            단어 목록
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="flex items-center gap-2 data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300">
                            <FileText className="w-4 h-4" />
                            앱 로그
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1">
                        <TabsContent value="words" className="h-full m-0">
                            <Card className="h-full bg-gray-800 border-gray-700">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                                    <CardTitle className="text-lg text-white">획득한 단어 ({Array.from(new Map(filteredWordList.map(item => [item.word, item])).values()).length}개)</CardTitle>
                                    <Button 
                                        onClick={downloadWordList}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        다운로드
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 flex-1">
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="단어 또는 주제로 검색..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <ScrollArea className="h-[calc(100vh-340px)]">
                                        <div className="space-y-2">
                                            {Array.from(new Map(filteredWordList.map(item => [item.word, item])).values()).map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                                                    <span className="font-medium text-white">{item.word}</span>
                                                    {item.theme && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.theme.split(',').map((theme, themeIndex) => (
                                                                <Badge key={themeIndex} variant="secondary" className="bg-blue-600 text-blue-100 hover:bg-blue-500">
                                                                    {theme.trim()}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="logs" className="h-full m-0">
                            <Card className="h-full bg-gray-800 border-gray-700">
                                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-lg text-white">앱 로그</CardTitle>
                                    <Button
                                        onClick={() => setShowAppInfo(true)}
                                        size="sm"
                                        variant="ghost"
                                        className="text-gray-400 hover:text-white hover:bg-gray-700 p-2"
                                    >
                                        <Info className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 flex-1">
                                    <ScrollArea className="h-[calc(100vh-280px)]">
                                        <div className="p-4 space-y-1">
                                            {appLogs.map((log, index) => (
                                                <div key={index} className="flex items-start gap-3 p-2 hover:bg-gray-700 rounded text-sm font-mono">
                                                    <span className="text-gray-400 min-w-fit">{log.timestamp}</span>
                                                    <span className={`font-medium min-w-fit ${getLogColor(log.level)}`}>
                                                        [{log.level.toUpperCase()}]
                                                    </span>
                                                    <span className="text-gray-200 flex-1">{log.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* 앱 정보 모달 */}
            <Dialog open={showAppInfo} onOpenChange={setShowAppInfo}>
                <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Gamepad2 className="w-6 h-6 text-purple-400" />
                            앱 정보
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white">{appInfo.name}</h3>
                            <p className="text-gray-400 text-sm mt-1">{appInfo.description}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-sm font-medium text-gray-300">버전</span>
                                <p className="text-white">{appInfo.version}</p>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-300">빌드 날짜</span>
                                <p className="text-white">{appInfo.buildDate}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-sm font-medium text-gray-300">개발자</span>
                            <p className="text-white">{appInfo.author}</p>
                        </div>

                        <div>
                            <span className="text-sm font-medium text-gray-300 block mb-2">주요 기능</span>
                            <ul className="space-y-1">
                                {appInfo.features.map((feature, index) => (
                                    <li key={index} className="text-sm text-gray-300 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-4 border-t border-gray-600">
                            <Button
                                onClick={() => setShowAppInfo(false)}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-white"
                            >
                                닫기
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 새 버전 알림 모달 */}
            <Dialog open={showUpdateNotice} onOpenChange={setShowUpdateNotice}>
                <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <Download className="w-3 h-3 text-white" />
                            </div>
                            새 버전 출시
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-green-400 font-semibold">v{latestInfo && latestInfo.version}</span>
                                <span className="text-sm text-gray-400">{latestInfo && latestInfo.releaseDate}</span>
                            </div>
                            <p className="text-sm text-gray-300">새로운 버전이 출시되었습니다!</p>
                        </div>

                        <div>
                            <span className="text-sm font-medium text-gray-300 block mb-2">변경사항</span>
                            <ul className="space-y-1">
                                {latestInfo && latestInfo.changes.map((change, index) => (
                                    <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                        {change}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-gray-600">
                            <Button
                                onClick={(e) => {
                                    handleUpdateCheck(e);
                                    setShowUpdateNotice(false);
                                }}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                업데이트
                            </Button>
                            <Button
                                onClick={() => setShowUpdateNotice(false)}
                                variant="outline"
                                className="flex-1 bg-gray-600 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                                나중에
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DiscordRPCBridge;