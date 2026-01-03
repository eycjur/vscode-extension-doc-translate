import * as path from 'path';
import * as vscode from 'vscode';
import { minimatch } from 'minimatch';

const toPosixPath = (inputPath: string): string => inputPath.replace(/\\/g, '/');

export const isPathExcluded = (
  filePath: string,
  workspaceRoot: string | undefined,
  patterns: string[]
): boolean => {
  if (!filePath || patterns.length === 0) {
    return false;
  }

  const normalizedFilePath = toPosixPath(filePath);
  const normalizedWorkspaceRoot = workspaceRoot
    ? toPosixPath(workspaceRoot)
    : undefined;
  const relativePath =
    normalizedWorkspaceRoot &&
    normalizedFilePath.startsWith(`${normalizedWorkspaceRoot}/`)
      ? normalizedFilePath.slice(normalizedWorkspaceRoot.length + 1)
      : undefined;
  const basename = path.basename(filePath);

  return patterns.some((pattern) => {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return false;
    }
    const normalizedPattern = toPosixPath(trimmed);

    if (
      relativePath &&
      minimatch(relativePath, normalizedPattern, { dot: true })
    ) {
      return true;
    }

    return minimatch(basename, normalizedPattern, { dot: true });
  });
};

export const isDocumentExcluded = (
  document: vscode.TextDocument,
  patterns: string[]
): boolean => {
  const filePath = document.uri.fsPath;
  if (!filePath) {
    return false;
  }
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const workspaceRoot = workspaceFolder?.uri.fsPath;

  return isPathExcluded(filePath, workspaceRoot, patterns);
};
