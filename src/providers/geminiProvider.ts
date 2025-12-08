import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { BaseProvider } from './base/baseProvider';
import { ConfigManager } from '../utils/config';

// Google Generative AI SDK types (will be installed later)
interface GenerativeModel {
  generateContent(request: any): Promise<any>;
}

interface GoogleGenerativeAI {
  getGenerativeModel(params: { model: string }): GenerativeModel;
}

export class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor() {
    super();
    this.initializeClient();
  }

  protected async initializeClient(): Promise<void> {
    const apiKey = ConfigManager.getGeminiApiKey();
    if (apiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this.client = new GoogleGenerativeAI(apiKey);
        const modelName = ConfigManager.getGeminiModel();
        this.model = this.client.getGenerativeModel({ model: modelName });
        logger.info('Gemini client initialized successfully');
      } catch (error) {
        logger.error(
          'Failed to import Google Generative AI SDK. Please install: npm install @google/generative-ai',
          error
        );
      }
    } else {
      logger.warn('No Gemini API key found. Client not initialized.');
    }
  }

  protected getProviderName(): string {
    return 'Gemini';
  }

  protected getModel(): string {
    return ConfigManager.getGeminiModel();
  }

  protected getApiKeyMissingError(): string {
    return vscode.l10n.t('error.gemini.apiKeyMissing');
  }

  protected getSettingsKey(): string {
    return 'docTranslate.geminiApiKey';
  }

  protected isClientInitialized(): boolean {
    return this.client !== null && this.model !== null;
  }

  protected async callTranslationAPI(
    prompt: string,
    timeout: number
  ): Promise<string> {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeout);
    });

    // Race between the API call and timeout
    const response = await Promise.race([
      this.model!.generateContent(prompt),
      timeoutPromise
    ]);

    if (!response || !response.response) {
      throw new Error(vscode.l10n.t('error.gemini.emptyResponse'));
    }

    const text = response.response.text();
    if (!text) {
      throw new Error(vscode.l10n.t('error.gemini.noContent'));
    }

    return text.trim();
  }

  protected async callBatchTranslationAPI(
    prompt: string,
    timeout: number,
    textsCount: number
  ): Promise<string> {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeout);
    });

    // Race between the API call and timeout
    const result = await Promise.race([
      this.model!.generateContent(prompt),
      timeoutPromise
    ]);

    if (!result || !result.response) {
      throw new Error(vscode.l10n.t('error.gemini.emptyResponse'));
    }

    const content = result.response.text();
    if (!content) {
      throw new Error(vscode.l10n.t('error.gemini.noContent'));
    }

    return content.trim();
  }

  updateConfiguration(): void {
    logger.info('Configuration changed, re-initializing Gemini client');
    this.initializeClient();
  }
}
