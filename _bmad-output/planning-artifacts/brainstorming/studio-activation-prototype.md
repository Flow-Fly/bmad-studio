# BMAD Studio Activation Prototype

**Goal:** Modify BMAD agent activation to output structured menu data alongside human-readable text, enabling BMAD Studio to render native UI buttons.

---

## Critical Insight: Menus Appear at Multiple Points

Menus are NOT just displayed at greeting. They appear:

| Moment | Example |
|--------|---------|
| **Greeting** | Initial activation, agent introduces itself |
| **After workflow completion** | "We finished Phase 2. What's next?" |
| **After any task** | "Session captured! What would you like to do?" |
| **User asks for menu** | "MH" or "help" → redisplay |
| **Return from sub-workflow** | Party Mode ends → back to main menu |
| **Session decision points** | "Ready for Phase 3?" with options |

**Therefore:** Structured output markers must be emitted **EVERY TIME** a menu is rendered, not just in activation step 7. This requires a **universal rule** rather than a step-specific modification.

---

## Option A: Structured Comment Markers (Universal Rule)

Add a universal rule to agent activation that applies whenever menus are displayed.

### New Universal Rule (Added to `<rules>` Section)

```xml
<rules>
  <!-- Existing rules... -->

  <r id="studio-menu-output" critical="true">
    WHENEVER displaying a menu to the user (at greeting, after completing tasks,
    after workflows, on menu request, or at any decision point):

    1. FIRST output a structured menu block in this EXACT format:
       &lt;!--BMAD_MENU_START
       {
         "agent_id": "{agent_id}",
         "context": "{current_context}",
         "menu_items": [
           {for each menu item: code, label, handler_type, handler_value, data}
         ]
       }
       BMAD_MENU_END--&gt;

    2. THEN output the human-readable menu text as normal.

    This rule applies to:
    - Initial greeting menu
    - Menu redisplay (MH command)
    - Post-workflow completion menus
    - Post-task completion menus
    - Any "What would you like to do next?" moments
    - Return from sub-workflows (Party Mode, etc.)
  </r>
</rules>
```

### Modified Activation Step 7 (References the Rule)

```xml
<step n="7">
  Show greeting using {user_name} from config, communicate in {communication_language}.
  Display menu following the studio-menu-output rule.
</step>
```

### Example Output

```
<!--BMAD_MENU_START
{
  "agent_id": "brainstorming-coach",
  "menu_items": [
    {"code": "MH", "label": "Redisplay Menu Help", "handler_type": "action", "handler_value": "redisplay_menu"},
    {"code": "CH", "label": "Chat with the Agent about anything", "handler_type": "action", "handler_value": "chat"},
    {"code": "BS", "label": "Guide me through Brainstorming any topic", "handler_type": "exec", "handler_value": "{project-root}/_bmad/core/workflows/brainstorming/workflow.md"},
    {"code": "PM", "label": "Start Party Mode", "handler_type": "exec", "handler_value": "{project-root}/_bmad/core/workflows/party-mode/workflow.md"},
    {"code": "DA", "label": "Dismiss Agent", "handler_type": "action", "handler_value": "dismiss"}
  ]
}
BMAD_MENU_END-->

Hey Flow! I'm Carson, your Brainstorming Specialist!

Here's what we can dive into:

1. **[MH]** Redisplay Menu Help
2. **[CH]** Chat with the Agent about anything
3. **[BS]** Guide me through Brainstorming any topic
4. **[PM]** Start Party Mode
5. **[DA]** Dismiss Agent

What's calling to you?
```

### Studio Parser (JavaScript)

```javascript
function parseMenuFromOutput(llmOutput) {
  // Extract structured menu if present
  const structuredMatch = llmOutput.match(
    /<!--BMAD_MENU_START\s*([\s\S]*?)\s*BMAD_MENU_END-->/
  );

  if (structuredMatch) {
    try {
      const menuData = JSON.parse(structuredMatch[1]);
      return {
        type: 'structured',
        agentId: menuData.agent_id,
        items: menuData.menu_items,
        rawText: llmOutput.replace(structuredMatch[0], '').trim()
      };
    } catch (e) {
      console.warn('Failed to parse structured menu, falling back to regex');
    }
  }

  // Fallback: RegExp parsing
  const items = [];
  const pattern = /\[([A-Z]{2})\]\s*\*?\*?([^*\n\[]+)/g;
  let match;
  while ((match = pattern.exec(llmOutput)) !== null) {
    items.push({ code: match[1], label: match[2].trim() });
  }

  return {
    type: 'regex_fallback',
    agentId: null,
    items: items,
    rawText: llmOutput
  };
}
```

