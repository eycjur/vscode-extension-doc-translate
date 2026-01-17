/**
 * Global semaphore for limiting concurrent API requests across all files
 */
export class GlobalSemaphore {
  private static instance: GlobalSemaphore | null = null;
  private maxConcurrent: number;
  private currentCount: number = 0;
  private waitingQueue: Array<() => void> = [];

  private constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Get the singleton instance of the global semaphore
   */
  static getInstance(maxConcurrent: number = 10): GlobalSemaphore {
    if (!GlobalSemaphore.instance) {
      GlobalSemaphore.instance = new GlobalSemaphore(maxConcurrent);
    }
    return GlobalSemaphore.instance;
  }

  /**
   * Update the maximum concurrent requests limit
   */
  updateMaxConcurrent(maxConcurrent: number): void {
    this.maxConcurrent = maxConcurrent;
    // Process waiting queue if we can now allow more
    this.processWaitingQueue();
  }

  /**
   * Acquire a slot in the semaphore
   * Returns a promise that resolves when a slot is available
   */
  async acquire(): Promise<void> {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return;
    }

    // Wait for a slot to become available
    return new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  /**
   * Release a slot in the semaphore
   */
  release(): void {
    this.currentCount--;
    this.processWaitingQueue();
  }

  /**
   * Process the waiting queue if slots are available
   */
  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0 && this.currentCount < this.maxConcurrent) {
      const resolve = this.waitingQueue.shift();
      if (resolve) {
        this.currentCount++;
        resolve();
      }
    }
  }

  /**
   * Execute a function with semaphore control
   * Automatically acquires and releases the semaphore
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get the current number of active requests
   */
  getActiveCount(): number {
    return this.currentCount;
  }

  /**
   * Get the number of waiting requests in the queue
   */
  getWaitingCount(): number {
    return this.waitingQueue.length;
  }

  /**
   * Get the maximum concurrent requests limit
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    GlobalSemaphore.instance = null;
  }
}
