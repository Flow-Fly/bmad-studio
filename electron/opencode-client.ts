import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk';

// Re-export types for convenience in main.ts
export type { OpencodeClient } from '@opencode-ai/sdk';

/**
 * Encapsulates all OpenCode SDK interactions. Manages client lifecycle
 * and provides typed methods for session, permission, and question operations.
 *
 * Lifecycle:
 *   1. initialize(port) — when OpenCode server becomes 'running'
 *   2. SDK methods available while isReady() returns true
 *   3. destroy() — on server stop/restart/app shutdown
 */
export class OpenCodeClient {
  private client: OpencodeClient | null = null;

  /**
   * Creates the SDK client pointed at the given server port.
   * Safe to call multiple times (e.g. on server restart with a new port).
   */
  initialize(port: number): void {
    this.client = createOpencodeClient({
      baseUrl: `http://localhost:${port}`,
    });
    console.log(`[OpenCodeClient] Initialized with port ${port}`);
  }

  /**
   * Returns true when the SDK client is initialized and ready for calls.
   */
  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Tears down the client reference. Call before server shutdown or on restart.
   */
  destroy(): void {
    this.client = null;
    console.log('[OpenCodeClient] Destroyed');
  }

  /**
   * Returns the raw SDK client. Throws if not initialized.
   */
  private getClient(): OpencodeClient {
    if (!this.client) {
      throw new Error('OpenCode SDK client is not initialized');
    }
    return this.client;
  }

  // ---------------------------------------------------------------------------
  // Session Operations
  // ---------------------------------------------------------------------------

  /**
   * Creates a new OpenCode session with the given title.
   * Returns { sessionId, title }.
   */
  async createSession(title: string): Promise<{ sessionId: string; title: string }> {
    const client = this.getClient();
    const result = await client.session.create({
      body: { title },
    });

    const session = result.data;
    if (!session) {
      throw new Error('Session create returned no data');
    }

    return {
      sessionId: session.id,
      title: session.title,
    };
  }

  /**
   * Sends a prompt to an existing session. The prompt is composed of message parts.
   * Optionally specify a model (providerID + modelID).
   */
  async sendPrompt(
    sessionId: string,
    parts: Array<{ type: string; [key: string]: unknown }>,
    model?: { providerID: string; modelID: string }
  ): Promise<void> {
    const client = this.getClient();
    await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: parts as Array<{ type: 'text'; text: string }>,
        model,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Permission Operations
  // ---------------------------------------------------------------------------

  /**
   * Responds to a permission request. Approves with "once" or rejects.
   * The permissionId must include the session ID context since the SDK
   * endpoint is per-session: POST /session/{id}/permissions/{permissionID}
   */
  async approvePermission(
    sessionId: string,
    permissionId: string,
    approved: boolean
  ): Promise<void> {
    const client = this.getClient();
    await client.postSessionIdPermissionsPermissionId({
      path: {
        id: sessionId,
        permissionID: permissionId,
      },
      body: {
        response: approved ? 'once' : 'reject',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Question Operations
  // ---------------------------------------------------------------------------

  /**
   * Responds to a question from the AI. Uses the TUI control response
   * mechanism to submit the user's answer.
   */
  async answerQuestion(answer: string): Promise<void> {
    const client = this.getClient();
    await client.tui.control.response({
      body: answer,
    });
  }
}