---

## Option B: Dedicated Menu Rendering Instruction

Create a reusable "render menu" instruction block that agents include.

### New File: `_bmad/core/instructions/studio-menu-render.xml`

```xml
<instruction id="studio-menu-render">
  <description>Render menu with structured output for BMAD Studio compatibility</description>

  <steps>
    <step n="1">Collect all menu items from the agent's menu section</step>
    <step n="2">
      Output structured block:
      &lt;!--BMAD_MENU_START
      {"agent_id": "{agent_id}", "menu_items": [{...}]}
      BMAD_MENU_END--&gt;
    </step>
    <step n="3">Output human-readable numbered list</step>
    <step n="4">STOP and WAIT for user input</step>
  </steps>

  <format>
    Each menu item in JSON must have:
    - code: The 2-letter trigger code
    - label: The display text (without [XX] prefix)
    - handler_type: "action" | "exec" | "workflow"
    - handler_value: The action text, file path, or prompt reference
    - data: (optional) Data file path if present
  </format>
</instruction>
```

### Modified Agent Activation (using instruction)

```xml
<step n="7">
  Show greeting using {user_name} from config, communicate in {communication_language}.
  Execute instruction: {project-root}/_bmad/core/instructions/studio-menu-render.xml
</step>
```

---

## Option C: Environment-Aware Output

Detect if running in BMAD Studio (via environment variable or marker) and adjust output format.

### Modified Activation Step

```xml
<step n="7">
  Show greeting using {user_name} from config, communicate in {communication_language}.

  IF {BMAD_STUDIO_MODE} is set:
    Output structured menu JSON only (no human text):
    {"type": "menu", "agent_id": "...", "items": [...]}
  ELSE:
    Display numbered list of ALL menu items from menu section in human-readable format.
</step>
```

### Studio Invocation

Studio would set a marker in the system prompt:
```
BMAD_STUDIO_MODE=true
Output all menus as structured JSON. Human-readable text will be rendered by the UI.
```

---

## Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **A: Comment Markers** | Works in CLI too, backward compatible, graceful fallback | More output, LLM must generate JSON |
| **B: Instruction File** | Reusable, consistent, centralized | Another file to maintain |
| **C: Environment-Aware** | Cleanest output for Studio | Different behavior CLI vs Studio, testing complexity |

---

## Recommendation

**Start with Option A (Comment Markers)** for these reasons:

1. **Backward compatible** — Works in Claude Code CLI (comments are invisible in terminal)
2. **Graceful fallback** — Studio can fall back to regex if JSON parsing fails
3. **Incremental adoption** — Can update agents one at a time
4. **No infrastructure changes** — Just modified activation steps

### Implementation Path

1. **Phase 1:** Update activation template in `_bmad/core/` with Option A pattern
2. **Phase 2:** Rebuild affected agents (or hot-patch existing ones)
3. **Phase 3:** Build Studio parser with structured + regex fallback
4. **Phase 4:** If successful, consider Option C for cleaner Studio-native output

---

## Prototype Agent: Brainstorming Coach (Studio Edition)

Below is how `brainstorming-coach.md` would look with Option A applied.

**Key Change:** The universal rule is added to `<rules>`, and activation steps reference it. The LLM must follow this rule at ALL menu display moments.

