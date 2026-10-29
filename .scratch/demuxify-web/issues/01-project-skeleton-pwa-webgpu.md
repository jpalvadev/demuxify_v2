# 01: Project Skeleton, PWA Shell & WebGPU Capability Detection

**What to build:** The user opens the web application or installs the Progressive Web App (PWA); the system tests WebGPU hardware acceleration support, displays the primary responsive ShadCN UI shell with an informative status badge (WebGPU active vs. fallback mode), and presents a dropzone ready to accept a Source Mix.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Modern web project initialized with TypeScript, Tailwind CSS, and ShadCN UI primitives.
- [x] PWA manifest and service worker configured for offline capability and installability.
- [x] Hardware acceleration detection checking for `navigator.gpu` adapter and device availability.
- [x] UI shell displays header, theme support, WebGPU status indicator badge, and a main dropzone container.
- [x] Graceful fallback advisory shown to the user when WebGPU is not supported by their browser or hardware.
- [x] Basic unit and component integration tests verifying WebGPU capability detection and UI shell rendering.
