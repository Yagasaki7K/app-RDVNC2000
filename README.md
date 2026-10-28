<p align="center">
    <img width="739" height="415" alt="image" src="https://github.com/user-attachments/assets/0415cac9-78da-4124-95b7-19af1fc0ac0b" />
</p>

# RDVNC2000

> RDVNC2000 (Roman DV Night City 2000) inspired in styled of Roman in Cyberpunk Edgerunners 2. A browser-based analog camcorder. Point your phone at Night City, hit REC, and get back a grainy, chromatically-aberrated, tungsten-tinted video file — as if it were shot on a Sony VX2000 in the year 2000.

R-DVNC2000 is a **Progressive Web App (PWA)** built with **Vite + React + TypeScript** that replaces your device's camera app with a fully simulated early-2000s digital camcorder. It captures your camera feed, runs it through a custom **WebGL shader** in real time, and records the processed result to a downloadable video file — all without a native app, a backend, or any server-side processing.

The project is a homage to the camcorder aesthetic seen in _Cyberpunk: Edgerunners_ — specifically the idea of a character filming Night City on ancient hardware, deliberately sacrificing modern image quality for texture, imperfection, and mood.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [The Shader](#the-shader)
- [Two Themes](#two-themes)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Recording & Export](#recording--export)
- [Browser Requirements](#browser-requirements)
- [Project Structure](#project-structure)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

- 📷 **Live camera capture** via `getUserMedia`, targeting SD resolution (640×480 @ 24 fps) to match the VX2000's native output.
- 🎞️ **Real-time analog emulation** through a custom GLSL fragment shader running on a `<canvas>`:
    - Film grain / sensor noise
    - Chromatic aberration (RGB channel separation)
    - Tungsten white-balance drift (green/blue cast)
    - Horizontal tracking lines
    - Vignette
    - Desaturation and "dirty" contrast
    - Subtle frame jitter
- 🎛️ **Live parameter control** — three sliders adjust noise, aberration, and tungsten tint on the fly.
- ⏺️ **In-browser recording** — the processed canvas stream plus the original microphone audio are combined into a `MediaRecorder` output (WebM/VP9), downloadable as a "tape".
- 📼 **Camcorder OSD** — REC/STBY indicator, tape counter, and on-screen readouts (SD 640×480, 24fps, WB 3200K, ISO AUTO).
- 🎨 **Two visual themes**, switchable with a single button next to REC:
    - **Cyberpunk 2077** — neon yellow `#fcee0a`, cyan `#00f0ff`, magenta `#ff003c`, chamfered corners, scanlines, glitch title.
    - **VX2000 Fullscreen** — the viewfinder fills the entire screen, the control panel collapses into a small floating REC + THEME bar, and the OSD turns phosphorescent green.
- 📱 **Mobile-first & installable** — works as a PWA, runs entirely client-side, no data ever leaves the device.

---

## How It Works

The pipeline is deliberately simple and fully local:

```
Camera (getUserMedia)
        │
        ▼
   <video> (hidden)
        │  texImage2D (per frame)
        ▼
   <canvas> (WebGL)
        │  custom fragment shader
        ▼
   canvas.captureStream(24)
        │
        ├── video track ──┐
        │                 ├──► MediaStream ──► MediaRecorder ──► Blob ──► download
        └── audio track ──┘   (from getUserMedia)
```

1. **Capture** — `navigator.mediaDevices.getUserMedia()` requests the rear camera at an ideal 640×480 / 24 fps, plus audio. The raw stream is attached to a hidden `<video>` element.
2. **Process** — On every animation frame, the current video frame is uploaded as a texture to a WebGL canvas. The fragment shader applies all analog artifacts in a single pass on the GPU.
3. **Record** — When REC is pressed, `canvas.captureStream(24)` grabs the _processed_ output, the original microphone audio track is merged in, and a `MediaRecorder` writes the result to a WebM blob.
4. **Export** — On STOP, the blob becomes an object URL and is offered as a download ("SALVAR FITA").

Everything — capture, processing, encoding, and export — happens in the browser. No uploads, no server, no native bridge.

---

## The Shader

The visual identity of R-DVNC2000 lives in `FRAGMENT_SHADER` (in `App.tsx`). It is a single-pass GLSL `mediump` shader with four uniforms:

| Uniform    | Range     | Effect                                                          |
| ---------- | --------- | --------------------------------------------------------------- |
| `u_time`   | seconds   | Drives grain, jitter, and tracking line animation.              |
| `u_noise`  | 0.0 – 1.0 | Amplitude of the procedural film grain.                         |
| `u_chroma` | 0.0 – 3.0 | Horizontal RGB channel separation (chromatic aberration).       |
| `u_tint`   | 0.0 – 1.0 | Strength of the tungsten color drift (red down, blue/green up). |

The shader also applies a fixed vignette, a slight desaturation, a contrast boost, and occasional horizontal tracking lines — all procedural, no textures or lookup tables required.

---

## Two Themes

The UI ships with two switchable looks, controlled by a hidden checkbox (`#toggle-tema`) and CSS `:has()`:

### 🟡 Cyberpunk 2077 (default)

- Neon yellow borders and accents, cyan/magenta highlights.
- Chamfered `clip-path` corners on panels and buttons.
- Animated scanlines and a glitching title.
- Sliders with neon gradient tracks.
- Full control panel visible below the viewfinder.

### 🟢 VX2000 Fullscreen

- Viewfinder fills the entire viewport (`100vw × 100vh`).
- Control panel collapses; sliders and download link are hidden.
- A small translucent floating bar (REC + THEME) stays in the bottom-right corner.
- OSD switches to phosphorescent green, with a rawer monospace font.
- Corner brackets and scanlines become subtler, closer to a real camcorder.

Switching is instant and CSS-only (no React state involved for the theme itself).

---

## Tech Stack

- **Vite** — build tool and dev server.
- **React 18** — UI.
- **TypeScript** — type safety.
- **WebGL 1.0** — real-time image processing (no external 3D library).
- **MediaRecorder API** — in-browser video encoding.
- **CSS `:has()`** — theme switching without extra JS state.
- **Plain CSS** — no preprocessor, no utility framework.

No runtime dependencies beyond React itself.

---

## Getting Started

```bash
# Clone
git clone https://github.com/<your-user>/r-dvnc2000.git
cd r-dvnc2000

# Install
npm install

# Dev server (HTTPS is required for camera access on non-localhost)
npm run dev

# Production build
npm run build

# Preview the production build
npm run preview
```

> **Camera access requires a secure context.** `getUserMedia` only works on `https://` or `http://localhost`. For testing on a phone over your LAN, use a tunneling tool (e.g. `ngrok`, `cloudflared`) or Vite's `--host` with a self-signed HTTPS setup.

---

## Usage

1. Open the app and press **⏻ ABRIR LENTE** to grant camera and microphone permissions.
2. Adjust the three sliders (**RUÍDO**, **ABERRAÇÃO**, **TUNGSTÊNIO**) until the image feels right.
3. Press **● REC** to start recording. The OSD shows `REC` and the tape counter starts.
4. Press **■ STOP** to finish. A **⬇ SALVAR FITA** button appears — tap it to download the WebM file.
5. Press **◐ TEMA** (next to REC) to toggle between the Cyberpunk 2077 and VX2000 Fullscreen themes.

---

## Recording & Export

- **Container:** WebM
- **Codec:** VP9 when supported, falling back to the browser's default WebM codec.
- **Bitrate:** ~1.5 Mbps (intentionally modest, matching the analog aesthetic).
- **Video source:** the _processed_ WebGL canvas, not the raw camera feed — what you see is what you record.
- **Audio source:** the original microphone track from `getUserMedia` (mono, unprocessed).

Recorded files are named `R-DVNC2000_<timestamp>.webm`.

---

## Browser Requirements

| Requirement              | Notes                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| Secure context (HTTPS)   | Mandatory for `getUserMedia`. `localhost` is exempt.              |
| `getUserMedia`           | Supported in all modern browsers.                                 |
| WebGL 1.0                | Required. Falls back to an error message if unavailable.          |
| `MediaRecorder`          | Required for recording. VP9 preferred, WebM fallback.             |
| `canvas.captureStream()` | Required for recording the processed output.                      |
| CSS `:has()`             | Required for the theme toggle. Supported in all current browsers. |

Tested primarily on Chromium-based browsers and Safari (iOS 16+). Firefox works for preview but WebGL performance and MediaRecorder codec support vary.

---

## Project Structure

```
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src
    ├── main.tsx
    ├── App.tsx          # Camera, WebGL pipeline, shaders, recorder, UI
    ├── App.css          # Both themes, OSD, panels, fullscreen mode
    └── assets/
```

The entire application logic — capture, shader compilation, render loop, recording, and UI — lives in `App.tsx`. Styling and both themes live in `App.css`.

---

## Limitations

Because R-DVNC2000 is a web app, it **cannot** control physical camera parameters the way a native app can:

- **No real manual focus, ISO, or shutter speed.** Focus and exposure are simulated via shader (blur, over/under-exposure are _visual_ effects, not hardware settings).
- **No true fixed white balance.** The tungsten cast is a post-process color shift, not a sensor-level setting.
- **Resolution and frame rate are best-effort.** The browser may ignore the requested 640×480 / 24 fps and pick the closest supported mode.
- **No background recording.** If the tab is backgrounded, the render loop and recorder may be throttled by the browser.
- **iOS Safari** has stricter MediaRecorder and canvas-capture behavior than desktop browsers.

For the "Roman look", none of this matters — the shader gives you full artistic control over the final texture.

---

## Roadmap

- [ ] Persist slider values in `localStorage`.
- [ ] Optional "tape counter reset" and multi-clip tape simulation.
- [ ] Additional shader presets (VHS, Hi8, Video8, Betacam).
- [ ] Optional `MediaStreamTrack.applyConstraints()` for browsers that expose `exposureMode` / `whiteBalanceMode`.
- [ ] Save recordings to IndexedDB for a "tape library" view.
- [ ] Service worker for full offline PWA support.
- [ ] Wake Lock API to keep the screen on while recording.

---

## License

MIT — do whatever you want with it. Night City is not responsible for any corrupted tapes.
