# 03: Inline the Export panel

**What to build:** There is no "Export Stems" action on the Mix Tab anymore. Whenever Stems exist, the Export panel is simply present, inline, in the Export Tab — no click-to-open, no modal state. It always reflects the latest mixer states, Master Volume, Time-Stretch tempo, Pitch-Shift, and Formant Preservation, re-emitted live on every change through the Transport bridge; tweaks made while the panel is on screen appear in it. The Cancel control inside the panel survives; the panel's standalone fallback (used only outside the app) stays alone.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] No Export Stems button anywhere in the Mix Tab
- [ ] Export panel region present in the Export Tab as soon as Stems exist, without any action being clicked
- [ ] Mixer-level, Master Volume, and tempo/pitch/formant changes made while the panel is present appear in it live
- [ ] Cancel inside the panel still aborts an in-flight Export Bundle
- [ ] Existing live-mirror app test keeps its assertions with the open-the-panel trigger replaced by "already present"
- [ ] Old "opens the Export panel when the action is clicked" app test inverted to present-by-default
