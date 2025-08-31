import { InOutServerOrRoom, StartGame, EndGame, GetWord } from '../../../../../../docs/protocol.types';

let round = 0;
const wordSet = new Set<string>();
const WS_PORT = 27893;

// =============================
//  WebSocket 연결 함수
// =============================
let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function connectWS() {
    if (socket && socket.readyState === WebSocket.OPEN) return; // 이미 연결 중이면 무시

    socket = new WebSocket(`ws://localhost:${WS_PORT}`);

    socket.addEventListener("open", () => {
        // console.log("Connected to server");
        sendRoomInfo();
    });

    socket.addEventListener("error", (err) => {
        console.error("[WS] 에러 발생:", err);
        attemptReconnect();
    });

    socket.addEventListener("close", () => {
        console.warn("[WS] 연결이 닫혔습니다. 재연결 시도...");
        attemptReconnect();
    });
}

function attemptReconnect() {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connectWS, 2000); // 2초 후 재시도
}

function sendWS(data: unknown) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    } else {
        console.warn("[WS] 연결이 닫혀 있어 전송 실패:", data);
    }
}

function sendRoomInfo() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const roomId = location.hash.substring(1) !== '' ? Number(location.hash.substring(1)) : null;

    const sendData: InOutServerOrRoom = {
        p_type: 'd-inSorR',
        data: {
            server: params.get('server') ? Number(params.get('server')) : null,
            roomId
        }
    };
    sendWS(sendData);
}

// =============================
//  2분마다 연결 상태 체크
// =============================
setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("[WS] 상태 체크: 연결이 닫혀 있어 재연결 시도");
        connectWS();
    }
}, 120_000); // 2분

// =============================
//  초기 연결 시작
// =============================
connectWS();

// =============================
//  URL 변경 감지
// =============================
(function trackURLChange() {
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    function onUrlChange() {
        sendRoomInfo();
        round = 0;
    }

    history.pushState = function (...args) {
        originalPush.apply(history, args);
        onUrlChange();
    };
    history.replaceState = function (...args) {
        originalReplace.apply(history, args);
        onUrlChange();
    };

    window.addEventListener("popstate", onUrlChange);
})();

// =============================
//  라운드 변경 감지
// =============================
const roundsElem = document.querySelector('.rounds') as HTMLElement;
let debounceRounds: ReturnType<typeof setTimeout> | null = null;
let prevRoundElem: Element | null = null;

const roundsObserver = new MutationObserver(() => {
    if (debounceRounds) clearTimeout(debounceRounds);
    debounceRounds = setTimeout(() => {
        const current = roundsElem?.querySelector('.rounds-current');
        if (current !== prevRoundElem) {
            prevRoundElem = current;
            if (current?.textContent) {
                round += 1;
                const sendData: StartGame = { p_type: "d-startGame", data: { round } };
                sendWS(sendData);
            }
        }
    }, 50);
});

if (roundsElem) {
    roundsObserver.observe(roundsElem, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

// =============================
//  게임 종료 감지
// =============================
const resultDialog = document.getElementById('ResultDiag');
let debounceResult: ReturnType<typeof setTimeout> | null = null;

if (resultDialog) {
    const resultObserver = new MutationObserver((mutations) => {
        if (debounceResult) clearTimeout(debounceResult);
        debounceResult = setTimeout(() => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const display = window.getComputedStyle(resultDialog).display;
                    if (display !== 'none') {
                        const sendData: EndGame = { p_type: "d-endGame", data: {} };
                        round = 0;
                        sendWS(sendData);
                    }
                }
            }
        }, 50);
    });
    resultObserver.observe(resultDialog, { attributes: true, attributeFilter: ['style'] });
}

// =============================
//  단어 감지 로직
// =============================
const displayElem = document.querySelector('.jjo-display.ellipse') as HTMLElement;
const letterElem = document.querySelector('div.jjo-display.ellipse');

let addTimeout: ReturnType<typeof setTimeout> | null = null;

function sendWord(word: string) {
    if (!wordSet.has(word) && word.trim()) {
        wordSet.add(word);
        const el = document.querySelector('h5.room-head-mode');
        const mode = el ? el.textContent.trim() : '';
        if (mode.includes('솎솎') || mode.includes('그림') || mode.includes("OX")) return;
        const sendData: GetWord = { p_type: "g-word", data: { word } };
        sendWS(sendData);
    }
}

if (displayElem) {
    let prevFontSize = window.getComputedStyle(displayElem).fontSize;

    // 글자 표시 감지 (스타일 변화)
    const styleObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.attributeName === 'style') {
                const currFontSize = window.getComputedStyle(mutation.target as Element).fontSize;
                if (prevFontSize === '20px' && currFontSize !== '20px') {
                    const letter = letterElem?.textContent?.trim() ?? '';
                    sendWord(letter);
                }
                prevFontSize = currFontSize;
            }
        }
    });
    styleObserver.observe(displayElem, { attributes: true });

    // DOM 변경 감지 (글자 또는 실패 메시지 등장)
    const childObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;

                    if (node.classList.contains('display-text')) {
                        if (addTimeout) clearTimeout(addTimeout);
                        addTimeout = setTimeout(() => {
                            const letter = letterElem?.textContent?.trim() ?? '';
                            sendWord(letter);
                        }, 40);

                    } else if (node.classList.contains('game-fail-text')) {
                        // console.log({ word: node.textContent ?? '', root_type: 'ns' });

                    } else {
                        
                    }
                });
            }
        }
    });
    childObserver.observe(displayElem, { childList: true });
}
