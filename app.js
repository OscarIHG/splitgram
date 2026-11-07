/* ============================================
   SplitGram — App Logic (Stories 9:16, Carousels & Interactive Strava Overlay)
   ============================================ */

(() => {
  'use strict';

  // --- DOM Elements ---
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const uploadSection = document.getElementById('uploadSection');
  const editorSection = document.getElementById('editorSection');
  const originalPreview = document.getElementById('originalPreview');
  const originalImg = document.getElementById('originalImg');
  const previewOverlayCanvas = document.getElementById('previewOverlayCanvas');
  const splitLinesContainer = document.getElementById('splitLinesContainer');
  const panHandle = document.getElementById('panHandle');
  const previewCaption = document.getElementById('previewCaption');
  const fileNameEl = document.getElementById('fileName');
  const imageSizeEl = document.getElementById('imageSize');
  const changeImageBtn = document.getElementById('changeImageBtn');

  const panelCountSelector = document.getElementById('panelCountSelector');
  const ratioSelector = document.getElementById('ratioSelector');
  const formatSelector = document.getElementById('formatSelector');
  const resolutionSelector = document.getElementById('resolutionSelector');

  // Strava DOM Elements
  const toggleStravaBtn = document.getElementById('toggleStravaBtn');
  const toggleStravaText = document.getElementById('toggleStravaText');
  const stravaBody = document.getElementById('stravaBody');
  const pasteStravaBtn = document.getElementById('pasteStravaBtn');
  const uploadStickerBtn = document.getElementById('uploadStickerBtn');
  const stickerInput = document.getElementById('stickerInput');
  const clearStickerBtn = document.getElementById('clearStickerBtn');
  const stravaPasteZone = document.getElementById('stravaPasteZone');
  const stravaTitleInput = document.getElementById('stravaTitleInput');
  const stravaDistInput = document.getElementById('stravaDistInput');
  const stravaPaceInput = document.getElementById('stravaPaceInput');
  const stravaTimeInput = document.getElementById('stravaTimeInput');
  const stravaStyleSelector = document.getElementById('stravaStyleSelector');
  const stravaPosSelector = document.getElementById('stravaPosSelector');
  const stravaScaleInput = document.getElementById('stravaScaleInput');
  const stravaScaleLabel = document.getElementById('stravaScaleLabel');
  const stravaTargetGroup = document.getElementById('stravaTargetGroup');
  const stravaTargetSelector = document.getElementById('stravaTargetSelector');

  const exportDimsBadge = document.getElementById('exportDimsBadge');
  const panelsGrid = document.getElementById('panelsGrid');
  const shareBtn = document.getElementById('shareBtn');
  const shareBtnText = document.getElementById('shareBtnText');
  const zipBtn = document.getElementById('zipBtn');

  const cropTop = document.getElementById('cropTop');
  const cropBottom = document.getElementById('cropBottom');
  const cropLeft = document.getElementById('cropLeft');
  const cropRight = document.getElementById('cropRight');

  const iosInstallBtn = document.getElementById('iosInstallBtn');
  const iosModal = document.getElementById('iosModal');
  const closeIosModal = document.getElementById('closeIosModal');

  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');

  // --- State ---
  let sourceImage = null;
  let originalFileName = 'image';
  let panelCount = 1; // Default 1 (Story / Single photo)
  let currentRatio = { w: 9, h: 16 }; // Default 9:16 Story
  let exportFormat = 'image/jpeg';
  let exportExt = 'jpg';
  let resolutionMode = '1080';

  // Strava Overlay State
  let stravaEnabled = true;
  let stravaStyle = 'strava-classic'; // 'strava-classic' | 'story-vertical' | 'hero-km' | 'glass-dark' | 'minimal-white'
  let stravaPos = 'bottom-left'; // 'bottom-left' | 'bottom-center' | 'center' | 'top-left' | 'custom'
  let stravaScale = 1.0;
  let stravaTarget = 'first'; // 'first' | 'last' | 'all'
  let stravaStickerImg = null;

  // Normalized custom drag coordinates (0..1 within target surface)
  let customOverlayPos = null; // { xRatio, yRatio } of overlay top-left
  // Last rendered overlay bounding box on previewOverlayCanvas (for hit-testing finger drag)
  let lastPreviewOverlayBox = null; // { x, y, w, h, surfaceW, surfaceH }

  // Crop offsets: 0 = top/left, 0.5 = center, 1 = bottom/right
  let cropOffsetX = 0.5;
  let cropOffsetY = 0.5;
  let panAxis = 'none'; // 'vertical' | 'horizontal' | 'none'

  let dragMode = 'none'; // 'crop' | 'overlay' | 'none'
  let dragStartCoord = { x: 0, y: 0 };
  let dragStartOffset = 0.5;
  let dragStartOverlayPos = { x: 0, y: 0 };
  let rafPending = false;

  let panelCanvases = [];
  let toastTimeout = null;

  // --- Helpers ---
  function showToast(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastText.textContent = msg;
    toast.classList.add('visible');
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  function isStandalonePWA() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function supportsFileShare() {
    if (!navigator.canShare || !navigator.share) return false;
    try {
      const testFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }

  function canvasToBlob(canvas, mimeType, quality = 0.95) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }

  function hasStravaOverlay() {
    if (!stravaEnabled) return false;
    return Boolean(
      stravaStickerImg ||
      stravaTitleInput.value.trim() ||
      stravaDistInput.value.trim() ||
      stravaPaceInput.value.trim() ||
      stravaTimeInput.value.trim()
    );
  }

  // --- Smart Strava / Garmin Text Parser ---
  function parseStravaText(raw) {
    const text = (raw || '').trim();
    if (!text) return;

    stravaEnabled = true;
    updateStravaToggleUI();

    let remaining = text;

    // 1. Extract Pace (e.g. "5:12 /km", "4:55/km", "7:30 /mi", "5'10\"/km")
    let pace = '';
    const paceRegex = /\b(\d{1,2}[:']\d{2}"?\s*\/\s*(?:km|mi|100m))\b/i;
    const labeledPaceRegex = /(?:ritmo|pace)[:\s]+(\d{1,2}[:']\d{2}"?(?:\s*\/\s*(?:km|mi))?)/i;
    const paceMatch = remaining.match(paceRegex) || remaining.match(labeledPaceRegex);
    if (paceMatch) {
      pace = paceMatch[1].replace(/\s+/g, ' ').trim();
      if (!pace.includes('/')) pace += ' /km';
      remaining = remaining.replace(paceMatch[0], ' ');
    }

    // 2. Extract Distance (e.g. "10.52 km", "21.1km", "5 mi", "10K")
    let dist = '';
    const distRegex = /\b(\d+(?:[.,]\d+)?\s*(?:km|mi|k))\b/i;
    const labeledDistRegex = /(?:distancia|distance|dist)[:\s]+(\d+(?:[.,]\d+)?\s*(?:km|mi|m|k)?)/i;
    const distMatch = remaining.match(distRegex) || remaining.match(labeledDistRegex);
    if (distMatch) {
      dist = distMatch[1].replace(/\s+/g, ' ').trim();
      if (/^\d+(?:[.,]\d+)?$/i.test(dist)) dist += ' km';
      remaining = remaining.replace(distMatch[0], ' ');
    }

    // 3. Extract Time (e.g. "1h 05m", "54m 42s", "1:02:15", "48:20")
    let time = '';
    const timeRegex = /\b(\d{1,2}h\s*\d{1,2}m(?:\s*\d{1,2}s)?|\d{1,3}m\s*\d{1,2}s|\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})\b/i;
    const timeMatch = remaining.match(timeRegex);
    if (timeMatch) {
      time = timeMatch[1].trim();
      remaining = remaining.replace(timeMatch[0], ' ');
    }

    // 4. Extract Elevation or Heart Rate (e.g. "+120 m", "145 m", "162 bpm")
    let extra = '';
    const extraRegex = /(?:(?:desnivel|elev(?:ation)?|gain)[:\s]*([+\-]?\d+\s*(?:m|ft))|\b(\+\d+\s*(?:m|ft)|\d+\s*bpm)\b)/i;
    const extraMatch = remaining.match(extraRegex);
    if (extraMatch) {
      extra = (extraMatch[1] || extraMatch[2]).trim();
      remaining = remaining.replace(extraMatch[0], ' ');
    }

    const combinedTime = time && extra ? `${time} · ${extra}` : time || extra;

    // 5. Extract Title from remaining text
    let cleanTitle = remaining
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\b(distancia|distance|ritmo|pace|tiempo|time|moving time|desnivel|elevation|gain|strava|garmin)\b[:\s]*/gi, '')
      .replace(/[·|•\-\n\r\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (cleanTitle) stravaTitleInput.value = cleanTitle.slice(0, 40);
    if (dist) stravaDistInput.value = dist;
    if (pace) stravaPaceInput.value = pace;
    if (combinedTime) stravaTimeInput.value = combinedTime;

    if (!dist && !pace && !combinedTime && !cleanTitle && text) {
      stravaTitleInput.value = text.slice(0, 40);
    }

    renderAll();
  }

  function loadStickerBlob(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      stravaStickerImg = img;
      stravaEnabled = true;
      updateStravaToggleUI();
      clearStickerBtn.classList.remove('hidden');
      renderAll();
      showToast('¡Sticker de Strava pegado sobre la foto!');
    };
    img.src = url;
  }

  function updateStravaToggleUI() {
    if (stravaEnabled) {
      toggleStravaBtn.classList.add('active');
      toggleStravaText.textContent = '✓ Visible en foto';
      stravaBody.classList.remove('disabled');
    } else {
      toggleStravaBtn.classList.remove('active');
      toggleStravaText.textContent = 'Oculto en foto';
      stravaBody.classList.add('disabled');
    }
  }

  function getCropAndDimensions() {
    if (!sourceImage) return null;

    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;
    const targetAspect = (panelCount * currentRatio.w) / currentRatio.h;
    const imgAspect = imgW / imgH;

    let sx, sy, sw, sh;
    let nativePanelW, nativePanelH;

    if (imgAspect > targetAspect) {
      sh = imgH;
      sw = imgH * targetAspect;
      const totalSlackX = imgW - sw;
      sx = cropOffsetX * totalSlackX;
      sy = 0;

      nativePanelH = imgH;
      nativePanelW = imgH * (currentRatio.w / currentRatio.h);
    } else {
      sw = imgW;
      sh = imgW / targetAspect;
      sx = 0;
      const totalSlackY = imgH - sh;
      sy = cropOffsetY * totalSlackY;

      nativePanelW = imgW / panelCount;
      nativePanelH = nativePanelW * (currentRatio.h / currentRatio.w);
    }

    let panelW, panelH;
    if (resolutionMode === '1080') {
      if (currentRatio.w === 16 && currentRatio.h === 9) {
        panelW = 1920;
        panelH = 1080;
      } else {
        panelW = 1080;
        panelH = Math.round(1080 * (currentRatio.h / currentRatio.w));
      }
    } else {
      panelW = Math.max(1, Math.round(nativePanelW));
      panelH = Math.max(1, Math.round(nativePanelH));
    }

    return { imgW, imgH, targetAspect, imgAspect, sx, sy, sw, sh, panelW, panelH };
  }

  // --- UI Builders & Updaters ---
  function buildSplitLines() {
    splitLinesContainer.innerHTML = '';
    for (let i = 1; i < panelCount; i++) {
      const line = document.createElement('div');
      line.className = 'split-line';
      splitLinesContainer.appendChild(line);
    }
  }

  function buildPanelCards() {
    panelsGrid.innerHTML = '';
    panelCanvases = [];

    if (panelCount === 1) {
      stravaTargetGroup.style.display = 'none';
    } else {
      stravaTargetGroup.style.display = '';
    }

    for (let i = 0; i < panelCount; i++) {
      const panelNum = i + 1;
      const card = document.createElement('div');
      card.className = 'panel-card';

      let labelPos = `Panel ${panelNum} de ${panelCount}`;
      if (panelCount === 1) {
        labelPos = 'Imagen final lista para exportar';
      } else if (panelCount === 2) {
        labelPos = i === 0 ? 'Panel izquierdo (1)' : 'Panel derecho (2)';
      }

      card.innerHTML = `
        <div class="panel-label">
          <span class="panel-number">${panelNum}</span>
          <span>${labelPos}</span>
        </div>
        <div class="panel-canvas-wrap">
          <canvas id="canvas_${panelNum}"></canvas>
        </div>
        <div class="panel-actions">
          <span class="panel-dims" data-dims="${i}">1080 × 1920</span>
          <button class="download-btn" type="button" data-download="${i}" aria-label="Download panel ${panelNum}">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 3v9m0 0l-3-3m3 3l3-3M3 15h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>${exportExt.toUpperCase()}</span>
          </button>
        </div>
      `;

      const canvas = card.querySelector('canvas');
      const dlBtn = card.querySelector('.download-btn');
      dlBtn.addEventListener('click', () => downloadSinglePanel(i));

      panelsGrid.appendChild(card);
      panelCanvases.push(canvas);
    }
  }

  function updateExportBadges() {
    const info = getCropAndDimensions();
    const extUpper = exportExt.toUpperCase();

    panelsGrid.querySelectorAll('.download-btn span').forEach((el) => {
      el.textContent = extUpper;
    });

    if (!info) {
      exportDimsBadge.textContent = `1080 × 1920 px · ${extUpper}`;
      return;
    }

    const { panelW, panelH } = info;
    if (panelCount === 1) {
      exportDimsBadge.textContent = `${panelW} × ${panelH} px · ${extUpper}`;
    } else {
      exportDimsBadge.textContent = `${panelCount} × (${panelW} × ${panelH} px) · ${extUpper}`;
    }

    panelsGrid.querySelectorAll('[data-dims]').forEach((el) => {
      el.textContent = `${panelW} × ${panelH}`;
    });
  }

  function updateCropOverlay() {
    const info = getCropAndDimensions();
    if (!info) return;

    const { imgAspect, targetAspect } = info;
    const lines = splitLinesContainer.querySelectorAll('.split-line');

    let leftPercent = 0;
    let rightPercent = 0;
    let topPercent = 0;
    let bottomPercent = 0;

    if (Math.abs(imgAspect - targetAspect) < 0.002) {
      panAxis = 'none';
      panHandle.classList.add('hidden');
      panHandle.classList.remove('mode-vertical', 'mode-horizontal');
      originalPreview.classList.remove('pannable');
    } else if (imgAspect > targetAspect) {
      panAxis = 'horizontal';
      const usedWidthRatio = targetAspect / imgAspect;
      const totalCropPercent = (1 - usedWidthRatio) * 100;
      leftPercent = cropOffsetX * totalCropPercent;
      rightPercent = (1 - cropOffsetX) * totalCropPercent;
      const visiblePercent = 100 - totalCropPercent;

      panHandle.style.left = `${leftPercent + visiblePercent / 2}%`;
      panHandle.style.top = '50%';
      panHandle.classList.remove('hidden', 'mode-vertical');
      panHandle.classList.add('mode-horizontal');
      originalPreview.classList.add('pannable');
    } else {
      panAxis = 'vertical';
      const usedHeightRatio = imgAspect / targetAspect;
      const totalCropPercent = (1 - usedHeightRatio) * 100;
      topPercent = cropOffsetY * totalCropPercent;
      bottomPercent = (1 - cropOffsetY) * totalCropPercent;
      const visiblePercent = 100 - totalCropPercent;

      panHandle.style.left = '50%';
      panHandle.style.top = `${topPercent + visiblePercent / 2}%`;
      panHandle.classList.remove('hidden', 'mode-horizontal');
      panHandle.classList.add('mode-vertical');
      originalPreview.classList.add('pannable');
    }

    cropTop.style.height = `${topPercent}%`;
    cropBottom.style.height = `${bottomPercent}%`;
    cropLeft.style.width = `${leftPercent}%`;
    cropRight.style.width = `${rightPercent}%`;

    const visibleWPercent = 100 - leftPercent - rightPercent;
    lines.forEach((line, idx) => {
      const pct = leftPercent + visibleWPercent * ((idx + 1) / panelCount);
      line.style.left = `${pct}%`;
      line.style.top = `${topPercent}%`;
      line.style.bottom = `${bottomPercent}%`;
    });

    // Position the live preview overlay canvas over the uncropped active area
    previewOverlayCanvas.style.left = `${leftPercent}%`;
    previewOverlayCanvas.style.top = `${topPercent}%`;
    previewOverlayCanvas.style.width = `${visibleWPercent}%`;
    previewOverlayCanvas.style.height = `${100 - topPercent - bottomPercent}%`;
  }

  // --- Strava Canvas Drawing Engine (5 Activity Designs + Free Drag + Scale) ---
  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function resolveOverlayOrigin(surfaceW, surfaceH, boxW, boxH, padX, padY) {
    if (customOverlayPos) {
      const x = Math.max(8, Math.min(surfaceW - boxW - 8, customOverlayPos.xRatio * surfaceW));
      const y = Math.max(8, Math.min(surfaceH - boxH - 8, customOverlayPos.yRatio * surfaceH));
      return { x, y };
    }

    let x = padX;
    let y = surfaceH - padY - boxH;
    if (stravaPos === 'bottom-center') {
      x = (surfaceW - boxW) / 2;
      y = surfaceH - padY - boxH;
    } else if (stravaPos === 'top-left') {
      x = padX;
      y = padY;
    } else if (stravaPos === 'center') {
      x = (surfaceW - boxW) / 2;
      y = (surfaceH - boxH) / 2;
    }
    return { x, y };
  }

  function drawStravaBadgePill(ctx, x, y, scale) {
    const brandFont = `800 ${Math.round(17 * scale)}px "Inter", sans-serif`;
    ctx.font = brandFont;
    const badgeText = 'STRAVA';
    const bw = ctx.measureText(badgeText).width + Math.round(16 * scale);
    const bh = Math.round(25 * scale);
    ctx.save();
    ctx.shadowColor = 'transparent';
    drawRoundedRect(ctx, x, y, bw, bh, Math.round(6 * scale));
    ctx.fillStyle = '#FC4C02';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, x + Math.round(8 * scale), y + bh / 2 + 1);
    ctx.restore();
    return { bw, bh };
  }

  function drawStravaOverlayOnSurface(ctx, surfaceW, surfaceH, scaleBaseW) {
    const scale = (scaleBaseW / 1080) * stravaScale;
    const padX = Math.round(60 * (scaleBaseW / 1080));
    const padY = Math.round(76 * (scaleBaseW / 1080));

    // 1. If a transparent PNG sticker is loaded, draw it and return its bounding box
    if (stravaStickerImg) {
      const maxStickerW = surfaceW * 0.55 * stravaScale;
      const maxStickerH = surfaceH * 0.45 * stravaScale;
      const ratio = Math.min(
        maxStickerW / stravaStickerImg.naturalWidth,
        maxStickerH / stravaStickerImg.naturalHeight
      );
      const sw = Math.round(stravaStickerImg.naturalWidth * ratio);
      const sh = Math.round(stravaStickerImg.naturalHeight * ratio);

      const { x, y } = resolveOverlayOrigin(surfaceW, surfaceH, sw, sh, padX, padY);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 18 * scale;
      ctx.shadowOffsetY = 4 * scale;
      ctx.drawImage(stravaStickerImg, x, y, sw, sh);
      ctx.restore();
      return { x, y, w: sw, h: sh };
    }

    // 2. Gather text metrics
    const title = stravaTitleInput.value.trim();
    const dist = stravaDistInput.value.trim();
    const pace = stravaPaceInput.value.trim();
    const time = stravaTimeInput.value.trim();

    const metrics = [];
    if (dist) metrics.push({ label: 'DISTANCIA', value: dist });
    if (pace) metrics.push({ label: 'RITMO', value: pace });
    if (time) {
      const label = time.includes('+') ? 'TIEMPO / DESNIVEL' : 'TIEMPO';
      metrics.push({ label, value: time });
    }

    if (!title && metrics.length === 0) return null;

    ctx.save();
    ctx.textBaseline = 'top';

    const isCenteredAlign =
      stravaPos === 'bottom-center' ||
      stravaPos === 'center' ||
      stravaStyle === 'hero-km' ||
      stravaStyle === 'minimal-white';

    // --- DESIGN A: STORY VERTICAL TOWER ('story-vertical') ---
    if (stravaStyle === 'story-vertical') {
      const labelFont = `600 ${Math.round(18 * scale)}px "Inter", sans-serif`;
      const valueFont = `800 ${Math.round(56 * scale)}px "Space Grotesk", "Inter", sans-serif`;
      const titleFont = `700 ${Math.round(26 * scale)}px "Space Grotesk", "Inter", sans-serif`;

      const rowH = Math.round(86 * scale);
      const headerH = Math.round(44 * scale);

      let maxW = Math.round(200 * scale);
      if (title) {
        ctx.font = titleFont;
        maxW = Math.max(maxW, ctx.measureText(title).width + Math.round(90 * scale));
      }
      metrics.forEach((m) => {
        ctx.font = labelFont;
        const lw = ctx.measureText(m.label).width;
        ctx.font = valueFont;
        const vw = ctx.measureText(m.value).width;
        maxW = Math.max(maxW, lw, vw);
      });

      const boxW = maxW + Math.round(28 * scale);
      const boxH = headerH + metrics.length * rowH;
      const { x: startX, y: startY } = resolveOverlayOrigin(surfaceW, surfaceH, boxW, boxH, padX, padY);

      // Vertical Strava Orange Accent Line
      const barW = Math.round(6 * scale);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 12 * scale;
      drawRoundedRect(ctx, startX, startY, barW, boxH, barW / 2);
      ctx.fillStyle = '#FC4C02';
      ctx.fill();
      ctx.restore();

      const innerX = startX + Math.round(22 * scale);
      let curY = startY;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 14 * scale;
      ctx.shadowOffsetY = 2 * scale;

      const { bw } = drawStravaBadgePill(ctx, innerX, curY + Math.round(2 * scale), scale);
      if (title) {
        ctx.font = titleFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(title, innerX + bw + Math.round(10 * scale), curY);
      }
      curY += headerH;

      metrics.forEach((m) => {
        ctx.font = labelFont;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(m.label, innerX, curY);

        ctx.font = valueFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(m.value, innerX, curY + Math.round(20 * scale));
        curY += rowH;
      });

      ctx.restore();
      return { x: startX, y: startY, w: boxW, h: boxH };
    }

    // --- DESIGN B: HERO GIANT KM ('hero-km') ---
    if (stravaStyle === 'hero-km') {
      const heroVal = dist || (metrics[0] ? metrics[0].value : title);
      const subParts = [];
      if (pace) subParts.push(pace);
      if (time) subParts.push(time);
      const subText = subParts.join('   ·   ');

      const titleFont = `700 ${Math.round(24 * scale)}px "Inter", sans-serif`;
      const heroFont = `800 ${Math.round(92 * scale)}px "Space Grotesk", "Inter", sans-serif`;
      const subFont = `700 ${Math.round(28 * scale)}px "Space Grotesk", "Inter", sans-serif`;

      ctx.font = heroFont;
      const heroW = ctx.measureText(heroVal).width;
      ctx.font = subFont;
      const subW = subText ? ctx.measureText(subText).width + Math.round(48 * scale) : 0;
      ctx.font = titleFont;
      const tW = title ? ctx.measureText(title.toUpperCase()).width + Math.round(90 * scale) : 0;

      const boxW = Math.max(heroW, subW, tW, Math.round(260 * scale));
      const boxH = Math.round((title ? 38 : 0) + 104 + (subText ? 54 : 0)) * scale;
      const { x: startX, y: startY } = resolveOverlayOrigin(surfaceW, surfaceH, boxW, boxH, padX, padY);

      let curY = startY;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctx.shadowBlur = 16 * scale;
      ctx.shadowOffsetY = 3 * scale;

      if (title) {
        ctx.font = titleFont;
        const labelStr = title.toUpperCase();
        const lw = ctx.measureText(labelStr).width;
        const totalHeaderW = lw + Math.round(84 * scale);
        const hx = startX + (boxW - totalHeaderW) / 2;
        const { bw } = drawStravaBadgePill(ctx, hx, curY, scale);
        ctx.font = titleFont;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillText(labelStr, hx + bw + Math.round(10 * scale), curY + Math.round(1 * scale));
        curY += Math.round(38 * scale);
      }

      ctx.font = heroFont;
      ctx.fillStyle = '#FFFFFF';
      const hx = startX + (boxW - heroW) / 2;
      ctx.fillText(heroVal, hx, curY);
      curY += Math.round(102 * scale);

      if (subText) {
        const pillW = subW;
        const pillH = Math.round(46 * scale);
        const px = startX + (boxW - pillW) / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 14 * scale;
        drawRoundedRect(ctx, px, curY, pillW, pillH, pillH / 2);
        ctx.fillStyle = 'rgba(15, 15, 22, 0.78)';
        ctx.fill();
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.strokeStyle = 'rgba(252, 76, 2, 0.65)';
        ctx.stroke();
        ctx.restore();

        ctx.font = subFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(subText, px + Math.round(24 * scale), curY + pillH / 2 + 1);
      }

      ctx.restore();
      return { x: startX, y: startY, w: boxW, h: boxH };
    }

    // --- DESIGNS C, D, E: HORIZONTAL COLUMNS ('strava-classic', 'glass-dark', 'minimal-white') ---
    const titleFont = `700 ${Math.round(28 * scale)}px "Space Grotesk", "Inter", sans-serif`;
    const labelFont = `600 ${Math.round(18 * scale)}px "Inter", sans-serif`;
    const valueFont = `800 ${Math.round(50 * scale)}px "Space Grotesk", "Inter", sans-serif`;

    const colGap = Math.round(44 * scale);

    let totalColsW = 0;
    const measuredCols = metrics.map((m) => {
      ctx.font = labelFont;
      const lw = ctx.measureText(m.label).width;
      ctx.font = valueFont;
      const vw = ctx.measureText(m.value).width;
      const colW = Math.max(lw, vw);
      totalColsW += colW;
      return { ...m, colW };
    });
    if (measuredCols.length > 1) {
      totalColsW += colGap * (measuredCols.length - 1);
    }

    ctx.font = titleFont;
    const titleW = title ? ctx.measureText(title).width + Math.round(90 * scale) : 0;
    const contentW = Math.max(totalColsW, titleW, Math.round(220 * scale));

    const hasTitleRow = Boolean(title || stravaStyle !== 'minimal-white');
    const titleRowH = hasTitleRow ? Math.round(42 * scale) : 0;
    const metricsRowH = measuredCols.length > 0 ? Math.round(80 * scale) : 0;
    const contentH = titleRowH + metricsRowH;

    const cardPadX = stravaStyle === 'glass-dark' ? Math.round(34 * scale) : 0;
    const cardPadY = stravaStyle === 'glass-dark' ? Math.round(26 * scale) : 0;
    const leftBarOffset = stravaStyle === 'strava-classic' ? Math.round(22 * scale) : 0;
    const boxW = contentW + cardPadX * 2 + leftBarOffset;
    const boxH = contentH + cardPadY * 2;

    const { x: startX, y: startY } = resolveOverlayOrigin(surfaceW, surfaceH, boxW, boxH, padX, padY);

    if (stravaStyle === 'glass-dark') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 26 * scale;
      ctx.shadowOffsetY = 8 * scale;
      drawRoundedRect(ctx, startX, startY, boxW, boxH, Math.round(22 * scale));
      ctx.fillStyle = 'rgba(12, 12, 18, 0.82)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();
      ctx.restore();
    }

    let innerX = startX + cardPadX;
    let innerY = startY + cardPadY;

    if (stravaStyle === 'strava-classic') {
      const barW = Math.round(6 * scale);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 12 * scale;
      drawRoundedRect(ctx, innerX, innerY, barW, contentH, barW / 2);
      ctx.fillStyle = '#FC4C02';
      ctx.fill();
      ctx.restore();
      innerX += leftBarOffset;
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
    ctx.shadowBlur = 14 * scale;
    ctx.shadowOffsetY = 2 * scale;

    if (hasTitleRow) {
      let curTitleX = innerX;
      if (isCenteredAlign && stravaStyle !== 'strava-classic') {
        ctx.font = titleFont;
        const tWidth = title ? ctx.measureText(title).width : 0;
        const badgeWidth = stravaStyle !== 'minimal-white' ? Math.round(82 * scale) : 0;
        curTitleX = innerX + Math.max(0, (contentW - (tWidth + badgeWidth)) / 2);
      }

      if (stravaStyle !== 'minimal-white') {
        const { bw } = drawStravaBadgePill(ctx, curTitleX, innerY + Math.round(3 * scale), scale);
        curTitleX += bw + Math.round(10 * scale);
      }

      if (title) {
        ctx.font = titleFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(title, curTitleX, innerY);
      }
      innerY += titleRowH;
    }

    if (measuredCols.length > 0) {
      let colX = innerX;
      if (isCenteredAlign && stravaStyle !== 'strava-classic') {
        colX = innerX + (contentW - totalColsW) / 2;
      }

      measuredCols.forEach((col, idx) => {
        ctx.font = labelFont;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(col.label, colX, innerY);

        ctx.font = valueFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(col.value, colX, innerY + Math.round(22 * scale));

        if (stravaStyle === 'minimal-white' && idx < measuredCols.length - 1) {
          const divX = colX + col.colW + colGap / 2;
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = Math.max(1, 1.5 * scale);
          ctx.beginPath();
          ctx.moveTo(divX, innerY + Math.round(6 * scale));
          ctx.lineTo(divX, innerY + Math.round(66 * scale));
          ctx.stroke();
          ctx.restore();
        }

        colX += col.colW + colGap;
      });
    }

    ctx.restore();
    return { x: startX, y: startY, w: boxW, h: boxH };
  }

  // --- Render Both Live Top Preview Overlay & Split Export Canvases ---
  function renderPreviewOverlay() {
    const info = getCropAndDimensions();
    if (!info) return;

    const { panelW, panelH } = info;
    const totalW = panelCount * panelW;
    const totalH = panelH;

    if (previewOverlayCanvas.width !== totalW) previewOverlayCanvas.width = totalW;
    if (previewOverlayCanvas.height !== totalH) previewOverlayCanvas.height = totalH;

    const pCtx = previewOverlayCanvas.getContext('2d');
    pCtx.clearRect(0, 0, totalW, totalH);

    if (!hasStravaOverlay()) {
      lastPreviewOverlayBox = null;
      return;
    }

    let box = null;
    if (panelCount === 1 || stravaTarget === 'first') {
      box = drawStravaOverlayOnSurface(pCtx, panelW, panelH, panelW);
      if (box) {
        lastPreviewOverlayBox = { ...box, offsetX: 0, surfaceW: panelW, surfaceH: panelH, totalW, totalH };
      }
    } else if (stravaTarget === 'last') {
      const offsetX = (panelCount - 1) * panelW;
      pCtx.save();
      pCtx.translate(offsetX, 0);
      box = drawStravaOverlayOnSurface(pCtx, panelW, panelH, panelW);
      pCtx.restore();
      if (box) {
        lastPreviewOverlayBox = { ...box, offsetX, surfaceW: panelW, surfaceH: panelH, totalW, totalH };
      }
    } else {
      box = drawStravaOverlayOnSurface(pCtx, totalW, totalH, panelW);
      if (box) {
        lastPreviewOverlayBox = { ...box, offsetX: 0, surfaceW: totalW, surfaceH: totalH, totalW, totalH };
      }
    }
  }

  function renderSplitPanels() {
    const info = getCropAndDimensions();
    if (!info) return;

    const { sx, sy, sw, sh, panelW, panelH } = info;
    const sliceSourceWidth = sw / panelCount;
    const showOverlay = hasStravaOverlay();

    for (let i = 0; i < panelCount; i++) {
      const canvas = panelCanvases[i];
      if (!canvas) continue;

      if (canvas.width !== panelW) canvas.width = panelW;
      if (canvas.height !== panelH) canvas.height = panelH;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, panelW, panelH);

      ctx.drawImage(
        sourceImage,
        sx + i * sliceSourceWidth,
        sy,
        sliceSourceWidth,
        sh,
        0,
        0,
        panelW,
        panelH
      );

      if (showOverlay) {
        if (panelCount === 1 || (stravaTarget === 'first' && i === 0)) {
          drawStravaOverlayOnSurface(ctx, panelW, panelH, panelW);
        } else if (stravaTarget === 'last' && i === panelCount - 1) {
          drawStravaOverlayOnSurface(ctx, panelW, panelH, panelW);
        } else if (stravaTarget === 'all') {
          ctx.save();
          ctx.translate(-i * panelW, 0);
          drawStravaOverlayOnSurface(ctx, panelCount * panelW, panelH, panelW);
          ctx.restore();
        }
      }
    }

    updateExportBadges();
  }

  function renderAll() {
    updateCropOverlay();
    renderPreviewOverlay();
    renderSplitPanels();
  }

  // --- File Loading ---
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Selecciona un archivo de imagen válido');
      return;
    }

    originalFileName = file.name.replace(/\.[^.]+$/, '') || 'splitgram';

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        cropOffsetX = 0.5;
        cropOffsetY = 0.5;
        showEditor(file.name, img.naturalWidth, img.naturalHeight);
      };
      img.onerror = () => {
        showToast('No se pudo abrir este formato de imagen');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showEditor(name, w, h) {
    fileNameEl.textContent = name;
    imageSizeEl.textContent = `${w} × ${h} px`;

    buildSplitLines();
    buildPanelCards();

    originalImg.onload = () => {
      originalImg.classList.add('loaded');
      renderAll();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => renderAll());
      }
    };
    originalImg.src = sourceImage.src;

    uploadSection.style.display = 'none';
    editorSection.classList.remove('hidden');
  }

  // --- Unified Interactive Drag (Move Strava Overlay OR Pan Photo Crop!) ---
  function getPointerCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function hitTestStravaOverlay(clientX, clientY) {
    if (!hasStravaOverlay() || !lastPreviewOverlayBox) return false;
    const rect = previewOverlayCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return false;

    const canvasX = relX * lastPreviewOverlayBox.totalW;
    const canvasY = relY * lastPreviewOverlayBox.totalH;

    const hitPad = 24;
    const bx = lastPreviewOverlayBox.offsetX + lastPreviewOverlayBox.x - hitPad;
    const by = lastPreviewOverlayBox.y - hitPad;
    const bw = lastPreviewOverlayBox.w + hitPad * 2;
    const bh = lastPreviewOverlayBox.h + hitPad * 2;

    return canvasX >= bx && canvasX <= bx + bw && canvasY >= by && canvasY <= by + bh;
  }

  function onDragStart(e) {
    if (!sourceImage) return;
    const coords = getPointerCoords(e);
    const clickedHandle = e.target.closest('#panHandle');

    // Check if the user touched/clicked directly on the Strava Overlay
    if (!clickedHandle && hitTestStravaOverlay(coords.x, coords.y)) {
      dragMode = 'overlay';
      dragStartCoord = coords;
      dragStartOverlayPos = {
        x: lastPreviewOverlayBox.x,
        y: lastPreviewOverlayBox.y
      };
      originalPreview.classList.add('dragging');
      if (e.cancelable) e.preventDefault();
      return;
    }

    // Otherwise pan the photo crop
    if (panAxis === 'none') return;
    dragMode = 'crop';
    dragStartCoord = coords;
    dragStartOffset = panAxis === 'horizontal' ? cropOffsetX : cropOffsetY;
    originalPreview.classList.add('dragging');
    if (e.type === 'mousedown' && e.cancelable) e.preventDefault();
  }

  function onDragMove(e) {
    if (dragMode === 'none' || !sourceImage) return;

    const coords = getPointerCoords(e);

    if (dragMode === 'overlay' && lastPreviewOverlayBox) {
      const rect = previewOverlayCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const scaleX = lastPreviewOverlayBox.totalW / rect.width;
      const scaleY = lastPreviewOverlayBox.totalH / rect.height;

      const deltaCanvasX = (coords.x - dragStartCoord.x) * scaleX;
      const deltaCanvasY = (coords.y - dragStartCoord.y) * scaleY;

      const newX = dragStartOverlayPos.x + deltaCanvasX;
      const newY = dragStartOverlayPos.y + deltaCanvasY;

      customOverlayPos = {
        xRatio: Math.max(0, Math.min(1, newX / lastPreviewOverlayBox.surfaceW)),
        yRatio: Math.max(0, Math.min(1, newY / lastPreviewOverlayBox.surfaceH))
      };

      stravaPosSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          renderPreviewOverlay();
          renderSplitPanels();
          rafPending = false;
        });
      }
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (dragMode === 'crop') {
      const info = getCropAndDimensions();
      if (!info) return;

      if (panAxis === 'horizontal') {
        const deltaX = coords.x - dragStartCoord.x;
        const previewWidth = originalPreview.offsetWidth;
        const usedWidthRatio = info.targetAspect / info.imgAspect;
        const slackPixels = previewWidth * (1 - usedWidthRatio);
        if (slackPixels <= 0) return;

        cropOffsetX = Math.max(0, Math.min(1, dragStartOffset + deltaX / slackPixels));
      } else {
        const deltaY = coords.y - dragStartCoord.y;
        const previewHeight = originalPreview.offsetHeight;
        const usedHeightRatio = info.imgAspect / info.targetAspect;
        const slackPixels = previewHeight * (1 - usedHeightRatio);
        if (slackPixels <= 0) return;

        cropOffsetY = Math.max(0, Math.min(1, dragStartOffset + deltaY / slackPixels));
      }

      updateCropOverlay();

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          renderSplitPanels();
          rafPending = false;
        });
      }

      if (e.cancelable) e.preventDefault();
    }
  }

  function onDragEnd() {
    if (dragMode === 'none') return;
    dragMode = 'none';
    originalPreview.classList.remove('dragging');
    renderAll();
  }

  originalPreview.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  originalPreview.addEventListener('touchstart', onDragStart, { passive: false });
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);

  // --- Downloads & Native iOS Share Sheet ---
  async function downloadSinglePanel(index) {
    const canvas = panelCanvases[index];
    if (!canvas) return;

    const panelNum = index + 1;
    const fileName = `${originalFileName}_panel${panelNum}.${exportExt}`;
    const blob = await canvasToBlob(canvas, exportFormat, 0.95);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast(`¡Imagen ${panelNum} descargada!`);
  }

  async function shareOrDownloadAll() {
    if (!sourceImage || panelCanvases.length === 0) return;

    const files = [];
    for (let i = 0; i < panelCanvases.length; i++) {
      const blob = await canvasToBlob(panelCanvases[i], exportFormat, 0.95);
      const fileName = `${originalFileName}_panel${i + 1}.${exportExt}`;
      files.push(new File([blob], fileName, { type: exportFormat }));
    }

    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({
          files,
          title: 'SplitGram',
          text: `${panelCount} imagen(es) de SplitGram`
        });
        showToast('¡Listo para guardar en Fotos!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      const link = document.createElement('a');
      link.download = files[i].name;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    showToast(`¡${files.length} imagen(es) descargada(s)!`);
  }

  async function downloadZip() {
    if (!sourceImage || panelCanvases.length === 0) return;
    if (typeof JSZip === 'undefined') {
      showToast('Usa el botón Guardar / Compartir');
      return;
    }

    const zip = new JSZip();

    for (let i = 0; i < panelCanvases.length; i++) {
      const blob = await canvasToBlob(panelCanvases[i], exportFormat, 0.95);
      zip.file(`${originalFileName}_panel${i + 1}.${exportExt}`, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.download = `${originalFileName}_splitgram_${panelCount}panels.zip`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    showToast('¡ZIP descargado!');
  }

  // --- Strava Event Listeners (Clipboard API + Native iOS Paste Event) ---
  toggleStravaBtn.addEventListener('click', () => {
    stravaEnabled = !stravaEnabled;
    updateStravaToggleUI();
    renderAll();
  });

  pasteStravaBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            loadStickerBlob(blob);
            return;
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          stravaPasteZone.textContent = text.trim();
          parseStravaText(text);
          showToast('¡Actividad de Strava aplicada!');
          return;
        }
      }
      stravaPasteZone.focus();
      showToast('Mantén presionado el recuadro punteado y toca "Pegar"');
    } catch {
      stravaPasteZone.focus();
      showToast('Toca el recuadro punteado y selecciona "Pegar"');
    }
  });

  // Handle native iOS / Desktop Paste event (supports both Strava PNG stickers and text!)
  function handlePasteEvent(e) {
    const cd = e.clipboardData;
    if (!cd) return;

    // 1. Check for pasted image (e.g. Strava transparent sticker copied from iOS app)
    if (cd.items) {
      for (let i = 0; i < cd.items.length; i++) {
        const item = cd.items[i];
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            stravaPasteZone.textContent = '✓ Sticker PNG de Strava cargado';
            loadStickerBlob(blob);
            return;
          }
        }
      }
    }

    // 2. Check for pasted text
    const text = cd.getData('text/plain');
    if (text && text.trim()) {
      e.preventDefault();
      stravaPasteZone.textContent = text.trim();
      parseStravaText(text);
      showToast('¡Datos de Strava actualizados!');
    }
  }

  stravaPasteZone.addEventListener('paste', handlePasteEvent);
  stravaPasteZone.addEventListener('input', () => {
    parseStravaText(stravaPasteZone.textContent);
  });

  uploadStickerBtn.addEventListener('click', () => stickerInput.click());

  stickerInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    loadStickerBlob(file);
  });

  clearStickerBtn.addEventListener('click', () => {
    stravaStickerImg = null;
    stickerInput.value = '';
    stravaPasteZone.textContent = '';
    clearStickerBtn.classList.add('hidden');
    renderAll();
    showToast('Sticker eliminado');
  });

  [stravaTitleInput, stravaDistInput, stravaPaceInput, stravaTimeInput].forEach((input) => {
    input.addEventListener('input', () => {
      stravaEnabled = true;
      updateStravaToggleUI();
      renderAll();
    });
  });

  stravaStyleSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    stravaStyleSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stravaStyle = btn.dataset.style;
    stravaEnabled = true;
    updateStravaToggleUI();
    renderAll();
  });

  stravaPosSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    stravaPosSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stravaPos = btn.dataset.pos;
    customOverlayPos = null; // Reset custom finger drag to snap to preset
    renderAll();
  });

  stravaScaleInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10) || 100;
    stravaScaleLabel.textContent = `${val}%`;
    stravaScale = val / 100;
    renderAll();
  });

  stravaTargetSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    stravaTargetSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stravaTarget = btn.dataset.target;
    renderAll();
  });

  // --- Core Event Listeners ---
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) loadFile(e.target.files[0]);
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) loadFile(e.dataTransfer.files[0]);
  });

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  changeImageBtn.addEventListener('click', () => {
    sourceImage = null;
    cropOffsetX = 0.5;
    cropOffsetY = 0.5;
    originalImg.classList.remove('loaded');
    originalImg.removeAttribute('src');
    fileInput.value = '';
    uploadSection.style.display = '';
    editorSection.classList.add('hidden');
  });

  panelCountSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;

    panelCountSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    panelCount = parseInt(btn.dataset.panels, 10) || 1;
    cropOffsetX = 0.5;
    cropOffsetY = 0.5;

    buildSplitLines();
    buildPanelCards();
    renderAll();
  });

  ratioSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.ratio-btn');
    if (!btn) return;

    ratioSelector.querySelectorAll('.ratio-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const [w, h] = btn.dataset.ratio.split(':').map(Number);
    currentRatio = { w, h };
    cropOffsetX = 0.5;
    cropOffsetY = 0.5;

    renderAll();
  });

  formatSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;

    formatSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    exportFormat = btn.dataset.format;
    exportExt = btn.dataset.ext;
    updateExportBadges();
  });

  resolutionSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;

    resolutionSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    resolutionMode = btn.dataset.res;
    renderAll();
  });

  shareBtn.addEventListener('click', shareOrDownloadAll);
  zipBtn.addEventListener('click', downloadZip);

  // iPhone Install Modal
  if (isStandalonePWA()) {
    iosInstallBtn.classList.add('hidden');
  }

  iosInstallBtn.addEventListener('click', () => {
    iosModal.classList.remove('hidden');
  });

  closeIosModal.addEventListener('click', () => {
    iosModal.classList.add('hidden');
  });

  iosModal.addEventListener('click', (e) => {
    if (e.target === iosModal) iosModal.classList.add('hidden');
  });

  // --- Init ---
  if (!supportsFileShare()) {
    shareBtnText.textContent = 'Descargar imagen(es)';
  }
  updateExportBadges();
})();
