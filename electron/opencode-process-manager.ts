import { ChildProcess, spawn, execSync } from 'child_process';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';

export interface OpenCodeConfig {
  maxRetries?: number; // default 3
  retryDelayMs?: number; // default 1000
  portRangeMin?: number; // default 49152
  portRangeMax?: number; // default 65535
  healthCheckPath?: string; // default '/health'
  healthCheckTimeoutMs?: number; // default 15000
  shutdownTimeoutMs?: number; // default 5000
}

export interface OpenCodeDetectionResult {
  installed: boolean;
  path?: string; // Full path to opencode binary
  version?: string; // Optional: parsed from `opencode --version`
}

export interface OpenCodeProviderConfig {
  name: string; // e.g., "anthropic", "openai"
  configured: boolean; // Has API key
}

export interface OpenCodeConfigData {
  providers: OpenCodeProviderConfig[];
  models: string[]; // e.g., ["claude-opus-4", "gpt-4"]
  defaultProvider?: string;
}

export type OpenCodeServerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'restarting'
  | 'failed'
  | 'not-installed';

export interface OpenCodeStatusEvent {
  status: OpenCodeServerStatus;
  port?: number;
  error?: string;
  retryCount?: number;
}

export class OpenCodeProcessManager {
  private process: ChildProcess | null = null;
  private currentPort: number | null = null;
  private retryCount = 0;
  private status: OpenCodeServerStatus = 'stopped';
  private isShuttingDown = false;
  private isRestarting = false;

  private readonly config: Required<OpenCodeConfig>;

