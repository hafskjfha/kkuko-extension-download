import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs';
import { sendLog } from './main.js';

export interface Word {
    id: number;
    word: string;
    themes: string;
}

type DatabaseSchema = {
    words: Word[];
    nextId: number;
}

export class WordDatabase {
    private db: Low<DatabaseSchema>;
    private dbPath: string;

    constructor(dataDirectory?: string) {
        // 데이터 디렉토리 설정 (기본값: 현재 작업 디렉토리의 data 폴더)
        const dataDir = dataDirectory || path.join(process.cwd(), 'data');
        
        // 디렉토리가 없으면 생성
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.dbPath = path.join(dataDir, 'word-database.json');
        
        // JSONFile 어댑터 생성 (원자적 쓰기 지원)
        const adapter = new JSONFile<DatabaseSchema>(this.dbPath);
        
        // Low 인스턴스 생성
        this.db = new Low<DatabaseSchema>(adapter, {
            words: [],
            nextId: 1
        });
    }

    /** 데이터베이스 초기화 (비동기) */
    public async initialize(): Promise<void> {
        try {
            // 데이터베이스 읽기
            await this.db.read();
            
            // 데이터가 없거나 스키마가 잘못된 경우 기본값으로 초기화
            if (!this.db.data) {
                this.db.data = { words: [], nextId: 1 };
                await this.db.write();
            }
            
            // words 배열이 없으면 초기화
            if (!Array.isArray(this.db.data.words)) {
                this.db.data.words = [];
            }
            
            // nextId가 숫자가 아니면 초기화
            if (typeof this.db.data.nextId !== 'number') {
                this.db.data.nextId = 1;
            }
            
            sendLog("info", `Database initialized successfully at: ${this.dbPath}`);
        } catch (error) {
            sendLog("error", `Failed to initialize database: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    /** 다음 ID 생성 */
    private getNextId(): number {
        const currentId = this.db.data!.nextId;
        this.db.data!.nextId = currentId + 1;
        return currentId;
    }

    /** 모든 단어 조회 */
    public getAllWords(): Word[] {
        try {
            return this.db.data?.words || [];
        } catch (error) {
            sendLog("error", `Failed to get all words: ${JSON.stringify(error)}`);
            return [];
        }
    }

    /** 단어 추가 */
    public async addWord({ word, themes }: { word: string; themes?: string | null }): Promise<boolean> {
        try {
            if (!this.db.data) {
                await this.db.read();
            }

            const words = this.db.data!.words;
            const existingIndex = words.findIndex(w => w.word === word);
            
            if (existingIndex >= 0) {
                // 기존 단어 업데이트
                words[existingIndex].themes = themes ?? '';
            } else {
                // 새 단어 추가
                const newWord: Word = {
                    id: this.getNextId(),
                    word: word,
                    themes: themes ?? ''
                };
                words.push(newWord);
            }
            
            await this.db.write();
            return true;
        } catch (error) {
            sendLog("error", `Failed to add word: ${JSON.stringify(error)}`);
            return false;
        }
    }

    /** 단어 삭제 */
    public async deleteWord(id: number): Promise<boolean> {
        try {
            if (!this.db.data) {
                await this.db.read();
            }

            const originalLength = this.db.data!.words.length;
            this.db.data!.words = this.db.data!.words.filter(word => word.id !== id);
            
            // 실제로 삭제되었는지 확인
            const deleted = this.db.data!.words.length < originalLength;
            
            if (deleted) {
                await this.db.write();
            }
            
            return deleted;
        } catch (error) {
            sendLog("error", `Failed to delete word: ${JSON.stringify(error)}`);
            return false;
        }
    }

    /** 단어 검색 */
    public findWord(keyword: string): Word[] {
        try {
            const words = this.getAllWords();
            return words.filter(word => 
                word.word.toLowerCase().includes(keyword.toLowerCase())
            );
        } catch (error) {
            sendLog("error", `Failed to find word: ${JSON.stringify(error)}`);
            return [];
        }
    }

    /** 특정 단어 조회 */
    public getWordById(id: number): Word | undefined {
        try {
            const words = this.getAllWords();
            return words.find(word => word.id === id);
        } catch (error) {
            sendLog("error", `Failed to get word by id: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    /** 단어 수정 */
    public async updateWord(id: number, { word, themes }: { word?: string; themes?: string }): Promise<boolean> {
        try {
            if (!this.db.data) {
                await this.db.read();
            }

            const words = this.db.data!.words;
            const index = words.findIndex(w => w.id === id);
            
            if (index === -1) {
                sendLog("error", `Word with id ${id} not found`);
                return false;
            }
            
            if (word !== undefined) {
                words[index].word = word;
            }
            if (themes !== undefined) {
                words[index].themes = themes;
            }
            
            await this.db.write();
            return true;
        } catch (error) {
            sendLog("error", `Failed to update word: ${JSON.stringify(error)}`);
            return false;
        }
    }

    /** 테마별 단어 검색 */
    public findWordsByTheme(theme: string): Word[] {
        try {
            const words = this.getAllWords();
            return words.filter(word => 
                word.themes.toLowerCase().includes(theme.toLowerCase())
            );
        } catch (error) {
            sendLog("error", `Failed to find words by theme: ${JSON.stringify(error)}`);
            return [];
        }
    }

    /** 데이터베이스 초기화 (모든 데이터 삭제) */
    public async clearAll(): Promise<boolean> {
        try {
            if (!this.db.data) {
                await this.db.read();
            }

            this.db.data!.words = [];
            this.db.data!.nextId = 1;
            
            await this.db.write();
            return true;
        } catch (error) {
            sendLog("error", `Failed to clear database: ${JSON.stringify(error)}`);
            return false;
        }
    }

    /** 데이터 백업 */
    public exportData(): { words: Word[]; nextId: number } {
        try {
            return {
                words: this.getAllWords(),
                nextId: this.db.data?.nextId || 1
            };
        } catch (error) {
            sendLog("error", `Failed to export data: ${JSON.stringify(error)}`);
            return { words: [], nextId: 1 };
        }
    }

    /** 데이터 복원 */
    public async importData(data: { words: Word[]; nextId: number }): Promise<boolean> {
        try {
            if (!this.db.data) {
                await this.db.read();
            }

            this.db.data!.words = data.words;
            this.db.data!.nextId = data.nextId;
            
            await this.db.write();
            return true;
        } catch (error) {
            sendLog("error", `Failed to import data: ${JSON.stringify(error)}`);
            return false;
        }
    }

    /** 데이터베이스 다시 읽기 (외부에서 파일이 변경된 경우) */
    public async reload(): Promise<void> {
        try {
            await this.db.read();
            sendLog("info", "Database reloaded successfully");
        } catch (error) {
            sendLog("error", `Failed to reload database: ${JSON.stringify(error)}`);
            throw error;
        }
    }

    /** 데이터베이스 파일 경로 반환 */
    public getDbPath(): string {
        return this.dbPath;
    }

    /** 연결 해제 (lowdb는 자동 관리되므로 실제로는 불필요하지만 일관성을 위해 유지) */
    public close(): void {
        // lowdb는 자동으로 관리되므로 특별한 작업 불필요
        sendLog("info", "Database connection closed");
    }
}