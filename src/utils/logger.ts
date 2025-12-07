import * as vscode from 'vscode';

interface NotificationAction {
  label: string;
  callback: () => void | Thenable<void>;
}

class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;
  private recentErrors: Map<string, number> = new Map(); // Track recent errors to avoid spam
  private readonly ERROR_COOLDOWN_MS = 60000; // Don't show same error more than once per minute

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Doc Translate');
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  public info(message: string): void {
    const formatted = this.formatMessage('INFO', message);
    this.outputChannel.appendLine(formatted);
    console.log(formatted);
  }

  public warn(message: string): void {
    const formatted = this.formatMessage('WARN', message);
    this.outputChannel.appendLine(formatted);
    console.warn(formatted);
  }

  public error(message: string, error?: any): void {
    const formatted = this.formatMessage('ERROR', message);
    this.outputChannel.appendLine(formatted);
    if (error) {
      this.outputChannel.appendLine(
        `  ${error.stack || error.message || error}`
      );
    }
    console.error(formatted, error);
  }

  public debug(message: string, data?: any): void {
    const formatted = this.formatMessage('DEBUG', message);
    this.outputChannel.appendLine(formatted);
    if (data) {
      this.outputChannel.appendLine(`  ${JSON.stringify(data, null, 2)}`);
    }
    console.log(formatted, data);
  }

  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Check if we should show this error notification (to avoid spam)
   */
  private shouldShowError(errorKey: string): boolean {
    const now = Date.now();
    const lastShown = this.recentErrors.get(errorKey);

    if (!lastShown || now - lastShown > this.ERROR_COOLDOWN_MS) {
      this.recentErrors.set(errorKey, now);
      return true;
    }

    return false;
  }

  /**
   * Show error notification with action to view logs
   * Use for critical errors that require user attention
   */
  public notifyCriticalError(
    message: string,
    error?: any,
    actions: NotificationAction[] = []
  ): void {
    this.error(message, error);

    const errorKey = `critical:${message}`;
    if (!this.shouldShowError(errorKey)) {
      return;
    }

    const actionLabels = actions.map((action) => action.label);
    const selectionItems = [...actionLabels, vscode.l10n.t('action.viewLogs')];

    vscode.window
      .showErrorMessage(`Doc Translate: ${message}`, ...selectionItems)
      .then((selection) => {
        if (!selection) {
          return;
        }

        if (selection === vscode.l10n.t('action.viewLogs')) {
          this.show();
          return;
        }

        const action = actions.find((item) => item.label === selection);
        if (action) {
          action.callback();
        }
      });
  }

  /**
   * Show error notification in status bar (less intrusive)
   * Use for non-critical errors
   */
  public notifyError(message: string, error?: any): void {
    this.error(message, error);

    const errorKey = `error:${message}`;
    if (!this.shouldShowError(errorKey)) {
      return;
    }

    // Show error in status bar temporarily
    this.statusBarItem.text = `$(error) ${message}`;
    this.statusBarItem.tooltip = vscode.l10n.t('logger.tooltip.viewLogs');
    this.statusBarItem.command = 'doc-translate.showLogs';
    this.statusBarItem.show();

    // Hide after 5 seconds
    setTimeout(() => {
      this.statusBarItem.hide();
    }, 5000);
  }

  /**
   * Show warning notification in status bar
   */
  public notifyWarning(message: string): void {
    this.warn(message);

    const errorKey = `warn:${message}`;
    if (!this.shouldShowError(errorKey)) {
      return;
    }

    this.statusBarItem.text = `$(warning) ${message}`;
    this.statusBarItem.tooltip = vscode.l10n.t('logger.tooltip.viewLogs');
    this.statusBarItem.command = 'doc-translate.showLogs';
    this.statusBarItem.show();

    setTimeout(() => {
      this.statusBarItem.hide();
    }, 3000);
  }

  public dispose(): void {
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
  }
}

export const logger = Logger.getInstance();