```xml
<activation critical="MANDATORY">
  <step n="1">Load persona from this current agent file (already in context)</step>
  <step n="2">🚨 IMMEDIATE ACTION REQUIRED - BEFORE ANY OUTPUT:
      - Load and read {project-root}/_bmad/cis/config.yaml NOW
      - Store ALL fields as session variables: {user_name}, {communication_language}, {output_folder}
      - VERIFY: If config not loaded, STOP and report error to user
      - DO NOT PROCEED to step 3 until config is successfully loaded and variables stored
  </step>
  <step n="3">Remember: user's name is {user_name}</step>

  <step n="4">
    Show greeting using {user_name} from config, communicate in {communication_language}.
    Display menu following the studio-menu-output rule (see rules section).
  </step>

  <step n="5">STOP and WAIT for user input - do NOT execute menu items automatically</step>

  <step n="6">On user input: Number → execute menu item[n] | Text → case-insensitive substring match</step>

  <step n="7">
    When executing a menu item, FIRST output action marker:
    &lt;!--BMAD_ACTION_START
    {"code": "{selected_code}", "handler_type": "{type}", "handler_value": "{value}"}
    BMAD_ACTION_END--&gt;

    THEN execute the handler per menu-handlers section.
  </step>

  <step n="8">
    After handler execution completes (workflow finished, task done, etc.):
    Display menu following the studio-menu-output rule.
  </step>

  <menu-handlers>
    <!-- ... existing handlers ... -->
  </menu-handlers>

  <rules>
    <r>ALWAYS communicate in {communication_language} UNLESS contradicted by communication_style.</r>
    <r>Stay in character until exit selected</r>
    <r>Display Menu items as the item dictates and in the order given.</r>
    <r>Load files ONLY when executing a user chosen workflow or a command requires it</r>

    <!-- NEW: Studio-compatible menu output rule -->
    <r id="studio-menu-output" critical="true">
      WHENEVER displaying a menu to the user (at ANY point in the session):

      1. FIRST output a structured menu block:
         &lt;!--BMAD_MENU_START
         {
           "agent_id": "brainstorming-coach",
           "context": "{brief description of current state}",
           "menu_items": [
             {"code": "MH", "label": "Redisplay Menu Help", "handler_type": "builtin", "handler_value": "menu_help"},
             {"code": "CH", "label": "Chat with the Agent about anything", "handler_type": "builtin", "handler_value": "chat"},
             {"code": "BS", "label": "Guide me through Brainstorming any topic", "handler_type": "exec", "handler_value": "{project-root}/_bmad/core/workflows/brainstorming/workflow.md"},
             {"code": "PM", "label": "Start Party Mode", "handler_type": "exec", "handler_value": "{project-root}/_bmad/core/workflows/party-mode/workflow.md"},
             {"code": "DA", "label": "Dismiss Agent", "handler_type": "builtin", "handler_value": "dismiss"}
           ]
         }
         BMAD_MENU_END--&gt;

      2. THEN output the human-readable menu text.

      This applies to: greeting, post-workflow, post-task, menu redisplay, sub-workflow return.
    </r>
  </rules>
</activation>
```

### Example: Menu After Workflow Completion

When a brainstorming session completes, the agent would output:

```
<!--BMAD_MENU_START
{
  "agent_id": "brainstorming-coach",
  "context": "Brainstorming session completed - Phase 4 finished, 90 ideas captured",
  "menu_items": [
    {"code": "MH", "label": "Redisplay Menu Help", "handler_type": "builtin", "handler_value": "menu_help"},
    {"code": "CH", "label": "Chat with the Agent about anything", "handler_type": "builtin", "handler_value": "chat"},
    {"code": "BS", "label": "Start a NEW Brainstorming session", "handler_type": "exec", "handler_value": "{project-root}/_bmad/core/workflows/brainstorming/workflow.md"},
    {"code": "PM", "label": "Start Party Mode", "handler_type": "exec", "handler_value": "{project-root}/_bmad/core/workflows/party-mode/workflow.md"},
    {"code": "DA", "label": "Dismiss Agent", "handler_type": "builtin", "handler_value": "dismiss"}
  ]
}
BMAD_MENU_END-->

Session complete! We generated 90 ideas across 4 phases.

**What would you like to do now?**

1. **[MH]** Redisplay Menu Help
2. **[CH]** Chat with the Agent about anything
3. **[BS]** Start a NEW Brainstorming session
4. **[PM]** Start Party Mode
5. **[DA]** Dismiss Agent
```

### Example: Mid-Workflow Decision Point

During a workflow, when presenting options to the user:

