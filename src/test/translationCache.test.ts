import * as assert from 'assert';
import * as vscode from 'vscode';
import { TranslationCache } from '../services/translationCache';

// Mock ExtensionContext for testing
class MockMemento implements vscode.Memento {
    private storage: Map<string, any> = new Map();
    private syncKeys: readonly string[] = [];

    keys(): readonly string[] {
        return Array.from(this.storage.keys());
    }

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get(key: string, defaultValue?: any): any {
        const value = this.storage.get(key);
        return value !== undefined ? value : defaultValue;
    }

    update(key: string, value: any): Thenable<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }

    setKeysForSync(keys: readonly string[]): void {
        this.syncKeys = keys;
    }
}

class MockExtensionContext {
    public globalState: vscode.Memento;
    public workspaceState: vscode.Memento;

    constructor() {
        this.globalState = new MockMemento() as vscode.Memento;
        this.workspaceState = new MockMemento() as vscode.Memento;
    }
}

suite('Translation Cache Test Suite', () => {
    let context: MockExtensionContext;
    let cache: TranslationCache;

    setup(() => {
        context = new MockExtensionContext();
        cache = new TranslationCache(context as any);
    });

    suite('Basic Operations', () => {
        test('should store and retrieve translation', () => {
            const text = 'Hello World';
            const translation = 'こんにちは世界';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should retrieve stored translation');
        });

        test('should return undefined for non-existent key', () => {
            const result = cache.get('non-existent text');

            assert.strictEqual(result, undefined, 'Should return undefined for non-existent key');
        });

        test('should handle same text with different content', () => {
            const text1 = 'Hello';
            const text2 = 'World';
            const translation1 = 'こんにちは';
            const translation2 = '世界';

            cache.set(text1, translation1);
            cache.set(text2, translation2);

            assert.strictEqual(cache.get(text1), translation1, 'Should retrieve first translation');
            assert.strictEqual(cache.get(text2), translation2, 'Should retrieve second translation');
        });

        test('should overwrite existing translation', () => {
            const text = 'Hello';
            const translation1 = 'こんにちは';
            const translation2 = 'ハロー';

            cache.set(text, translation1);
            cache.set(text, translation2);

            const result = cache.get(text);

            assert.strictEqual(result, translation2, 'Should return latest translation');
        });

        test('should handle empty string as key', () => {
            const text = '';
            const translation = 'empty';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle empty string');
        });

        test('should handle very long text', () => {
            const text = 'A'.repeat(10000);
            const translation = 'B'.repeat(10000);

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle long text');
        });

        test('should handle special characters', () => {
            const text = 'Text with special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
            const translation = '特殊文字を含むテキスト';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle special characters');
        });

        test('should handle Unicode text', () => {
            const text = 'Unicode: 你好 مرحبا שלום 안녕하세요';
            const translation = 'ユニコード';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle Unicode text');
        });
    });

    suite('Size and Clear', () => {
        test('should report correct size', () => {
            assert.strictEqual(cache.size, 0, 'Initial size should be 0');

            cache.set('text1', 'translation1');
            assert.strictEqual(cache.size, 1, 'Size should be 1 after one insertion');

            cache.set('text2', 'translation2');
            assert.strictEqual(cache.size, 2, 'Size should be 2 after two insertions');
        });

        test('should not increase size when overwriting', () => {
            cache.set('text', 'translation1');
            cache.set('text', 'translation2');

            assert.strictEqual(cache.size, 1, 'Size should remain 1 when overwriting');
        });

        test('should clear all cached translations', () => {
            cache.set('text1', 'translation1');
            cache.set('text2', 'translation2');
            cache.set('text3', 'translation3');

            assert.strictEqual(cache.size, 3, 'Should have 3 items before clear');

            cache.clear();

            assert.strictEqual(cache.size, 0, 'Size should be 0 after clear');
            assert.strictEqual(cache.get('text1'), undefined, 'Should not find text1 after clear');
            assert.strictEqual(cache.get('text2'), undefined, 'Should not find text2 after clear');
            assert.strictEqual(cache.get('text3'), undefined, 'Should not find text3 after clear');
        });
    });

    suite('Persistence', () => {
        test('should persist cache across instances', async () => {
            const text = 'Persist test';
            const translation = '永続化テスト';

            cache.set(text, translation);

            // Wait for async save to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Create new cache instance with same context
            const newCache = new TranslationCache(context as any);

            const result = newCache.get(text);
            assert.strictEqual(result, translation, 'Should load cached translation from storage');
        });

        test('should persist multiple items', async () => {
            cache.set('text1', 'translation1');
            cache.set('text2', 'translation2');
            cache.set('text3', 'translation3');

            // Wait for async save to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Create new cache instance
            const newCache = new TranslationCache(context as any);

            assert.strictEqual(newCache.size, 3, 'Should load all cached items');
            assert.strictEqual(newCache.get('text1'), 'translation1');
            assert.strictEqual(newCache.get('text2'), 'translation2');
            assert.strictEqual(newCache.get('text3'), 'translation3');
        });

        test('should persist cleared state', async () => {
            cache.set('text', 'translation');

            // Wait for async save
            await new Promise(resolve => setTimeout(resolve, 100));

            cache.clear();

            // Wait for async save
            await new Promise(resolve => setTimeout(resolve, 100));

            // Create new cache instance
            const newCache = new TranslationCache(context as any);

            assert.strictEqual(newCache.size, 0, 'Should load empty cache after clear');
        });

        test('should handle empty storage on initialization', () => {
            // Create new context without any stored data
            const emptyContext = new MockExtensionContext();
            const emptyCache = new TranslationCache(emptyContext as any);

            assert.strictEqual(emptyCache.size, 0, 'Should initialize with empty cache');
        });
    });

    suite('Hash Collision Handling', () => {
        test('should use hash for storage keys', () => {
            const text1 = 'Text 1';
            const text2 = 'Text 2';
            const translation1 = 'Translation 1';
            const translation2 = 'Translation 2';

            cache.set(text1, translation1);
            cache.set(text2, translation2);

            // Different texts should produce different hashes and not collide
            assert.strictEqual(cache.get(text1), translation1);
            assert.strictEqual(cache.get(text2), translation2);
            assert.strictEqual(cache.size, 2, 'Should have 2 distinct entries');
        });
    });

    suite('Edge Cases', () => {
        test('should handle whitespace-only text', () => {
            const text = '   \n\t   ';
            const translation = 'whitespace';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle whitespace-only text');
        });

        test('should handle newlines in text', () => {
            const text = 'Line 1\nLine 2\nLine 3';
            const translation = '行1\n行2\n行3';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle newlines');
        });

        test('should handle empty translation', () => {
            const text = 'Some text';
            const translation = '';

            cache.set(text, translation);
            const result = cache.get(text);

            assert.strictEqual(result, translation, 'Should handle empty translation');
        });

        test('should differentiate between similar texts', () => {
            cache.set('test', 'テスト1');
            cache.set('test ', 'テスト2');
            cache.set(' test', 'テスト3');

            assert.strictEqual(cache.get('test'), 'テスト1');
            assert.strictEqual(cache.get('test '), 'テスト2');
            assert.strictEqual(cache.get(' test'), 'テスト3');
            assert.strictEqual(cache.size, 3, 'Should treat similar texts as different');
        });
    });
});
