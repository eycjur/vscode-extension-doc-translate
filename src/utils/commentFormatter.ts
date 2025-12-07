import { logger } from './logger';

/**
 * Comment format configuration for each language
 */
interface CommentFormat {
  docstringOpen: string;
  docstringClose: string;
  docstringLinePrefix: string;
  commentPrefix: string;
}

/**
 * Get comment format for a specific language
 */
export function getCommentFormat(languageId: string): CommentFormat {
  switch (languageId) {
    case 'python':
      return {
        docstringOpen: '"""',
        docstringClose: '"""',
        docstringLinePrefix: '',
        commentPrefix: '# '
      };
    case 'javascript':
    case 'typescript':
    case 'javascriptreact':
    case 'typescriptreact':
      return {
        docstringOpen: '/**',
        docstringClose: ' */',
        docstringLinePrefix: ' * ',
        commentPrefix: '// '
      };
    case 'go':
      return {
        docstringOpen: '/*',
        docstringClose: ' */',
        docstringLinePrefix: ' * ',
        commentPrefix: '// '
      };
    case 'markdown':
      return {
        docstringOpen: '',
        docstringClose: '',
        docstringLinePrefix: '> ',
        commentPrefix: '> '
      };
    default:
      logger.warn(
        'Unknown language: ' + languageId + ', using default comment format'
      );
      return {
        docstringOpen: '/*',
        docstringClose: ' */',
        docstringLinePrefix: ' * ',
        commentPrefix: '// '
      };
  }
}

/**
 * Format docstring translation for display
 */
export function formatDocstring(
  translation: string,
  languageId: string,
  indentation: string = ''
): string[] {
  const format = getCommentFormat(languageId);
  const lines = translation.split('\n');

  if (lines.length === 1) {
    // Single line docstring
    return [
      indentation + format.docstringOpen + lines[0] + format.docstringClose
    ];
  }

  // Multi-line docstring
  const result: string[] = [];

  // Opening line
  if (format.docstringOpen) {
    result.push(indentation + format.docstringOpen);
  }

  // Content lines
  for (const line of lines) {
    result.push(indentation + format.docstringLinePrefix + line);
  }

  // Closing line
  if (format.docstringClose) {
    result.push(indentation + format.docstringClose);
  }

  return result;
}

/**
 * Format comment translation for display
 */
export function formatComment(translation: string, languageId: string): string {
  const format = getCommentFormat(languageId);
  // For comments, join multiple lines with space
  const singleLine = translation.split('\n').join(' ');
  return format.commentPrefix + singleLine;
}
