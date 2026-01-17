import * as assert from 'assert';
import { GlobalSemaphore } from '../utils/globalSemaphore';

suite('GlobalSemaphore Test Suite', () => {
  setup(() => {
    // Reset singleton instance before each test
    GlobalSemaphore.resetInstance();
  });

  suite('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = GlobalSemaphore.getInstance(10);
      const instance2 = GlobalSemaphore.getInstance(5);

      assert.strictEqual(instance1, instance2, 'Should return the same instance');
      assert.strictEqual(instance1.getMaxConcurrent(), 10, 'Should use first initialization value');
    });

    test('should create new instance after reset', () => {
      const instance1 = GlobalSemaphore.getInstance(10);
      GlobalSemaphore.resetInstance();
      const instance2 = GlobalSemaphore.getInstance(5);

      assert.notStrictEqual(instance1, instance2, 'Should return different instances after reset');
      assert.strictEqual(instance2.getMaxConcurrent(), 5, 'Should use new initialization value');
    });
  });

  suite('Acquire and Release', () => {
    test('should acquire and release correctly', async () => {
      const semaphore = GlobalSemaphore.getInstance(2);

      await semaphore.acquire();
      assert.strictEqual(semaphore.getActiveCount(), 1, 'Should have 1 active');

      await semaphore.acquire();
      assert.strictEqual(semaphore.getActiveCount(), 2, 'Should have 2 active');

      semaphore.release();
      assert.strictEqual(semaphore.getActiveCount(), 1, 'Should have 1 active after release');

      semaphore.release();
      assert.strictEqual(semaphore.getActiveCount(), 0, 'Should have 0 active after release');
    });

    test('should queue when limit is reached', async () => {
      const semaphore = GlobalSemaphore.getInstance(1);

      await semaphore.acquire();
      assert.strictEqual(semaphore.getActiveCount(), 1, 'Should have 1 active');
      assert.strictEqual(semaphore.getWaitingCount(), 0, 'Should have 0 waiting');

      // Start acquiring but don't await (will be queued)
      const acquirePromise = semaphore.acquire();
      // Give the promise time to register
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.strictEqual(semaphore.getWaitingCount(), 1, 'Should have 1 waiting');

      // Release to allow the waiting request to proceed
      semaphore.release();
      await acquirePromise;
      assert.strictEqual(semaphore.getActiveCount(), 1, 'Should have 1 active after queued request proceeds');
      assert.strictEqual(semaphore.getWaitingCount(), 0, 'Should have 0 waiting after release');

      semaphore.release();
    });
  });

  suite('Execute Method', () => {
    test('should execute function with semaphore control', async () => {
      const semaphore = GlobalSemaphore.getInstance(2);

      const result = await semaphore.execute(async () => {
        assert.strictEqual(semaphore.getActiveCount(), 1, 'Should have 1 active during execution');
        return 'success';
      });

      assert.strictEqual(result, 'success', 'Should return function result');
      assert.strictEqual(semaphore.getActiveCount(), 0, 'Should have 0 active after execution');
    });

    test('should release on error', async () => {
      const semaphore = GlobalSemaphore.getInstance(2);

      try {
        await semaphore.execute(async () => {
          throw new Error('Test error');
        });
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should be an Error');
        assert.strictEqual((error as Error).message, 'Test error', 'Should have correct message');
      }

      assert.strictEqual(semaphore.getActiveCount(), 0, 'Should have 0 active after error');
    });

    test('should execute concurrently up to limit', async () => {
      const semaphore = GlobalSemaphore.getInstance(3);
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const tasks = Array.from({ length: 10 }, () =>
        semaphore.execute(async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise(resolve => setTimeout(resolve, 50));
          currentConcurrent--;
        })
      );

      await Promise.all(tasks);
      assert.strictEqual(maxConcurrent, 3, 'Max concurrent should be 3');
      assert.strictEqual(currentConcurrent, 0, 'Current concurrent should be 0 after all tasks');
    });
  });

  suite('Update Max Concurrent', () => {
    test('should update max concurrent limit', async () => {
      const semaphore = GlobalSemaphore.getInstance(2);
      assert.strictEqual(semaphore.getMaxConcurrent(), 2, 'Should have initial limit of 2');

      semaphore.updateMaxConcurrent(5);
      assert.strictEqual(semaphore.getMaxConcurrent(), 5, 'Should have updated limit of 5');
    });

    test('should allow more requests after increasing limit', async () => {
      const semaphore = GlobalSemaphore.getInstance(1);

      await semaphore.acquire();

      // Start additional acquire requests
      const acquirePromise1 = semaphore.acquire();
      const acquirePromise2 = semaphore.acquire();
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.strictEqual(semaphore.getWaitingCount(), 2, 'Should have 2 waiting');

      // Increase limit
      semaphore.updateMaxConcurrent(3);
      await new Promise(resolve => setTimeout(resolve, 10));
      await acquirePromise1;
      await acquirePromise2;
      assert.strictEqual(semaphore.getActiveCount(), 3, 'Should have 3 active after limit increase');
      assert.strictEqual(semaphore.getWaitingCount(), 0, 'Should have 0 waiting after limit increase');

      // Cleanup
      semaphore.release();
      semaphore.release();
      semaphore.release();
    });
  });

  suite('Getters', () => {
    test('should return correct active count', async () => {
      const semaphore = GlobalSemaphore.getInstance(5);

      assert.strictEqual(semaphore.getActiveCount(), 0, 'Should start with 0 active');

      await semaphore.acquire();
      await semaphore.acquire();
      assert.strictEqual(semaphore.getActiveCount(), 2, 'Should have 2 active');

      semaphore.release();
      semaphore.release();
    });

    test('should return correct waiting count', async () => {
      const semaphore = GlobalSemaphore.getInstance(1);

      await semaphore.acquire();

      const promise = semaphore.acquire();
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.strictEqual(semaphore.getWaitingCount(), 1, 'Should have 1 waiting');

      semaphore.release();
      await promise;
      semaphore.release();
    });

    test('should return correct max concurrent', () => {
      const semaphore = GlobalSemaphore.getInstance(7);
      assert.strictEqual(semaphore.getMaxConcurrent(), 7, 'Should return 7');
    });
  });
});
