import * as vscode from 'vscode';
import { TranslationCache } from './translationCache';
import { logger } from '../utils/logger';
import { formatDocstring, formatComment } from '../utils/commentFormatter';
import { ConfigManager } from '../utils/config';
import { isDocumentExcluded } from '../utils/excludeMatcher';

interface DocstringDecorationGroup {
  blockRange: vscode.Range; // Original docstring block range
  decorations: vscode.DecorationOptions[]; // All decorations for this docstring
}

interface CommentDecorationGroup {
  blockRange: vscode.Range; // Original comment block range
  decorations: vscode.DecorationOptions[]; // All decorations for this comment
}

export class InlineTranslationProvider {
  private docstringDecorationType: vscode.TextEditorDecorationType;
  private cache: TranslationCache;
  private commentDecorationGroups = new Map<
    string,
    CommentDecorationGroup[]
  >();
  private docstringDecorationGroups = new Map<
    string,
    DocstringDecorationGroup[]
  >();

  constructor(cache: TranslationCache) {
    this.cache = cache;

    // Create decoration type for translations (overlay/replace) - used for both comments and docstrings
    this.docstringDecorationType = vscode.window.createTextEditorDecorationType(
      {
        opacity: '0', // Hide original text
        color: 'transparent', // Make text color transparent
        isWholeLine: false,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
      }
    );
  }

  /**
   * Update inline translations for a document
   */
  async updateInlineTranslations(
    document: vscode.TextDocument,
    blocks: Array<{
      text: string;
      range: vscode.Range;
      type: 'docstring' | 'comment';
    }>
  ): Promise<void> {
    if (isDocumentExcluded(document, ConfigManager.getExcludePatterns())) {
      this.clearFileDecorations(document.uri);
      logger.info(`Skipped inline translations for excluded file: ${document.fileName}`);
      return;
    }

    const fileKey = document.uri.toString();
    const commentGroups: CommentDecorationGroup[] = [];
    const docstringGroups: DocstringDecorationGroup[] = [];

    logger.debug(`Updating inline translations for ${blocks.length} blocks`);

    for (const block of blocks) {
      const translation = this.cache.get(
        block.text,
        ConfigManager.getTargetLang()
      );
      if (!translation) {
        continue;
      }

      // Skip overlay if translation is the same as original text
      // (translation was skipped because it's already in target language)
      // Normalize whitespace for comparison
      const normalizedTranslation = translation.trim().replace(/\s+/g, ' ');
      const normalizedOriginal = block.text.trim().replace(/\s+/g, ' ');
      if (normalizedTranslation === normalizedOriginal) {
        logger.debug(
          `Skipping overlay for block (translation same as original): ${block.text.substring(0, 50)}...`
        );
        continue;
      }

      if (block.type === 'comment') {
        // Comment: hide original and show translation overlay (same as docstring)
        const lineNum = block.range.start.line;
        const line = document.lineAt(lineNum);
        const startCol = block.range.start.character;
        const endCol = block.range.end.character;

        // Format translation with language-specific comment syntax
        const formattedComment = formatComment(
          translation,
          document.languageId
        );

        // Create decorations for this comment
        const groupDecorations: vscode.DecorationOptions[] = [];

        // Hide original comment text
        const hideRange = new vscode.Range(lineNum, startCol, lineNum, endCol);
        const hideDecoration: vscode.DecorationOptions = {
          range: hideRange
        };
        groupDecorations.push(hideDecoration);

        // Show formatted translation
        const showDecoration: vscode.DecorationOptions = {
          range: new vscode.Range(lineNum, startCol, lineNum, startCol),
          renderOptions: {
            before: {
              contentText: formattedComment,
              color: new vscode.ThemeColor('editorCodeLens.foreground'),
              fontStyle: 'italic'
            }
          }
        };
        groupDecorations.push(showDecoration);

        // Add this group to comment groups
        commentGroups.push({
          blockRange: block.range,
          decorations: groupDecorations
        });
      } else {
        // Docstring: hide original and show translation overlay (multi-line)
        const startLine = block.range.start.line;
        const endLine = block.range.end.line;
        const startCol = block.range.start.character;
        // We don't need to recreate indentation string because we will preserve the original indentation
        const indentation = '';

        // Format translation with language-specific comment syntax
        const formattedLines = formatDocstring(
          translation,
          document.languageId,
          indentation
        );

        // Create a group for this docstring
        const groupDecorations: vscode.DecorationOptions[] = [];

        // Process each line of the original docstring (hide them)
        for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
          const line = document.lineAt(lineNum);
          // Hide only the content, preserving the indentation
          // Ensure we don't start after the end of the line (e.g. empty lines)
          const hideStartCol = Math.min(startCol, line.text.length);
          const lineRange = new vscode.Range(
            lineNum,
            hideStartCol,
            lineNum,
            line.text.length
          );

          // Hide this line
          const hideLineDecoration: vscode.DecorationOptions = {
            range: lineRange
          };
          groupDecorations.push(hideLineDecoration);
        }

        // Show formatted translation lines
        for (let i = 0; i < formattedLines.length; i++) {
          const displayLine = Math.min(startLine + i, endLine);
          // Display translation after the preserved indentation
          const lineDecoration: vscode.DecorationOptions = {
            range: new vscode.Range(
              displayLine,
              startCol,
              displayLine,
              startCol
            ),
            renderOptions: {
              before: {
                contentText: formattedLines[i],
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
                fontStyle: 'italic'
              }
            }
          };
          groupDecorations.push(lineDecoration);
        }

        // Add this group to docstring groups
        docstringGroups.push({
          blockRange: block.range,
          decorations: groupDecorations
        });
      }
    }

