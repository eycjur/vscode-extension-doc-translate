import * as crypto from 'crypto';

export class TranslationCache {
    private cache: Map<string, string> = new Map();

    private hash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    get(text: string): string | undefined {
        const key = this.hash(text);
        return this.cache.get(key);
    }

    set(text: string, translation: string): void {
        const key = this.hash(text);
        this.cache.set(key, translation);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}
