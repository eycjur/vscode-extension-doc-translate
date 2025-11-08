import * as vscode from 'vscode';

export interface TextBlock {
    text: string;
    range: vscode.Range;
    type: 'docstring' | 'comment';
}

/**
 * Block detector interface for different programming languages
 */
export interface IBlockDetector {
    /**
     * Extract translatable text block at the given position using LSP
     */
    extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null>;

    /**
     * Extract docstring starting from a specific line
     */
    extractDocstringFromLine(document: vscode.TextDocument, startLine: number): Omit<TextBlock, 'type'> | null;

    /**
     * Extract inline comment from a line
     */
    extractInlineComment(document: vscode.TextDocument, lineNumber: number): Omit<TextBlock, 'type'> | null;

    /**
     * Extract module-level docstring (top-level docstring at the beginning of file)
     */
    extractModuleDocstring(document: vscode.TextDocument): Omit<TextBlock, 'type'> | null;

    /**
     * Extract all translatable blocks from document (for pre-translation)
     */
    extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]>;
}
