# SplitGram

> Split any horizontal photo into two perfect panels for Instagram carousels — with zero quality loss.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

## Features

- Drag & drop or click to upload (JPG, PNG, WebP)
- 3 aspect ratios: 4:5 (classic Instagram), 3:4 (taller), 1:1 (square)
- Zero quality loss — exports as lossless PNG via Canvas API at maximum original resolution
- Live preview with split line and crop overlay
- Download individually or as a ZIP with both panels
- 100% local — your image never leaves your browser

## How to use

1. Open `index.html` in your browser (or visit the [live demo](https://oscarihg.github.io/splitgram))
2. Drag or select a horizontal photo
3. Pick your desired aspect ratio (4:5, 3:4, or 1:1)
4. Click "Split image"
5. Download each panel or both as a ZIP
6. Upload them to Instagram as a carousel

## Design

- Dark theme with animated floating orbs (glassmorphism)
- Purple to pink to orange gradient accents
- Premium typography (Inter + Space Grotesk)
- Micro-animations and smooth transitions
- Fully responsive

## Structure

```
splitgram/
├── index.html   <- Main structure
├── style.css    <- Styles and animations
├── app.js       <- App logic
└── README.md
```

## Tech Stack

- HTML5 Canvas for lossless image processing
- JSZip for ZIP downloads
- CSS3 with animations, glassmorphism, and gradients
- Vanilla JavaScript — no framework dependencies

## License

MIT (c) Oscar Gomez
