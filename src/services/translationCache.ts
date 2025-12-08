import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

const CACHE_STORAGE_KEY = 'doc-translate.translationCache';

export class TranslationCache {
  private cache: Map<string, string> = new Map();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }

  private hash(text: string, targetLang: string): string {
    return crypto
      .createHash('sha256')
      .update(`${text}:${targetLang}`)
      .digest('hex');
  }

  /**
   * Get workspace identifier for logging
   */
  private getWorkspaceInfo(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return workspaceFolder.name;
    }
    return 'no workspace';
  }

  /**
   * Load cache from persistent storage (workspace-specific)
   */
  private load(): void {
    try {
      const stored =
        this.context.workspaceState.get<Record<string, string>>(CACHE_STORAGE_KEY);
      if (stored) {
        this.cache = new Map(Object.entries(stored));
        logger.info(
          `Loaded ${this.cache.size} cached translations from workspace storage (${this.getWorkspaceInfo()})`
        );
      } else {
        logger.info(`No cached translations found in workspace storage (${this.getWorkspaceInfo()})`);
      }
    } catch (error) {
      logger.error('Failed to load cache from workspace storage', error);
    }
  }

  /**
   * Save cache to persistent storage (workspace-specific)
   */
  private async save(): Promise<void> {
    try {
      const obj = Object.fromEntries(this.cache);
      await this.context.workspaceState.update(CACHE_STORAGE_KEY, obj);
      logger.debug(`Saved ${this.cache.size} cached translations to workspace storage (${this.getWorkspaceInfo()})`);
    } catch (error) {
      logger.error('Failed to save cache to workspace storage', error);
    }
  }

  get(text: string, targetLang: string): string | undefined {
    const key = this.hash(text, targetLang);
    const result = this.cache.get(key);
    logger.debug(
      `Cache ${result ? 'HIT' : 'MISS'} for key: ${key.substring(
        0,
        16
      )}... (text: "${text.substring(0, 50)}...")`
    );
    return result;
  }

  set(text: string, translation: string, targetLang: string): void {
    const key = this.hash(text, targetLang);
    logger.debug(
      `Cache SET for key: ${key.substring(0, 16)}... (text: "${text.substring(
        0,
        50
      )}...")`
    );
    this.cache.set(key, translation);

    // Save to persistent storage asynchronously
    this.save();
  }

  clear(): void {
    this.cache.clear();
    // Save empty cache to storage
    this.save();
  }

  get size(): number {
    return this.cache.size;
  }
}
