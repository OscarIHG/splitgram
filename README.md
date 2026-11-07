# SplitGram

> Split any horizontal or panoramic photo into 2 to 5 seamless panels for Instagram carousels — 100% local in your browser and optimized for iPhone.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![iOS PWA](https://img.shields.io/badge/iPhone-PWA_Ready-000000?style=flat&logo=apple&logoColor=white)

## Features

- **1 to 5 Panels (Single Photo or Carousel)**: Frame a single photo (`1`) or split wide horizontals/panoramas into `2`, `3`, `4`, or `5` seamless carousel slides.
- **Strava / Garmin Activity Overlay**:
  - One-tap **Paste Activity** from your clipboard (`Morning Run · 10.5 km · 5:12 /km · 54m 42s`) with smart parsing into **Title**, **Distance**, **Pace**, and **Time / Elev**.
  - Supports pasting or uploading transparent **Strava Sticker PNGs** (including GPS route maps).
  - 3 visual themes (**Strava Orange Bar**, **Dark Glass Badge**, **Minimal White**), 4 positions, and slide targeting (**Slide 1**, **Last Slide**, or **Center Seam** across slides).
- **3 Instagram Aspect Ratios**: `4:5` (Classic Portrait), `3:4` (Taller Grid), and `1:1` (Square).
- **2D Interactive Crop & Pan**: Live preview with vertical (`↕`) and horizontal (`↔`) drag panning and darkened crop overlays.
- **Instant Live Split**: Panels render and update in real time as you drag or change settings — no manual split button needed.
- **Flexible Export Formats & Sizes**:
  - Formats: **JPG** (95%, ideal for iOS Photos & Instagram), **PNG** (lossless), or **WebP**.
  - Resolution: **Instagram 1080p** (`1080px` width per panel) or **Max Native** original resolution.
- **Built for iPhone (iOS PWA & Share Sheet)**:
  - One-tap **Save to iPhone Photos / Share** via the native iOS Web Share API (`navigator.share` with files) to save all slides directly to your Camera Roll without dealing with `.zip` files.
  - Full-screen standalone mode (`apple-mobile-web-app-capable`), Dynamic Island / Home Indicator safe-area support, and offline caching via Service Worker.

## Using on iPhone

1. Open [SplitGram](https://oscarihg.github.io/splitgram) in **Safari** on your iPhone.
2. Tap **Share** -> **Add to Home Screen** (*Agregar a pantalla de inicio*).
3. Launch **SplitGram** from your Home Screen like a native app (works 100% offline).
4. Select any photo from your library, adjust the crop, and tap **Save to iPhone Photos / Share** -> **Save X Images** to save all panels straight to your Camera Roll.

## Structure

```
splitgram/
├── index.html      <- Main UI & iOS PWA metadata
├── style.css       <- Responsive glassmorphic styles & iOS safe-areas
├── app.js          <- 2D crop/pan, live canvas splitter & Web Share API
├── manifest.json   <- Web App Manifest
├── sw.js           <- Offline-first Service Worker with cache cleanup
└── README.md
```

## License

MIT (c) Oscar Gomez