    // Store decorations for this file
    this.commentDecorationGroups.set(fileKey, commentGroups);
    this.docstringDecorationGroups.set(fileKey, docstringGroups);

    // Apply decorations to visible editors (with selection filtering)
    this.updateDecorationsForEditor(document);

    logger.info(
      `Applied ${commentGroups.length} comment groups and ${docstringGroups.length} docstring groups`
    );
  }

  /**
   * Update decorations for a document, filtering out decorations that overlap with selections
   */
  private updateDecorationsForEditor(document: vscode.TextDocument): void {
    const fileKey = document.uri.toString();

    // First, check active editor (most important for newly opened files)
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.toString() === fileKey) {
      this.applyDecorationsToEditor(activeEditor);
      return;
    }

    // Then check all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === fileKey) {
        this.applyDecorationsToEditor(editor);
        return;
      }
    }

    // If not found in visible editors, wait a bit and try again
    // (file might have just been opened and editor not yet in visibleTextEditors)
    setTimeout(() => {
      const retryEditor = vscode.window.activeTextEditor;
      if (retryEditor && retryEditor.document.uri.toString() === fileKey) {
        this.applyDecorationsToEditor(retryEditor);
      } else {
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document.uri.toString() === fileKey) {
            this.applyDecorationsToEditor(editor);
            break;
          }
        }
      }
    }, 100);
  }

  /**
   * Apply decorations to an editor, excluding decorations that overlap with selections
   */
  private applyDecorationsToEditor(editor: vscode.TextEditor): void {
    const fileKey = editor.document.uri.toString();
    const commentGroups = this.commentDecorationGroups.get(fileKey) || [];
    const docstringGroups = this.docstringDecorationGroups.get(fileKey) || [];

    // Filter out groups where cursor/selection overlaps with block range
    const filteredCommentDecorations = this.filterGroupsBySelection(
      commentGroups,
      editor.selections
    );
    const filteredDocstringDecorations = this.filterGroupsBySelection(
      docstringGroups,
      editor.selections
    );

    // Combine all decorations (comments and docstrings use the same decoration type)
    const allDecorations = [
      ...filteredCommentDecorations,
      ...filteredDocstringDecorations
    ];

    editor.setDecorations(this.docstringDecorationType, allDecorations);
  }

  /**
   * Filter groups by checking if cursor/selection overlaps with block range
   * If cursor is anywhere in a block, exclude all decorations for that block
   */
  private filterGroupsBySelection(
    groups: (DocstringDecorationGroup | CommentDecorationGroup)[],
    selections: readonly vscode.Selection[]
  ): vscode.DecorationOptions[] {
    const result: vscode.DecorationOptions[] = [];

    for (const group of groups) {
      let shouldInclude = true;

      // Check if any selection/cursor overlaps with this block
      for (const selection of selections) {
        // Check for selection range overlap
        if (group.blockRange.intersection(selection)) {
          shouldInclude = false;
          break;
        }

        // Check if cursor is inside this block (even without selection)
        if (selection.isEmpty && group.blockRange.contains(selection.active)) {
          shouldInclude = false;
          break;
        }
      }

      // If no overlap, include all decorations from this group
      if (shouldInclude) {
        result.push(...group.decorations);
      }
    }

    return result;
  }

  /**
   * Clear inline translations for a file
   */
  clearFileDecorations(uri: vscode.Uri): void {
    const fileKey = uri.toString();
    this.commentDecorationGroups.delete(fileKey);
    this.docstringDecorationGroups.delete(fileKey);

    // Clear decorations from visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === fileKey) {
        editor.setDecorations(this.docstringDecorationType, []);
      }
    }

    logger.debug(`Cleared inline translations for: ${uri.fsPath}`);
  }

  /**
   * Clear all inline translations
   */
  clearAllDecorations(): void {
    this.commentDecorationGroups.clear();
    this.docstringDecorationGroups.clear();

    // Clear from all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.docstringDecorationType, []);
    }

    logger.info('Cleared all inline translations');
  }

  /**
   * Refresh decorations for visible editors (called when editor or selection changes)
   */
  refreshVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.applyDecorationsToEditor(editor);
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.docstringDecorationType.dispose();
  }
}