  constructor(
    config: OpenCodeConfig = {},
    private onStatusChange: (event: OpenCodeStatusEvent) => void
  ) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      portRangeMin: config.portRangeMin ?? 49152,
      portRangeMax: config.portRangeMax ?? 65535,
      healthCheckPath: config.healthCheckPath ?? '/health',
      healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 15000,
      shutdownTimeoutMs: config.shutdownTimeoutMs ?? 5000,
    };
  }

  /**
   * Detects if OpenCode CLI is installed on PATH and returns detection details
   */
  async detectOpenCode(): Promise<OpenCodeDetectionResult> {
    try {
      const command =
        process.platform === 'win32' ? 'where opencode' : 'which opencode';
      const pathResult = execSync(command, { encoding: 'utf-8' }).trim();

      // Try to get version (optional)
      let version: string | undefined;
      try {
        version = execSync('opencode --version', { encoding: 'utf-8' }).trim();
      } catch {
        // Version command failed — not critical
        version = undefined;
      }

      return {
        installed: true,
        path: pathResult,
        version,
      };
    } catch {
      this.updateStatus('not-installed');
      return { installed: false };
    }
  }

  /**
   * Reads OpenCode CLI config file to extract provider/model information
   */
  async readOpenCodeConfig(): Promise<OpenCodeConfigData | null> {
    const configPath = this.getConfigPath();

    if (!fs.existsSync(configPath)) {
      console.log('[OpenCode] Config file not found:', configPath);
      return null; // Not configured
    }

    try {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Parse providers (structure depends on OpenCode's actual config format)
      // This is a best-effort parse — adapt based on actual OpenCode config schema
      const providers: OpenCodeProviderConfig[] = [];

      if (config.providers && Array.isArray(config.providers)) {
        for (const p of config.providers) {
          providers.push({
            name: p.name || 'unknown',
            configured: !!(p.apiKey || p.apiKeyEnv || p.credentials),
          });
        }
      }

      const models = Array.isArray(config.models) ? config.models : [];
      const defaultProvider = config.defaultProvider;

      return { providers, models, defaultProvider };
    } catch (error) {
      console.error('[OpenCode] Failed to read config:', error);
      return null;
    }
  }

  /**
   * Gets platform-specific OpenCode config file path
   */
  private getConfigPath(): string {
    const homeDir = os.homedir();

    if (process.platform === 'win32') {
      return path.join(
        process.env.APPDATA || homeDir,
        'opencode',
        'config.json'
      );
    }

    return path.join(homeDir, '.opencode', 'config.json');
  }

  /**
   * Spawns OpenCode server with random port and retry logic
   */
  async spawn(): Promise<void> {
    if (this.status === 'starting' || this.status === 'running' || this.status === 'restarting') {
      console.log('[OpenCode] Server already running');
      return;
    }

    this.updateStatus('starting');
    this.retryCount = 0;

    await this.attemptSpawn();
  }

  /**
   * Restarts the OpenCode server with a new random port
   */
  async restart(): Promise<void> {
    console.log('[OpenCode] Restarting server...');
    this.updateStatus('restarting', undefined, this.retryCount);

    this.isRestarting = true;
    await this.terminateProcess();
    await this.sleep(this.config.retryDelayMs);

    this.retryCount++;
    if (this.retryCount > this.config.maxRetries) {
      this.isRestarting = false;
      this.updateStatus(
        'failed',
        `Max retries (${this.config.maxRetries}) exceeded`
      );
      return;
    }

    this.isRestarting = false;
    await this.attemptSpawn();
  }

  /**
   * Shuts down the OpenCode server cleanly
   */
  async shutdown(): Promise<void> {
    if (!this.process || this.status === 'stopped') {
      return;
    }

    console.log('[OpenCode] Shutting down server...');
    this.isShuttingDown = true;

    await this.terminateProcess();
    this.updateStatus('stopped');
    this.isShuttingDown = false;
  }

  /**
   * Generates a random port in the ephemeral port range
   */
  private generateRandomPort(): number {
    const range = this.config.portRangeMax - this.config.portRangeMin;
    return this.config.portRangeMin + Math.floor(Math.random() * range);
  }

  /**
   * Attempts to spawn OpenCode server with retry logic
   */
  private async attemptSpawn(): Promise<void> {
    const port = this.generateRandomPort();
    this.currentPort = port;

    console.log(
      `[OpenCode] Attempting to spawn on port ${port} (retry ${this.retryCount}/${this.config.maxRetries})`
    );

    try {
      // Spawn opencode serve process
      this.process = spawn('opencode', ['serve', '--port', String(port)], {
        stdio: 'pipe',
        detached: false,
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.handleExit(code, signal);
      });

      // Log output for debugging
      this.process.stdout?.on('data', (data) => {
        console.log(`[OpenCode stdout] ${data.toString().trim()}`);
      });

      this.process.stderr?.on('data', (data) => {
        console.error(`[OpenCode stderr] ${data.toString().trim()}`);
      });

      // Wait for health check
      await this.waitForHealth(port);

      // Success
      this.retryCount = 0;
      this.updateStatus('running');
    } catch (error) {
      console.error('[OpenCode] Spawn failed:', error);

      // Retry with new port if retries remaining
      if (this.retryCount < this.config.maxRetries) {
        this.isRestarting = true;
        await this.terminateProcess();
        this.isRestarting = false;
        await this.restart();
      } else {
        this.updateStatus(
          'failed',
          `Failed to start after ${this.config.maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Waits for OpenCode server health check with exponential backoff
   */
  private async waitForHealth(port: number): Promise<void> {
    const startTime = Date.now();
    let delay = 100; // Start with 100ms
    const maxDelay = 3200; // Cap at 3.2s

    while (Date.now() - startTime < this.config.healthCheckTimeoutMs) {
      try {
        await this.checkHealth(port);
        console.log(`[OpenCode] Health check succeeded on port ${port}`);
        return; // Success
      } catch (error) {
        // Exponential backoff
        await this.sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }

    throw new Error(
      `Health check timeout after ${this.config.healthCheckTimeoutMs}ms`
    );
  }

  /**
   * Performs a single health check HTTP request
   */
  private checkHealth(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://localhost:${port}${this.config.healthCheckPath}`,
        (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Health check returned ${res.statusCode}`));
          }
          res.resume(); // Consume response data
        }
      );

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        reject(new Error('Health check request timeout'));
      });
    });
  }

  /**
   * Handles child process exit events
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    console.log(
      `[OpenCode] Process exited with code ${code}, signal ${signal}`
    );

    this.process = null;
    this.currentPort = null;

    // If shutting down normally, don't restart
    if (this.isShuttingDown || this.isRestarting) {
      return;
    }

    // Exit code 0 = normal shutdown, don't restart
    if (code === 0) {
      this.updateStatus('stopped');
      return;
    }

    // Unexpected exit - attempt restart if retries available
    if (this.retryCount < this.config.maxRetries) {
      console.log('[OpenCode] Unexpected exit, restarting...');
      this.restart().catch((error) => {
        console.error('[OpenCode] Restart failed:', error);
      });
    } else {
      this.updateStatus('failed', 'Process crashed and max retries exceeded');
    }
  }

  /**
   * Terminates the OpenCode process cleanly (SIGTERM → SIGKILL)
   */
  private async terminateProcess(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise<void>((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const pid = this.process.pid;
      let terminated = false;

      // Set up exit handler
      const exitHandler = () => {
        terminated = true;
        resolve();
      };

      this.process.once('exit', exitHandler);

      // Send SIGTERM
      console.log(`[OpenCode] Sending SIGTERM to PID ${pid}`);
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown, then SIGKILL if needed
      setTimeout(() => {
        if (!terminated && this.process) {
          console.log(`[OpenCode] Sending SIGKILL to PID ${pid}`);
          this.process.kill('SIGKILL');
        }

        // Ensure we resolve even if process doesn't exit
        setTimeout(() => {
          if (!terminated) {
            console.warn('[OpenCode] Process did not exit, forcing cleanup');
            this.process = null;
            resolve();
          }
        }, 1000);
      }, this.config.shutdownTimeoutMs);
    });
  }

  /**
   * Updates internal status and notifies via callback
   */
  private updateStatus(
    status: OpenCodeServerStatus,
    error?: string,
    retryCount?: number
  ): void {
    this.status = status;

    const event: OpenCodeStatusEvent = {
      status,
      port: this.currentPort ?? undefined,
      error,
      retryCount: retryCount ?? this.retryCount,
    };

    this.onStatusChange(event);
  }

  /**
   * Helper: sleep for ms milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets current server status
   */
  getStatus(): OpenCodeServerStatus {
    return this.status;
  }

  /**
   * Gets current server port (null if not running)
   */
  getPort(): number | null {
    return this.currentPort;
  }
}
