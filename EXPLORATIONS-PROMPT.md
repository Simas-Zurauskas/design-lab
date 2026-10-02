# Explorations — how to run a round

Exploration rounds are run by the **`mood-board-creator`** skill (`~/dev/ai/SKILLS/mood-board-creator`, linked into
`~/.claude/skills`). The skill holds the whole process and its knowledge:
- researched guidelines;
- directions selected for divergence;
- build → critique → refine from screenshots;
- the round page and compare strips.

It works with any product and any output location. This lab is one of its two output targets (`targets/design-lab.md`
in the skill). `src/explorations/round-01.html` is an empty Round 1 waiting for the first run.

To start a round here, open Claude Code in the workspace root and say something like:

```text
Run a mood-board-creator round for <project>.
Output: this Design Lab (<abs path to the lab>), round <N>.   ← or: "standalone, in <folder>"
Process docs: <docs/tasks folder>.
Screens: <1 Home (wireframe path) · 2 … · 3 …>, flow <1 → 2 → 3 → 1>.
Groups: <e.g. 3 from our marketing site (<path/url>) + 3 from <inspiration folder> + 4 originals>.
Mode: speed. Images: yes, cheapest models for avatars.
Previous round feedback (round ≥ 2): <keep / push / kill + steals per variant>.
```

The lab side, for agents: rounds are sheet pages (`src/explorations/round-NN.html`, tabs in `parts/rounds.html`,
`index.html` opens the latest). The file contract and the `yarn links` rules are in this repo's `CLAUDE.md`.