```
<!--BMAD_MENU_START
{
  "agent_id": "brainstorming-coach",
  "context": "Phase 2 Morphological Analysis complete - ready for next phase",
  "menu_items": [
    {"code": "1", "label": "Phase 3: Six Thinking Hats", "handler_type": "continue", "handler_value": "phase_3"},
    {"code": "2", "label": "Revisit Phase 2", "handler_type": "continue", "handler_value": "phase_2_revisit"},
    {"code": "3", "label": "Save and Exit", "handler_type": "builtin", "handler_value": "save_exit"},
    {"code": "4", "label": "Skip to Phase 4", "handler_type": "continue", "handler_value": "phase_4"}
  ]
}
BMAD_MENU_END-->

**Phase 2 complete! Where do you want to go?**

1. **[PHASE 3]** Move to Six Thinking Hats
2. **[REVISIT]** Go back to Phase 2
3. **[SAVE]** Save progress and exit
4. **[SKIP]** Jump to Phase 4
```

**Note:** Mid-workflow menus may have DIFFERENT options than the main agent menu. The `context` field helps Studio understand the current state.

---

## Additional Structured Events

Beyond menus, Studio could benefit from structured markers for:

| Event | Marker | Purpose |
|-------|--------|---------|
| Menu Display | `BMAD_MENU_START/END` | Render menu buttons |
| User Selection | `BMAD_ACTION_START/END` | Track what was selected |
| Workflow Step | `BMAD_STEP_START/END` | Show workflow progress |
| Template Output | `BMAD_OUTPUT_START/END` | Trigger node solidification |
| Workflow Complete | `BMAD_COMPLETE` | Mark node as ported |

### Example: Workflow Step Marker

```
<!--BMAD_STEP_START
{"workflow": "brainstorming", "step": 2, "title": "Technique Selection", "status": "active"}
BMAD_STEP_END-->

## Step 2: Select Your Brainstorming Technique

Let's choose how to explore your topic...
```

Studio can use these to:
- Update progress indicators
- Trigger node state transitions
- Build the workflow graph edges

---

## Files to Modify

### Agent Files (Add Universal Rule to `<rules>` Section)

| File | Change |
|------|--------|
| `_bmad/core/agents/bmad-master.md` | Add `studio-menu-output` rule, update step references |
| `_bmad/bmm/agents/*.md` | Add `studio-menu-output` rule, update step references |
| `_bmad/cis/agents/*.md` | Add `studio-menu-output` rule, update step references |
| `_bmad/bmb/agents/*.md` | Add `studio-menu-output` rule, update step references |

### Template Files (For New Agent Creation)

| File | Change |
|------|--------|
| `_bmad/bmb/workflows/agent/templates/simple-agent.template.md` | Include rule in template |
| `_bmad/bmb/workflows/agent/templates/expert-agent-template/*.md` | Include rule in template |

### Workflow Engine (For Workflow-Level Events)

| File | Change |
|------|--------|
| `_bmad/core/tasks/workflow.xml` | Add structured markers for `template-output`, step transitions |

### Workflow Step Files (Optional - For Granular Events)

| File | Change |
|------|--------|
| `_bmad/*/workflows/*/steps/*.md` | Add markers at decision points within workflows |

---

## Implementation Strategy

### Phase 1: Core Agents (Test Viability)
1. Modify ONE agent (e.g., `brainstorming-coach.md`) with universal rule
2. Test in Claude Code CLI — verify comments are invisible
3. Build basic Studio parser — verify JSON extraction works
4. Validate fallback — ensure regex still works if JSON fails

### Phase 2: Roll Out to All Agents
1. Update all agent files with the universal rule
2. Update agent templates for future agent creation
3. Rebuild any compiled agents

### Phase 3: Workflow Engine Integration
1. Add `BMAD_STEP_START/END` markers to `workflow.xml`
2. Add `BMAD_OUTPUT_START/END` markers for template outputs
3. These enable Studio to track workflow progress and trigger node solidification

### Phase 4: Dynamic Menu Support
1. Handle mid-workflow menus with different options
2. Use `context` field to help Studio understand current state
3. Render contextual UI based on workflow progress

---

## Next Steps

1. **Validate with Flow:** Does Option A approach make sense?
2. **Test on one agent:** Apply to brainstorming-coach, verify CLI still works
3. **Build Studio parser:** Implement JavaScript parser with fallback
4. **Expand to all agents:** If successful, update all agent files
5. **Add event markers:** Extend to workflow steps and outputs
