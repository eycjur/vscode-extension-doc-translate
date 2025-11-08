import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';

export class ClaudeClient {
    private client: Anthropic | null = null;
    private readonly translationPromptTemplate = `You are a translation assistant specialized in software engineering context.
Translate the given text from English into natural Japanese.

Rules:

Preserve technical terms (library names, function names, class names, variable names) as they are.

Prefer natural Japanese rather than literal translation.

Output ONLY the translated Japanese text. No explanation, no English.

Translate this text:
{{COMMENT_TEXT}}`;

    constructor() {
        this.initializeClient();
    }

    private initializeClient(): void {
        const apiKey = this.getApiKey();
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
        }
    }

    private getApiKey(): string | undefined {
        // Environment variable takes precedence
        const envKey = process.env.ANTHROPIC_API_KEY;
        if (envKey) {
            return envKey;
        }

        // Fall back to VSCode configuration
        const config = vscode.workspace.getConfiguration('docTranslate');
        const configKey = config.get<string>('anthropicApiKey');
        if (configKey && configKey.trim() !== '') {
            return configKey;
        }

        return undefined;
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<string>('model') || 'claude-3-5-sonnet-20241022';
    }

    private getTimeout(): number {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<number>('timeout') || 30000;
    }

    async translate(text: string): Promise<string> {
        if (!this.client) {
            // Re-initialize in case API key was added after extension activation
            this.initializeClient();
            if (!this.client) {
                throw new Error('API key not configured. Please set ANTHROPIC_API_KEY environment variable or configure docTranslate.anthropicApiKey in settings.');
            }
        }

        const prompt = this.translationPromptTemplate.replace('{{COMMENT_TEXT}}', text);
        const model = this.getModel();
        const timeout = this.getTimeout();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await this.client.messages.create(
                {
                    model,
                    max_tokens: 1024,
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                },
                {
                    signal: controller.signal as AbortSignal,
                }
            );

            clearTimeout(timeoutId);

            if (response.content.length === 0) {
                throw new Error('Empty response from Claude API');
            }

            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type from Claude API');
            }

            return content.text.trim();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error(`Translation request timed out after ${timeout}ms`);
            }
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    // Re-initialize client when configuration changes
    updateConfiguration(): void {
        this.initializeClient();
    }
}
