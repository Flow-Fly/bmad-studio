# Success Criteria

## User Success

Success is measured by what users **stop doing**, not what they start doing.

| Signal | Before BMAD Studio | After BMAD Studio | Measurable Proxy |
|--------|-------------------|-------------------|-----------------|
| **Session reconstruction** | 15-20 minutes grep-ing chat logs, reading old branches, reconstructing state | Opens stream, sees phase graph, productive immediately | Time to first productive action < 2 minutes |
| **Methodology skipping** | Skips architecture/PRD because "too much overhead to set up the agent with the right context" | Phase graph surfaces next step; clicking it launches the right session | Percentage of streams that follow full methodology flow |
| **Idea loss** | Insights from mid-conversation get lost when session ends | Artifacts captured per-stream in central store | Ideas that survive across sessions (stream artifact completeness) |
| **Context switch cost** | Each project/feature switch costs full orientation cycle | Stream dashboard shows state across all work | Number of stream switches per session without reconstruction delay |

**Core Metric:** Time from sitting down to first productive action drops from 15-20 minutes to under 2 minutes.

**Trust Indicator:** The user's instinct is to open BMAD Studio first — not because they have to, but because it's faster than not doing it. The methodology stops feeling like overhead and starts feeling like the shortest path.

## Business Success

BMAD Studio follows a **dogfood → open source → career catalyst** trajectory:

### Phase 1: Dogfooding (Month 1-2)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Daily usage | Using BMAD Studio for 100% of personal BMAD projects | If the creator isn't using it, nothing else matters |
| Natural reach | Reaching for it instinctively, not forcing yourself | Habit formation = genuine value |
| Stream resumption | Pick up any stream after a week away and be productive immediately | Proves the spatial awareness thesis |
| End-to-end completion | Complete OpenCode integration and real features through the cockpit | Artifacts tell a coherent story |

**Go/no-go:** Honest self-assessment. Are you using it daily? Are you reaching for it naturally?

### Phase 2: Open Source / Early Adopters (Month 3-6)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Second stream creation | Users who create a 2nd stream | First stream is curiosity. Second stream means it worked |
| Full lifecycle completion | Users who complete idea → merge → archive | Activation equivalent |
| Retention over downloads | Returning users, not star count | Stars are vanity. Retention is value |
| Community signal | Users writing their own BMAD agents/skills | They've bought the methodology, not just the tool |

**Anti-metrics:** GitHub stars, download counts, social media impressions — vanity metrics to ignore.

### Phase 3: Career Catalyst (Month 6-12)

| Metric | Signal | Why It Matters |
|--------|--------|---------------|
| Portfolio narrative | Demonstrates product thinking + technical depth + user empathy | Shows systems-level thinking about AI development |
| Inbound interest | Interviews, contracts, or conversations opened by the project | The project opens doors |
| Hiring signal | Someone hires you partly because of this project | Strongest possible validation |

## Key Performance Indicators

**North Star Metric: Streams completed per user per month.**

Not started — **completed**. A completed stream means the user trusted the methodology, the orchestration worked, and the result was a merged feature with documented decisions.

### Leading Indicators

| KPI | What It Predicts | Measurement |
|-----|-----------------|-------------|
| Time to first productive action | User trust and spatial awareness working | Timestamp: app open → first meaningful action |
| Streams created per user | Adoption breadth | Count of new streams |
| Methodology step completion rate | Methodology sticking, not being skipped | Phases completed vs phases available per stream |
| Stream resumption time | Context preservation working | Time from opening dormant stream to productive action |
| Stream lifecycle completion rate | Full value delivery | Streams merged or archived vs streams created |

### Lagging Indicators (Phase 2+)

| KPI | What It Confirms | Measurement |
|-----|-----------------|-------------|
| Second stream creation rate | Product proved value on first stream | Users who create stream #2 |
| Community contribution rate | Methodology adoption beyond tool adoption | Custom agents/skills shared |
| Retention (30-day) | Sustained value, not novelty | Users active after 30 days |

## Technical Success

- Go backend + React frontend + Electron packaging work together reliably
- Native chat UI launches and manages OpenCode SDK sessions correctly
- Stream and worktree lifecycle operations complete without data loss
- Central artifact store (`~/.bmad-studio/projects/`) maintains integrity across stream create/archive operations
- Architecture supports adding native chat UI, new stream types, and additional execution backends without major refactoring
