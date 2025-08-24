export const VAILD_SERVER = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export const SERVER_MAP = {
    "0": "감자",
    "1": "냉이",
    "2": "다래",
    "3": "레몬",
    "4": "망고",
    "5": "보리",
    "6": "상추",
    "7": "아욱",
    "8": "죽순",
    "9": "이벤트"
};
export function isValidServer(key: string): key is typeof VAILD_SERVER[number] {
    return VAILD_SERVER.includes(key as any);
}