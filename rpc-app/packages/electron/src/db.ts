import Database from 'better-sqlite3';
import path from 'path';
import { sendLog } from './main';

export interface Word {
    id: number;
    word: string;
    themes: string;
}

export class WordDatabase {
    private db: Database.Database;

    constructor(dbFileName: string = 'app.db') {
        try {
            this.db = new Database(path.join(__dirname, dbFileName));
        } catch (error) {
            sendLog("error", `Failed to initialize database: ${JSON.stringify(error)}`);
        }
        const dbPath = path.join(__dirname, dbFileName);
        this.db = new Database(dbPath);
        this.initialize();
    }

    /** 테이블 생성 */
    private initialize() {
        try {
            this.db.prepare(`
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                themes TEXT DEFAULT ''
            );
        `).run();
        } catch (error) {
            sendLog('error', `Failed to initialize database: ${JSON.stringify(error)}`);
        }
    }

    /** 모든 단어 조회 */
    public getAllWords(): Word[] {
        try {
            return this.db.prepare('SELECT * FROM words').all() as Word[] ?? [];
        } catch (error) {
            sendLog("error", `Failed to get all words: ${JSON.stringify(error)}`);
            return [];
        }
    }

    /** 단어 추가 */
    public addWord({ word, themes }: { word: string; themes?: string | null }) {
        try {
            return this.db
                .prepare(`
                INSERT INTO words (word, themes)
                VALUES (?, ?)
                ON CONFLICT(word) DO UPDATE SET
                    themes = excluded.themes;
                `)
                .run(word, themes ?? '');
        } catch (error) {
            sendLog("error", `Failed to add word: ${JSON.stringify(error)}`);
        }
    }

    /** 단어 삭제 */
    public deleteWord(id: number) {
        try {
            return this.db.prepare('DELETE FROM words WHERE id = ?').run(id);
        } catch (error) {
            sendLog("error", `Failed to delete word: ${JSON.stringify(error)}`);
        }
    }

    /** 단어 검색 */
    public findWord(keyword: string): Word[] {
        try {
            return this.db
                .prepare('SELECT * FROM words WHERE word LIKE ?')
                .all(`%${keyword}%`) as Word[];
        } catch (error) {
            sendLog("error", `Failed to find word: ${JSON.stringify(error)}`);
            return [];
        }
    }
}
