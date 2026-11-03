# 04: Solo/Mute exclusivity per Stem — last press wins + Session load sanitizer

**What to build:** a **Stem** can never be soloed and muted at once. Pressing S on a muted Stem clears its mute and plays it alone; pressing M on a soloed Stem drops the solo and silences that Stem — last press wins, the mixer never has to un-press the other control first. The all-silent solo+muted state becomes unrepresentable at the engine seam, so no path (init, mid-playback edit, restore) can ever smuggle it back, and a **Session** that stored both flags restores as solo with the mute flag dropped silently.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Engine seam: the solo toggle clears `muted` when it presses on; the mute toggle clears `solo` when it presses; a second press re-arms the axis — asserted on lane state and on the **gain-matrix outcomes** through the shared mock AudioContext factory (existing mixer-state describe blocks are the prior art).
- [ ] The `solo && muted` pair is unrepresentable: the existing gain-matrix branch that silenced everything when a soloed Stem was muted never fires; the rest of the matrix behavior (solo isolates unselected Stems; mute silences one) stays identical.
- [ ] Stem Player rail: the M and S buttons keep their accessible names and `aria-pressed` states; their visuals and layout stay untouched — only the state behind them changes.
- [ ] Session load gate: restored mixer settings with both flags set resolve to solo (`muted` cleared) at the same validation gate the existing Session Recovery tests already drive; the write side needs no change once the engine cannot produce the pair.
- [ ] New ADR "Solo and Mute are per-Stem exclusive" authored with this increment: last press wins + solo-wins load rule + why (a future reader wondering "why does M clear S" finds the answer).
- [ ] Full pre-commit check cycle green.

## Design decisions for this ticket

- Exclusivity at the engine seam, not UI hiding (settled in grilling Q4/Q9): UI-only enforcement would let restore paths smuggle the illegal pair back in.
- Sanitizer direction is solo-wins at load (runtime is last-press-wins): load has no press order, and solo is the intent-revealing state.
- The Click Track lane is out of scope here — it has no solo axis and its mute died in ticket 03.

**Branch:** mix-rail-tidy-up (new branch off `main` at porting start)

**Spec:** `.scratch/mix-rail-tidy-up/spec.md`
