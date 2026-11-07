/* ============================================
   SplitGram — App Logic (Desktop, iPhone PWA & Strava Overlay)
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
  const pasteStravaBtn = document.getElementById('pasteStravaBtn');
  const uploadStickerBtn = document.getElementById('uploadStickerBtn');
  const stickerInput = document.getElementById('stickerInput');
  const clearStravaBtn = document.getElementById('clearStravaBtn');
  const stravaRawInput = document.getElementById('stravaRawInput');
  const stravaTitleInput = document.getElementById('stravaTitleInput');
  const stravaDistInput = document.getElementById('stravaDistInput');
  const stravaPaceInput = document.getElementById('stravaPaceInput');
  const stravaTimeInput = document.getElementById('stravaTimeInput');
  const stravaStyleSelector = document.getElementById('stravaStyleSelector');
  const stravaPosSelector = document.getElementById('stravaPosSelector');
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
  let panelCount = 2;
  let currentRatio = { w: 4, h: 5 };
  let exportFormat = 'image/jpeg';
  let exportExt = 'jpg';
  let resolutionMode = '1080'; // '1080' or 'max'

  // Strava Overlay State
  let stravaStyle = 'strava-classic'; // 'strava-classic' | 'glass-dark' | 'minimal-white'
  let stravaPos = 'bottom-left'; // 'bottom-left' | 'bottom-center' | 'top-left' | 'center'
  let stravaTarget = 'first'; // 'first' | 'last' | 'all'
  let stravaStickerImg = null;

  // Crop offsets: 0 = top/left, 0.5 = center, 1 = bottom/right
  let cropOffsetX = 0.5;
  let cropOffsetY = 0.5;
  let panAxis = 'none'; // 'vertical' | 'horizontal' | 'none'

  let isDragging = false;
  let dragStartCoord = 0;
  let dragStartOffset = 0.5;
  let rafPending = false;

  let panelCanvases = [];
  let toastTimeout = null;

  // --- Helpers ---
  function showToast(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastText.textContent = msg;
    toast.classList.add('visible');
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2500);
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
    return Boolean(
      stravaStickerImg ||
      stravaTitleInput.value.trim() ||
      stravaDistInput.value.trim() ||
      stravaPaceInput.value.trim() ||
      stravaTimeInput.value.trim()
    );
  }

  function updateClearButtonVisibility() {
    if (hasStravaOverlay() || stravaRawInput.value.trim()) {
      clearStravaBtn.classList.remove('hidden');
    } else {
      clearStravaBtn.classList.add('hidden');
    }
  }

  // --- Smart Strava / Garmin Text Parser ---
  function parseStravaText(raw) {
    const text = (raw || '').trim();
    if (!text) return;

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

    // 5. Extract Title from remaining text (cleaning labels & URLs)
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

    // If user pasted a free-form string with no recognizable numbers at all, set it as title
    if (!dist && !pace && !combinedTime && !cleanTitle && text) {
      stravaTitleInput.value = text.slice(0, 40);
    }

    updateClearButtonVisibility();
    renderSplitPanels();
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
      panelW = 1080;
      panelH = Math.round(1080 * (currentRatio.h / currentRatio.w));
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

      let labelPos = `Slide ${panelNum} of ${panelCount}`;
      if (panelCount === 1) {
        labelPos = 'Single Photo';
      } else if (panelCount === 2) {
        labelPos = i === 0 ? 'Left panel' : 'Right panel';
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
          <span class="panel-dims" data-dims="${i}">1080 × 1350</span>
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
      exportDimsBadge.textContent = `1080 × 1350 px · ${extUpper}`;
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

    if (Math.abs(imgAspect - targetAspect) < 0.002) {
      panAxis = 'none';
      cropTop.style.height = '0%';
      cropBottom.style.height = '0%';
      cropLeft.style.width = '0%';
      cropRight.style.width = '0%';

      panHandle.classList.add('hidden');
      panHandle.classList.remove('mode-vertical', 'mode-horizontal');
      originalPreview.classList.remove('pannable');

      lines.forEach((line, idx) => {
        const pct = ((idx + 1) / panelCount) * 100;
        line.style.left = `${pct}%`;
        line.style.top = '0%';
        line.style.bottom = '0%';
      });

      previewCaption.innerHTML =
        'Exact aspect ratio match — the entire photo is preserved.';
    } else if (imgAspect > targetAspect) {
      panAxis = 'horizontal';
      const usedWidthRatio = targetAspect / imgAspect;
      const totalCropPercent = (1 - usedWidthRatio) * 100;
      const leftPercent = cropOffsetX * totalCropPercent;
      const rightPercent = (1 - cropOffsetX) * totalCropPercent;
      const visiblePercent = 100 - totalCropPercent;

      cropTop.style.height = '0%';
      cropBottom.style.height = '0%';
      cropLeft.style.width = `${leftPercent}%`;
      cropRight.style.width = `${rightPercent}%`;

      lines.forEach((line, idx) => {
        const pct = leftPercent + visiblePercent * ((idx + 1) / panelCount);
        line.style.left = `${pct}%`;
        line.style.top = '0%';
        line.style.bottom = '0%';
      });

      panHandle.style.left = `${leftPercent + visiblePercent / 2}%`;
      panHandle.style.top = '50%';
      panHandle.classList.remove('hidden', 'mode-vertical');
      panHandle.classList.add('mode-horizontal');
      originalPreview.classList.add('pannable');

      previewCaption.innerHTML =
        'Drag the photo or purple handle <strong>left/right ↔</strong> to adjust which horizontal area is kept.';
    } else {
      panAxis = 'vertical';
      const usedHeightRatio = imgAspect / targetAspect;
      const totalCropPercent = (1 - usedHeightRatio) * 100;
      const topPercent = cropOffsetY * totalCropPercent;
      const bottomPercent = (1 - cropOffsetY) * totalCropPercent;
      const visiblePercent = 100 - totalCropPercent;

      cropLeft.style.width = '0%';
      cropRight.style.width = '0%';
      cropTop.style.height = `${topPercent}%`;
      cropBottom.style.height = `${bottomPercent}%`;

      lines.forEach((line, idx) => {
        const pct = ((idx + 1) / panelCount) * 100;
        line.style.left = `${pct}%`;
        line.style.top = `${topPercent}%`;
        line.style.bottom = `${bottomPercent}%`;
      });

      panHandle.style.left = '50%';
      panHandle.style.top = `${topPercent + visiblePercent / 2}%`;
      panHandle.classList.remove('hidden', 'mode-horizontal');
      panHandle.classList.add('mode-vertical');
      originalPreview.classList.add('pannable');

      previewCaption.innerHTML =
        'Drag the photo or purple handle <strong>up/down ↕</strong> to adjust which vertical area is kept.';
    }
  }

  // --- Strava Canvas Drawing Engine ---
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

  function drawStravaOverlayOnSurface(ctx, surfaceW, surfaceH, scaleBaseW) {
    const scale = scaleBaseW / 1080;
    const padX = Math.round(64 * scale);
    const padY = Math.round(72 * scale);

    // 1. If a transparent PNG sticker is loaded, draw it
    if (stravaStickerImg) {
      const maxStickerW = surfaceW * 0.55;
      const maxStickerH = surfaceH * 0.45;
      const ratio = Math.min(
        maxStickerW / stravaStickerImg.naturalWidth,
        maxStickerH / stravaStickerImg.naturalHeight
      );
      const sw = Math.round(stravaStickerImg.naturalWidth * ratio);
      const sh = Math.round(stravaStickerImg.naturalHeight * ratio);

      let x = padX;
      let y = surfaceH - padY - sh;
      if (stravaPos === 'bottom-center') {
        x = (surfaceW - sw) / 2;
        y = surfaceH - padY - sh;
      } else if (stravaPos === 'top-left') {
        x = padX;
        y = padY;
      } else if (stravaPos === 'center') {
        x = (surfaceW - sw) / 2;
        y = (surfaceH - sh) / 2;
      }

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 18 * scale;
      ctx.shadowOffsetY = 4 * scale;
      ctx.drawImage(stravaStickerImg, x, y, sw, sh);
      ctx.restore();
    }

    // 2. Draw text metrics if any field is filled
    const title = stravaTitleInput.value.trim();
    const dist = stravaDistInput.value.trim();
    const pace = stravaPaceInput.value.trim();
    const time = stravaTimeInput.value.trim();

    const metrics = [];
    if (dist) metrics.push({ label: 'DISTANCE', value: dist });
    if (pace) metrics.push({ label: 'PACE', value: pace });
    if (time) {
      const label = time.includes('+') ? 'TIME / ELEV' : 'TIME';
      metrics.push({ label, value: time });
    }

    if (!title && metrics.length === 0) return;

    ctx.save();

    const titleFont = `700 ${Math.round(30 * scale)}px "Space Grotesk", "Inter", sans-serif`;
    const labelFont = `600 ${Math.round(19 * scale)}px "Inter", sans-serif`;
    const valueFont = `800 ${Math.round(52 * scale)}px "Space Grotesk", "Inter", sans-serif`;
    const brandFont = `800 ${Math.round(18 * scale)}px "Inter", sans-serif`;

    const colGap = Math.round(48 * scale);

    // Measure columns
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

    const hasTitleRow = Boolean(title || stravaStyle === 'strava-classic');
    const titleRowH = hasTitleRow ? Math.round(44 * scale) : 0;
    const metricsRowH = measuredCols.length > 0 ? Math.round(82 * scale) : 0;
    const contentH = titleRowH + metricsRowH;

    const cardPadX = stravaStyle === 'glass-dark' ? Math.round(36 * scale) : 0;
    const cardPadY = stravaStyle === 'glass-dark' ? Math.round(28 * scale) : 0;
    const boxW = contentW + cardPadX * 2 + (stravaStyle === 'strava-classic' ? Math.round(22 * scale) : 0);
    const boxH = contentH + cardPadY * 2;

    let startX = padX;
    let startY = surfaceH - padY - boxH;
    const isCentered = stravaPos === 'bottom-center' || stravaPos === 'center';

    if (stravaPos === 'bottom-center') {
      startX = (surfaceW - boxW) / 2;
      startY = surfaceH - padY - boxH;
    } else if (stravaPos === 'top-left') {
      startX = padX;
      startY = padY;
    } else if (stravaPos === 'center') {
      startX = (surfaceW - boxW) / 2;
      startY = (surfaceH - boxH) / 2;
    }

    // Background / Accent
    if (stravaStyle === 'glass-dark') {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 28 * scale;
      ctx.shadowOffsetY = 8 * scale;
      drawRoundedRect(ctx, startX, startY, boxW, boxH, Math.round(22 * scale));
      ctx.fillStyle = 'rgba(12, 12, 18, 0.78)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();
      ctx.restore();
    }

    let innerX = startX + cardPadX;
    let innerY = startY + cardPadY;

    if (stravaStyle === 'strava-classic') {
      // Draw signature Strava orange vertical bar on the left
      const barW = Math.round(7 * scale);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 12 * scale;
      drawRoundedRect(ctx, innerX, innerY, barW, contentH, barW / 2);
      ctx.fillStyle = '#FC4C02';
      ctx.fill();
      ctx.restore();
      innerX += Math.round(22 * scale);
    }

    // Text drop shadow for legibility on outdoor photos
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 14 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.textBaseline = 'top';

    // Title Row
    if (hasTitleRow) {
      let curTitleX = innerX;
      if (isCentered && stravaStyle !== 'strava-classic') {
        const fullTitleText = title || 'STRAVA ACTIVITY';
        ctx.font = titleFont;
        curTitleX = innerX + (contentW - ctx.measureText(fullTitleText).width) / 2;
      }

      if (stravaStyle !== 'minimal-white') {
        // Draw small orange Strava pill
        ctx.font = brandFont;
        const badgeText = 'STRAVA';
        const bw = ctx.measureText(badgeText).width + Math.round(16 * scale);
        const bh = Math.round(26 * scale);
        ctx.save();
        ctx.shadowColor = 'transparent';
        drawRoundedRect(ctx, curTitleX, innerY + Math.round(3 * scale), bw, bh, Math.round(6 * scale));
        ctx.fillStyle = '#FC4C02';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(badgeText, curTitleX + Math.round(8 * scale), innerY + Math.round(7 * scale));
        ctx.restore();
        curTitleX += bw + Math.round(12 * scale);
      }

      if (title) {
        ctx.font = titleFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(title, curTitleX, innerY);
      }
      innerY += titleRowH;
    }

    // Metrics Row
    if (measuredCols.length > 0) {
      let colX = innerX;
      if (isCentered && stravaStyle !== 'strava-classic') {
        colX = innerX + (contentW - totalColsW) / 2;
      }

      measuredCols.forEach((col) => {
        ctx.font = labelFont;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.fillText(col.label, colX, innerY);

        ctx.font = valueFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(col.value, colX, innerY + Math.round(24 * scale));

        colX += col.colW + colGap;
      });
    }

    ctx.restore();
  }

  // --- Splitting Logic (Automatic & Live) ---
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

  // --- File Loading ---
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image file');
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
        showToast('Could not decode this image format');
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
      updateCropOverlay();
      renderSplitPanels();
    };
    originalImg.src = sourceImage.src;

    uploadSection.style.display = 'none';
    editorSection.classList.remove('hidden');
  }

  // --- 2D Pan / Drag Interaction (Vertical & Horizontal) ---
  function getPointerCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onDragStart(e) {
    if (panAxis === 'none' || !sourceImage) return;

    isDragging = true;
    const coords = getPointerCoords(e);
    if (panAxis === 'horizontal') {
      dragStartCoord = coords.x;
      dragStartOffset = cropOffsetX;
    } else {
      dragStartCoord = coords.y;
      dragStartOffset = cropOffsetY;
    }

    originalPreview.classList.add('dragging');
    if (e.type === 'mousedown') e.preventDefault();
  }

  function onDragMove(e) {
    if (!isDragging || panAxis === 'none' || !sourceImage) return;

    const coords = getPointerCoords(e);
    const info = getCropAndDimensions();
    if (!info) return;

    if (panAxis === 'horizontal') {
      const deltaX = coords.x - dragStartCoord;
      const previewWidth = originalPreview.offsetWidth;
      const usedWidthRatio = info.targetAspect / info.imgAspect;
      const slackPixels = previewWidth * (1 - usedWidthRatio);
      if (slackPixels <= 0) return;

      cropOffsetX = Math.max(0, Math.min(1, dragStartOffset + deltaX / slackPixels));
    } else {
      const deltaY = coords.y - dragStartCoord;
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

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    originalPreview.classList.remove('dragging');
    renderSplitPanels();
  }

  originalPreview.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  originalPreview.addEventListener('touchstart', onDragStart, { passive: true });
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

    showToast(`Panel ${panelNum} downloaded!`);
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
          text: `${panelCount} photo(s) from SplitGram`
        });
        showToast('Ready in Share Sheet!');
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
    showToast(`Downloaded ${files.length} panel(s)!`);
  }

  async function downloadZip() {
    if (!sourceImage || panelCanvases.length === 0) return;
    if (typeof JSZip === 'undefined') {
      showToast('ZIP library unavailable offline — use Share/Download button');
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

    showToast('ZIP downloaded!');
  }

  // --- Strava Event Listeners ---
  pasteStravaBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              stravaStickerImg = img;
              updateClearButtonVisibility();
              renderSplitPanels();
              showToast('Strava sticker pasted onto photo!');
            };
            img.src = url;
            return;
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          stravaRawInput.value = text.trim();
          parseStravaText(text);
          showToast('Strava activity pasted!');
          return;
        }
      }
      stravaRawInput.focus();
      showToast('Long-press the text box to paste your activity');
    } catch {
      stravaRawInput.focus();
      showToast('Paste your Strava text directly into the box below');
    }
  });

  uploadStickerBtn.addEventListener('click', () => stickerInput.click());

  stickerInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        stravaStickerImg = img;
        updateClearButtonVisibility();
        renderSplitPanels();
        showToast('Strava sticker added!');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  clearStravaBtn.addEventListener('click', () => {
    stravaRawInput.value = '';
    stravaTitleInput.value = '';
    stravaDistInput.value = '';
    stravaPaceInput.value = '';
    stravaTimeInput.value = '';
    stravaStickerImg = null;
    stickerInput.value = '';
    updateClearButtonVisibility();
    renderSplitPanels();
    showToast('Strava overlay cleared');
  });

  stravaRawInput.addEventListener('input', (e) => {
    parseStravaText(e.target.value);
  });

  [stravaTitleInput, stravaDistInput, stravaPaceInput, stravaTimeInput].forEach((input) => {
    input.addEventListener('input', () => {
      updateClearButtonVisibility();
      renderSplitPanels();
    });
  });

  stravaStyleSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    stravaStyleSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stravaStyle = btn.dataset.style;
    renderSplitPanels();
  });

  stravaPosSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    stravaPosSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stravaPos = btn.dataset.pos;
    renderSplitPanels();
  });

  stravaTargetSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    stravaTargetSelector.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stravaTarget = btn.dataset.target;
    renderSplitPanels();
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

    panelCount = parseInt(btn.dataset.panels, 10) || 2;
    cropOffsetX = 0.5;
    cropOffsetY = 0.5;

    buildSplitLines();
    buildPanelCards();
    updateCropOverlay();
    renderSplitPanels();
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

    updateCropOverlay();
    renderSplitPanels();
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
    renderSplitPanels();
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
    shareBtnText.textContent = 'Download All Panels';
  }
  updateExportBadges();
})();
