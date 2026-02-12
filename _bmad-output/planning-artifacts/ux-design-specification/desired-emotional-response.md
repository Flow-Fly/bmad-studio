# Desired Emotional Response

## Primary Emotional Goals

**Primary: Command.** The feeling a pilot gets looking at a cockpit where every instrument is in the right place and every reading makes sense. "I see the full landscape of my work. I know what state everything is in. I know what to do next." This is the emotion the phase graph should evoke on every stream switch. Not "power" (implies complexity), not "control" (implies micromanagement) — command implies mastery through clarity.

**Secondary: Relief.** The absence of the reconstruction tax. The first time Alex opens a two-week-old stream and is productive in 60 seconds, the emotional response is relief that becomes dependency. This is the emotion that makes him tell a friend. Not delight (this isn't a consumer app). Not efficiency (that's table stakes). It's "I didn't lose anything. It's all here."

**Tertiary: Momentum.** Each completed workflow node, each updated phase container, each archived stream creates a sense of forward motion. The methodology doesn't feel like overhead because progress is visible and cumulative. The phase graph is a progress bar for your entire development practice.

## Emotional Journey Mapping

| Moment | Target Emotion | Design Implication |
|--------|---------------|--------------------|
| First open (Entry Point B) | **Intrigue** — "this is different, I want to explore" | Phase graph should look like a map to discover, not a form to fill. Visual richness invites exploration |
| First stream creation | **Clarity** — "I understand what this will do" | Flow template descriptions are plain-language, not jargon. "Full Flow: research through implementation" not "BMAD 4-phase pipeline" |
| Phase graph loads | **Command** — "I see exactly where everything stands" | Information density is high but scannable. Phase containers, workflow nodes, agent badges, artifact indicators — all visible without clicking |
| Launching a workflow | **Confidence** — "the right agent has the right context" | Context dependency tooltip shows what artifacts will be loaded. Agent name and skill visible. Zero ambiguity about what's about to happen |
| During OpenCode session | **Flow/Focus** — the tool disappears, the work is primary | Conversation-dominant layout. Breadcrumb strip provides orientation without distraction. No competing UI elements |
| Session complete, graph updates | **Momentum** — "visible progress, what's next?" | Node fills in, artifact becomes viewable, next available workflow subtly highlights. Progress is automatic and satisfying |
| Resuming a dormant stream | **Relief** — "I didn't lose anything, it's all here" | Phase graph is always the resume screen. No "loading previous session" — the state is the graph, and the graph is instant |
| Something breaks | **Trust** — "the system preserved my work, I can recover" | Artifacts persist in central store regardless of app state. Error messages identify the problem specifically, never generic "something went wrong" |

## Micro-Emotions

**Confidence vs. Confusion** — Critical. The two-level phase graph (phases containing workflows) is information-dense. If a new user looks at a Full Flow graph and feels confused about what the nodes mean or what order to follow, the product fails at onboarding. Confidence comes from clear visual hierarchy: phases are obvious containers, workflows are obvious action points, agents are obvious personas.

**Momentum vs. Deflation** — Important during multi-session workflows. After completing a 45-minute PRD session, the transition back to the phase graph should feel like "check, what's next" not "session over, now what." The graph update animation and next-step highlighting create micro-momentum.

**Trust vs. Anxiety** — Critical for the OpenCode integration boundary. When Alex clicks a workflow node and the view transitions to conversation mode, he needs to trust that the agent received the right context, that the artifact will be saved correctly, and that the phase graph will update when he's done. The context dependency tooltip and the breadcrumb strip are trust-building mechanisms.

**Competence vs. Impostor Syndrome** — Subtle but important for Entry Point B. A developer who's never done structured methodology shouldn't feel like they're "doing it wrong" by clicking brainstorm before research, or skipping the UX design phase. The graph shows what's available, not what's required. Competence comes from "I'm choosing my path" not "I'm following the rules."

## Design Implications

| Emotional Goal | UX Design Approach |
|---------------|-------------------|
| **Command** | High information density on the phase graph — all status visible at a glance. No progressive disclosure for core state information. If it's about "where am I," it's visible immediately |
| **Relief** | Phase graph loads instantly on stream switch. Always resets to home view. Dormant streams look identical to active ones — no "stale" visual treatment that implies decay |
| **Momentum** | Node completion animations. Subtle next-step highlighting. Stream progress visible on dashboard (e.g., "3/7 workflows complete"). Progress is cumulative and visible |
| **Confidence** | Context dependency tooltips. Agent badges on every node. Explicit artifact indicators (exists / doesn't exist). No ambiguity about what clicking a node will do |
| **Flow/Focus** | Conversation-dominant layout during sessions. Breadcrumb strip, not full chrome. No notifications or competing elements during active sessions |
| **Trust** | Artifacts persist in central store (filesystem-visible). Error messages are specific. Stream state survives app crashes. No data loss scenarios in normal operation |
| **Clarity** | Plain-language labels. Flow template descriptions explain what you get, not BMAD jargon. Agent names are personas (Mary, John) not role titles. Tooltips explain without overwhelming |
| **Intrigue** | The phase graph has visual richness — agent avatars, artifact flow arrows, conditional gates. It looks like something worth exploring, not a project management checklist |

## Emotional Design Principles

1. **Density Builds Command.** Show more, not less. Developer tools that hide information behind clicks create anxiety. The phase graph should feel like a dense, readable instrument panel — everything visible, nothing buried. Density done right creates the command feeling; progressive disclosure creates uncertainty.

2. **Progress Should Be Felt.** Every completed workflow, every produced artifact, every phase transition should produce a small moment of satisfaction. Not gamification — no points, no streaks, no badges. Just clear visual state changes that acknowledge work done. A filled node is its own reward.

3. **Silence is Trust.** When the app is working correctly, it should be quiet. No success toasts for routine operations. No confirmation dialogs for non-destructive actions. No loading spinners for operations under 200ms. Trust is built by the product staying out of the way, not by constantly reassuring the user.

4. **Errors are Specific, Never Catastrophic.** When something fails, the emotional response should be "I know what happened and what to do" not "something broke and I might have lost work." Error states identify the specific problem, suggest the specific fix, and never imply data loss.

5. **The Methodology Whispers, Never Shouts.** The phase graph shows what's available, suggests what's next through subtle highlighting, but never blocks or warns about skipped steps. The emotional tone is "here's the map" not "you missed a step." Methodology adoption happens through the path of least resistance, not through enforcement.
