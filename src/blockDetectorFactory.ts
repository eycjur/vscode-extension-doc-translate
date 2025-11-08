import { IBlockDetector } from './blockDetector';
import { PythonBlockDetector } from './pythonBlockDetector';
import { JavaScriptBlockDetector } from './javascriptBlockDetector';
import { GoBlockDetector } from './goBlockDetector';
import { logger } from './logger';

/**
 * Factory for creating block detectors based on language ID
 */
export class BlockDetectorFactory {
    private static detectors = new Map<string, IBlockDetector>();

    /**
     * Get the block detector for the given language ID
     */
    static getDetector(languageId: string): IBlockDetector | null {
        // Return cached detector if available
        if (this.detectors.has(languageId)) {
            return this.detectors.get(languageId)!;
        }

        // Create new detector based on language
        let detector: IBlockDetector | null = null;

        switch (languageId) {
            case 'python':
                detector = new PythonBlockDetector();
                break;
            case 'javascript':
            case 'typescript':
            case 'javascriptreact':
            case 'typescriptreact':
                detector = new JavaScriptBlockDetector();
                break;
            case 'go':
                detector = new GoBlockDetector();
                break;
            default:
                logger.warn(`No block detector available for language: ${languageId}`);
                return null;
        }

        // Cache the detector
        this.detectors.set(languageId, detector);
        logger.debug(`Created block detector for language: ${languageId}`);

        return detector;
    }

    /**
     * Check if a language is supported
     */
    static isLanguageSupported(languageId: string): boolean {
        return ['python', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'go'].includes(languageId);
    }

    /**
     * Clear cached detectors
     */
    static clearCache(): void {
        this.detectors.clear();
        logger.debug('Block detector cache cleared');
    }
}
