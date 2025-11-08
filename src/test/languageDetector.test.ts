import * as assert from 'assert';
import { detectLanguage, isTranslationNeeded } from '../utils/languageDetector';

suite('Language Detector Test Suite', () => {
    suite('detectLanguage', () => {
        test('should detect English text', async () => {
            const text = 'This is a sample English text for testing language detection.';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'en', 'Should detect English');
        });

        test('should detect Japanese text', async () => {
            const text = 'これは日本語のテキストです。言語検出のテストに使用されます。';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'ja', 'Should detect Japanese');
        });

        test('should detect Chinese text', async () => {
            const text = '这是一个中文文本示例，用于测试语言检测功能。';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'zh', 'Should detect Chinese');
        });

        test('should detect Korean text', async () => {
            const text = '이것은 한국어 텍스트입니다. 언어 감지 테스트에 사용됩니다.';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'ko', 'Should detect Korean');
        });

        test('should detect Spanish text', async () => {
            const text = 'Este es un texto de muestra en español para probar la detección de idioma.';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'es', 'Should detect Spanish');
        });

        test('should detect French text', async () => {
            const text = 'Ceci est un exemple de texte en français pour tester la détection de langue.';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'fr', 'Should detect French');
        });

        test('should return "und" for very short text', async () => {
            const text = 'a';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'und', 'Should return "und" for text too short to detect');
        });

        test('should handle code-like text', async () => {
            const text = 'Calculate the sum of two numbers';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'en', 'Should detect English in code comment');
        });

        test('should handle mixed content with predominant language', async () => {
            const text = 'This function calculates the total. パラメータは数値です。';
            const result = await detectLanguage(text);

            // The result depends on which language has more content
            // franc will detect the predominant language
            assert.ok(['en', 'ja'].includes(result), 'Should detect either English or Japanese');
        });

        test('should handle empty string', async () => {
            const text = '';
            const result = await detectLanguage(text);

            assert.strictEqual(result, 'und', 'Should return "und" for empty string');
        });
    });

    suite('isTranslationNeeded', () => {
        test('should return false when source and target are same (English)', async () => {
            const text = 'This is an English text.';
            const targetLang = 'en';

            const result = await isTranslationNeeded(text, targetLang);

            assert.strictEqual(result, false, 'Should not need translation');
        });

        test('should return false when source and target are same (Japanese)', async () => {
            const text = 'これは日本語のテキストです。';
            const targetLang = 'ja';

            const result = await isTranslationNeeded(text, targetLang);

            assert.strictEqual(result, false, 'Should not need translation');
        });

        test('should return true when source and target are different', async () => {
            const text = 'This is an English text.';
            const targetLang = 'ja';

            const result = await isTranslationNeeded(text, targetLang);

            assert.strictEqual(result, true, 'Should need translation');
        });

        test('should return true when source language is undetermined', async () => {
            const text = 'xyz';
            const targetLang = 'ja';

            const result = await isTranslationNeeded(text, targetLang);

            assert.strictEqual(result, true, 'Should need translation when language is undetermined');
        });

        test('should handle Japanese to English translation', async () => {
            const text = 'これはテストです。';
            const targetLang = 'en';

            const result = await isTranslationNeeded(text, targetLang);

            assert.strictEqual(result, true, 'Should need translation from Japanese to English');
        });

        test('should handle code comments in English targeting Japanese', async () => {
            const text = 'Returns the sum of two numbers';
            const targetLang = 'ja';

            const result = await isTranslationNeeded(text, targetLang);

            assert.strictEqual(result, true, 'Should need translation from English to Japanese');
        });

        test('should handle empty text', async () => {
            const text = '';
            const targetLang = 'ja';

            const result = await isTranslationNeeded(text, targetLang);

            // Empty text is undetermined, so should return true
            assert.strictEqual(result, true, 'Should need translation for empty text');
        });
    });
});
