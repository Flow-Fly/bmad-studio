import { listArtifacts } from './artifact.service';
import type { ArtifactInfo } from '../types/artifact';
import type { IpcErrorResponse } from '../types/ipc';

/**
 * Workflow-to-skill command mapping.
 * Used to construct the initial BMAD prompt sent to OpenCode.
 */
export const WORKFLOW_SKILL_MAP: Record<string, string> = {
  'create-prd': 'bmad:bmm:workflows:create-prd',
  'create-ux-design': 'bmad:bmm:workflows:create-ux-design',
  'create-architecture': 'bmad:bmm:workflows:create-architecture',
  'create-tech-spec': 'bmad:bmm:workflows:create-tech-spec',
  'check-implementation-readiness':
    'bmad:bmm:workflows:check-implementation-readiness',
  'create-story': 'bmad:bmm:workflows:create-story',
  'dev-story': 'bmad:bmm:workflows:dev-story',
  'code-review': 'bmad:bmm:workflows:code-review',
  'create-ci-setup': 'bmad:bmm:workflows:create-ci-setup',
  'create-nfr-checklist': 'bmad:bmm:workflows:create-nfr-checklist',
  'create-atdd-plan': 'bmad:bmm:workflows:create-atdd-plan',
};

export interface LaunchWorkflowOptions {
  workflowId: string;
  streamName: string;
  projectName: string;
  projectRoot: string;
  worktreePath?: string;
}

export interface LaunchWorkflowResult {
  sessionId: string;
  title: string;
}

/**
 * Checks whether an IPC response is an error response.
 * Error responses contain a `code` field.
 */
function isIpcError(
  response: unknown,
): response is IpcErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    typeof (response as IpcErrorResponse).code === 'string'
  );
}

/**
 * Builds the initial BMAD prompt text for an OpenCode session.
 *
 * Format:
 *   /{skillCommand}
 *
 *   Prior artifacts are available at: ~/.bmad-studio/projects/{project}-{stream}/
 *   Available artifacts: brainstorm.md, research.md
 *
 *   The project codebase is at: {projectRoot}
 */
function buildPromptText(
  skillCommand: string,
  storePath: string,
  artifacts: ArtifactInfo[],
  projectRoot: string,
): string {
  const artifactLine = artifacts.length > 0
    ? `\nAvailable artifacts: ${artifacts.map((a) => a.filename).join(', ')}`
    : '';

  return `/${skillCommand}

Prior artifacts are available at: ${storePath}${artifactLine}

The project codebase is at: ${projectRoot}`;
}

/**
 * Launches a workflow session in OpenCode.
 *
 * 1. Creates an OpenCode session via the IPC bridge
 * 2. Fetches prior artifacts for prompt context
 * 3. Sends the BMAD skill prompt to the session
 *
 * This function is stateless -- callers are responsible for updating store state
 * (sessionLaunching, activeSession) around this call.
 *
 * @returns The session ID and title on success
 * @throws Error if session creation or prompt send fails
 */
export async function launchWorkflow(
  opts: LaunchWorkflowOptions,
): Promise<LaunchWorkflowResult> {
  const {
    workflowId,
    streamName,
    projectName,
    projectRoot,
    worktreePath,
  } = opts;

  const skillCommand = WORKFLOW_SKILL_MAP[workflowId] ?? workflowId;
  const title = `${streamName} \u2014 ${workflowId}`;
  const workingDir = worktreePath || projectRoot;

  // 1. Create session via IPC bridge
  const createResponse = await window.opencode.createSession({
    title,
    workingDir,
  });

  if (isIpcError(createResponse)) {
    throw new Error(
      `Failed to create session: ${createResponse.message} (${createResponse.code})`,
    );
  }

  const { sessionId } = createResponse;

  // 2. Fetch prior artifacts for prompt context
  let artifacts: ArtifactInfo[] = [];
  try {
    artifacts = await listArtifacts(projectName, streamName);
  } catch (err) {
    // Non-fatal: proceed without artifact context
    console.warn(
      '[opencode.service] Failed to fetch artifacts for prompt context:',
      err,
    );
  }

  // 3. Build and send the prompt
  const storePath = `~/.bmad-studio/projects/${projectName}-${streamName}/`;
  const promptText = buildPromptText(
    skillCommand,
    storePath,
    artifacts,
    projectRoot,
  );

  try {
    const sendResponse = await window.opencode.sendPrompt({
      sessionId,
      parts: [{ type: 'text', text: promptText }],
    });

    if (isIpcError(sendResponse)) {
      // Session was created but prompt failed -- log but don't throw
      // so the caller can still track the session
      console.error(
        '[opencode.service] Prompt send failed:',
        sendResponse.message,
      );
    }
  } catch (err) {
    // Session was created but prompt failed -- log error
    console.error('[opencode.service] Prompt send error:', err);
  }

  return { sessionId, title };
}
