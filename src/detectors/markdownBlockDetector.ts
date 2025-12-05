import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { TextBlock } from './base/blockDetector';
import { BaseBlockDetector } from './base/baseDetector';

export class MarkdownBlockDetector extends BaseBlockDetector {
  /**
   * Extract translatable text block at the given position
   */
  async extractBlock(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<TextBlock | null> {
    // For Markdown, we can reuse the bulk extraction logic and find the block containing the position
    const blocks = await this.extractAllBlocks(document);
    return blocks.find((block) => block.range.contains(position)) || null;
  }

  /**
   * Extract all translatable blocks from document
   * Detects: Headers, Paragraphs, List Items, Blockquotes
   * Ignores: Code Blocks, HTML, Empty lines
   */
  async extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]> {
    const blocks: TextBlock[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check for code block delimiters
      if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Skip if inside code block
      if (inCodeBlock) {
        continue;
      }

      // Skip empty lines
      if (trimmedLine === '') {
        continue;
      }

      // Skip HTML comments
      if (trimmedLine.startsWith('<!--')) {
        continue;
      }

      // Skip horizontal rules
      if (/^[-*_]{3,}\s*$/.test(trimmedLine)) {
        continue;
      }

      // Skip images (lines that are ONLY images)
      if (/^!\[.*\]\(.*\)$/.test(trimmedLine)) {
        continue;
      }

      // Detect Headers (# Header)
      if (/^#{1,6}\s+.+/.test(trimmedLine)) {
        this.addBlock(blocks, line, i, 'docstring'); // Treat as docstring/text
        continue;
      }

      // Detect Blockquotes (> Quote)
      if (trimmedLine.startsWith('>')) {
        // Remove '>' and trim
        const content = trimmedLine.replace(/^>\s?/, '').trim();
        if (content) {
          this.addBlock(blocks, content, i, 'docstring');
        }
        continue;
      }

      // Detect List Items (- Item, * Item, 1. Item)
      // Note: We want to translate the content, not the bullet point
      const listMatch = trimmedLine.match(/^(\s*[-*+]|\s*\d+\.)\s+(.+)/);
      if (listMatch) {
        const content = listMatch[2];
        this.addBlock(blocks, content, i, 'docstring');
        continue;
      }

      // Detect Table Rows (simple detection)
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        // Skip separator lines (e.g. |---|---|)
        if (/^\|[\s-:]+\|$/.test(trimmedLine.replace(/\|/g, ''))) {
          continue;
        }
        // For tables, we might want to skip or handle carefully.
        // For now, let's skip complex table parsing to avoid breaking layout
        continue;
      }

      // Regular Paragraph
      // If it's not any of the above, treat as a paragraph
      this.addBlock(blocks, line, i, 'docstring');
    }

    return this.deduplicateBlocks(blocks);
  }

  private addBlock(
    blocks: TextBlock[],
    text: string,
    lineIndex: number,
    type: 'docstring' | 'comment'
  ): void {
    const cleanText = text.trim();
    if (cleanText) {
      blocks.push({
        text: cleanText,
        range: new vscode.Range(lineIndex, 0, lineIndex, text.length),
        type: type
      });
    }
  }

  // Required by interface but not used for Markdown bulk extraction
  extractDocstringFromLine(
    document: vscode.TextDocument,
    startLine: number
  ): Omit<TextBlock, 'type'> | null {
    return null;
  }

  extractInlineComment(
    document: vscode.TextDocument,
    lineNumber: number
  ): Omit<TextBlock, 'type'> | null {
    return null;
  }

  extractModuleDocstring(
    document: vscode.TextDocument
  ): Omit<TextBlock, 'type'> | null {
    return null;
  }
}
