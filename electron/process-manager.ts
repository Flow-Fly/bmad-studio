import { spawn, type ChildProcess } from 'node:child_process';

export interface ProcessConfig {
  binaryPath: string;
  port: number;
  maxRetries?: number; // default 3
  retryDelayMs?: number; // default 1000
  healthCheckPath?: string; // default '/health'
  shutdownTimeoutMs?: number; // default 5000
}

export type ProcessStatus = 'stopped' | 'starting' | 'running' | 'restarting' | 'failed';

export interface ProcessStatusEvent {
  status: ProcessStatus;
  error?: string;
  retryCount?: number;
}

export class ProcessManager {
  private process: ChildProcess | null = null;
  private retryCount = 0;
  private status: ProcessStatus = 'stopped';
  private isShuttingDown = false;
  private isRestarting = false;

  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly healthCheckPath: string;
  private readonly shutdownTimeoutMs: number;

  constructor(
    private config: ProcessConfig,
    private onStatusChange: (event: ProcessStatusEvent) => void
  ) {
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.healthCheckPath = config.healthCheckPath ?? '/health';
    this.shutdownTimeoutMs = config.shutdownTimeoutMs ?? 5000;
  }

  async spawn(): Promise<void> {
    if (this.status === 'starting' || this.status === 'running') {
      console.warn('[ProcessManager] Process already running');
      return;
    }

    this.status = 'starting';
    this.onStatusChange({ status: 'starting' });

    try {
      console.log(`[ProcessManager] Spawning process: ${this.config.binaryPath}`);
      this.process = spawn(this.config.binaryPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PORT: String(this.config.port) },
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(`[sidecar] ${data.toString()}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(`[sidecar:err] ${data.toString()}`);
      });

      this.process.on('exit', (code) => {
        this.handleExit(code);
      });

      // Wait for health check to succeed
      await this.waitForHealth();

      this.status = 'running';
      this.retryCount = 0; // Reset retry count on successful start
      this.onStatusChange({ status: 'running' });
      console.log('[ProcessManager] Process is running and healthy');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ProcessManager] Spawn failed:', errorMessage);

      // Clean up process if it exists
      if (this.process) {
        this.isRestarting = true;
        this.process.kill('SIGKILL');
        this.process = null;
      }

      // Attempt retry if we haven't exceeded limit
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.status = 'restarting';
        this.onStatusChange({
          status: 'restarting',
          retryCount: this.retryCount,
          error: errorMessage,
        });

        console.log(
          `[ProcessManager] Retrying spawn (${this.retryCount}/${this.maxRetries}) in ${this.retryDelayMs}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        this.isRestarting = false;
        return this.spawn();
      } else {
        // Max retries exceeded
        this.isRestarting = false;
        this.status = 'failed';
        this.onStatusChange({
          status: 'failed',
          error: `Failed to start after ${this.maxRetries} retries: ${errorMessage}`,
        });
        throw new Error(`Process failed to start after ${this.maxRetries} retries`);
      }
    }
  }

  async restart(): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('[ProcessManager] Cannot restart during shutdown');
      return;
    }

    console.log('[ProcessManager] Manual restart requested');
    this.isRestarting = true;
    this.retryCount = 0; // Reset retry count for manual restart
    this.status = 'restarting';
    this.onStatusChange({ status: 'restarting', retryCount: 0 });

    if (this.process) {
      this.process.kill('SIGTERM');
      // Wait for the process to actually exit
      await new Promise<void>((resolve) => {
        const onExit = () => resolve();
        this.process?.once('exit', onExit);
        setTimeout(() => resolve(), 5000); // safety timeout
      });
      this.process = null;
    }

    this.isRestarting = false;
    return this.spawn();
  }

  async shutdown(): Promise<void> {
    if (!this.process) {
      console.log('[ProcessManager] No process to shutdown');
      this.status = 'stopped';
      return;
    }

    this.isShuttingDown = true;
    console.log('[ProcessManager] Shutting down process...');

    const pid = this.process.pid;
    if (!pid) {
      this.process = null;
      this.status = 'stopped';
      return;
    }

    // Send SIGTERM
    this.process.kill('SIGTERM');

    // Wait for graceful shutdown or force-kill on timeout
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('[ProcessManager] Shutdown timeout, sending SIGKILL');
        if (this.process?.pid) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, this.shutdownTimeoutMs);

      this.process?.once('exit', () => {
        clearTimeout(timeoutId);
        console.log('[ProcessManager] Process exited gracefully');
        resolve();
      });
    });

    this.process = null;
    this.status = 'stopped';
    this.isShuttingDown = false;
    console.log('[ProcessManager] Shutdown complete');
  }

  private async waitForHealth(): Promise<void> {
    const maxAttempts = 30; // 30 attempts over ~15 seconds
    let attempts = 0;
    let delay = 100; // Start with 100ms

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(
          `http://localhost:${this.config.port}${this.healthCheckPath}`,
          { signal: AbortSignal.timeout(2000) }
        );

        if (response.ok) {
          console.log('[ProcessManager] Health check passed');
          return;
        }
      } catch {
        // Health check failed, retry
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff up to 1000ms
      delay = Math.min(delay * 2, 1000);
    }

    throw new Error('Health check timeout after 15 seconds');
  }

  private handleExit(code: number | null): void {
    console.log(`[ProcessManager] Process exited with code ${code}`);
    this.process = null;

    // Don't restart if we're shutting down or another code path is handling restart
    if (this.isShuttingDown || this.isRestarting) {
      return;
    }

    // Don't restart if exit was clean (code 0)
    if (code === 0) {
      this.status = 'stopped';
      this.onStatusChange({ status: 'stopped' });
      return;
    }

    // Unexpected exit — attempt restart if retries remaining
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.status = 'restarting';
      this.onStatusChange({
        status: 'restarting',
        retryCount: this.retryCount,
        error: `Process crashed with code ${code}`,
      });

      console.log(
        `[ProcessManager] Restarting after crash (${this.retryCount}/${this.maxRetries})...`
      );

      setTimeout(() => {
        this.spawn().catch((error) => {
          console.error('[ProcessManager] Restart failed:', error);
        });
      }, this.retryDelayMs);
    } else {
      // Max retries exceeded
      this.status = 'failed';
      this.onStatusChange({
        status: 'failed',
        error: `Process failed after ${this.maxRetries} restart attempts`,
      });
    }
  }

  getStatus(): ProcessStatus {
    return this.status;
  }
}
