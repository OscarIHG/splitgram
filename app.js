/* ============================================
   SplitGram — App Logic
   ============================================ */

(() => {
  'use strict';

  // --- DOM Elements ---
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const uploadSection = document.getElementById('uploadSection');
  const editorSection = document.getElementById('editorSection');
  const originalPreview = document.getElementById('originalPreview');
  const splitLine = document.getElementById('splitLine');
  const splitHandle = document.querySelector('.split-line-handle');
  const fileNameEl = document.getElementById('fileName');
  const imageSizeEl = document.getElementById('imageSize');
  const changeImageBtn = document.getElementById('changeImageBtn');
  const ratioSelector = document.getElementById('ratioSelector');
  const exportDimsBadge = document.getElementById('exportDimsBadge');
  const canvas1 = document.getElementById('canvas1');
  const canvas2 = document.getElementById('canvas2');
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');
  const splitBtn = document.getElementById('splitBtn');
  const zipBtn = document.getElementById('zipBtn');
  const downloadBtn1 = document.getElementById('downloadBtn1');
  const downloadBtn2 = document.getElementById('downloadBtn2');
  const panel1Dims = document.getElementById('panel1Dims');
  const panel2Dims = document.getElementById('panel2Dims');
  const cropTop = document.getElementById('cropTop');
  const cropBottom = document.getElementById('cropBottom');
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');

  // --- State ---
  let sourceImage = null;
  let currentRatio = { w: 4, h: 5 };
  let hasSplit = false;
  let originalFileName = 'image';

  // Vertical pan: 0 = top, 0.5 = center, 1 = bottom
  let cropOffset = 0.5;
  let isDragging = false;
  let dragStartY = 0;
  let dragStartOffset = 0;
  let canPanVertically = false;

  // --- Helpers ---
  function showToast(msg) {
    toastText.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  function updateExportBadge() {
    if (!sourceImage) {
      exportDimsBadge.textContent = '... × ... px per panel';
      panel1Dims.textContent = '... × ...';
      panel2Dims.textContent = '... × ...';
      return;
    }

    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;
    const targetAspect = (2 * currentRatio.w) / currentRatio.h;
    const imgAspect = imgW / imgH;

    let panelW, panelH;

    if (imgAspect > targetAspect) {
      panelH = imgH;
      panelW = imgH * (currentRatio.w / currentRatio.h);
    } else {
      panelW = imgW / 2;
      panelH = panelW * (currentRatio.h / currentRatio.w);
    }

    panelW = Math.round(panelW);
    panelH = Math.round(panelH);

    exportDimsBadge.textContent = `${panelW} × ${panelH} px per panel`;
    panel1Dims.textContent = `${panelW} × ${panelH}`;
    panel2Dims.textContent = `${panelW} × ${panelH}`;
  }

  // --- File Loading ---
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image');
      return;
    }

    originalFileName = file.name.replace(/\.[^.]+$/, '');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        cropOffset = 0.5; // Reset to center
        showEditor(file.name, img.naturalWidth, img.naturalHeight);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showEditor(name, w, h) {
    fileNameEl.textContent = name;
    imageSizeEl.textContent = `${w} × ${h} px`;

    originalImg.src = sourceImage.src;
    originalImg.onload = () => {
      originalImg.classList.add('loaded');
      updateCropOverlay();
    };

    uploadSection.style.display = 'none';
    editorSection.classList.remove('hidden');

    hasSplit = false;
    zipBtn.disabled = true;
    downloadBtn1.disabled = true;
    downloadBtn2.disabled = true;
    canvas1.parentElement.classList.add('empty');
    canvas2.parentElement.classList.add('empty');

    canvas1.width = 0;
    canvas1.height = 0;
    canvas2.width = 0;
    canvas2.height = 0;

    updateExportBadge();
  }

  function updateCropOverlay() {
    if (!sourceImage) return;

    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;

    const targetAspect = (2 * currentRatio.w) / currentRatio.h;
    const imgAspect = imgW / imgH;

    if (imgAspect > targetAspect) {
      // Wider than needed — no vertical crop
      cropTop.style.height = '0px';
      cropBottom.style.height = '0px';
      canPanVertically = false;
      originalPreview.classList.remove('pannable');
    } else {
      // Taller than needed — vertical crop applies
      const usedHeightRatio = (imgW / targetAspect) / imgH;
      const totalCropPercent = (1 - usedHeightRatio) * 100;

      const topPercent = cropOffset * totalCropPercent;
      const bottomPercent = (1 - cropOffset) * totalCropPercent;

      cropTop.style.height = topPercent + '%';
      cropBottom.style.height = bottomPercent + '%';

      // Move the handle to the center of the visible un-cropped area
      const visiblePercent = 100 - totalCropPercent;
      const handleCenterPos = topPercent + (visiblePercent / 2);
      splitHandle.style.top = handleCenterPos + '%';

      canPanVertically = true;
      originalPreview.classList.add('pannable');
    }
  }

  // --- Vertical Pan (Drag) ---
  function getPointerY(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
    return e.clientY;
  }

  function onDragStart(e) {
    if (!canPanVertically) return;

    isDragging = true;
    dragStartY = getPointerY(e);
    dragStartOffset = cropOffset;
    originalPreview.classList.add('dragging');

    if (e.type === 'mousedown') {
      e.preventDefault();
    }
  }

  function onDragMove(e) {
    if (!isDragging || !canPanVertically) return;

    const currentY = getPointerY(e);
    const deltaY = currentY - dragStartY;
    const previewHeight = originalPreview.offsetHeight;

    // How much total "slack" is available (in preview pixels)
    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;
    const targetAspect = (2 * currentRatio.w) / currentRatio.h;
    const usedHeightRatio = (imgW / targetAspect) / imgH;
    const slackPixels = previewHeight * (1 - usedHeightRatio);

    if (slackPixels <= 0) return;

    // Dragging up → selection moves up → offset decreases
    // Dragging down → selection moves down → offset increases
    const offsetDelta = deltaY / slackPixels;
    cropOffset = Math.max(0, Math.min(1, dragStartOffset + offsetDelta));

    updateCropOverlay();

    if (e.cancelable) e.preventDefault();
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    originalPreview.classList.remove('dragging');

    // Re-split if already split
    if (hasSplit) splitImage();
  }

  // Mouse events — drag only from the purple handle
  splitHandle.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  // Touch events — drag only from the purple handle
  splitHandle.addEventListener('touchstart', onDragStart, { passive: true });
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);

  // --- Splitting Logic ---
  function splitImage() {
    if (!sourceImage) return;

    const imgW = sourceImage.naturalWidth;
    const imgH = sourceImage.naturalHeight;
    const targetAspect = (2 * currentRatio.w) / currentRatio.h;
    const imgAspect = imgW / imgH;

    let panelW, panelH;
    let sx, sy, sw, sh;

    if (imgAspect > targetAspect) {
      // Image wider than target — crop sides (centered horizontally)
      sh = imgH;
      sw = imgH * targetAspect;
      sx = (imgW - sw) / 2;
      sy = 0;

      panelH = imgH;
      panelW = imgH * (currentRatio.w / currentRatio.h);
    } else {
      // Image taller than target — crop top/bottom using cropOffset
      sw = imgW;
      sh = imgW / targetAspect;
      sx = 0;
      const totalSlack = imgH - sh;
      sy = cropOffset * totalSlack;

      panelW = imgW / 2;
      panelH = panelW * (currentRatio.h / currentRatio.w);
    }

    panelW = Math.round(panelW);
    panelH = Math.round(panelH);

    // Panel 1: left half
    canvas1.width = panelW;
    canvas1.height = panelH;
    ctx1.drawImage(sourceImage, sx, sy, sw / 2, sh, 0, 0, panelW, panelH);

    // Panel 2: right half
    canvas2.width = panelW;
    canvas2.height = panelH;
    ctx2.drawImage(sourceImage, sx + sw / 2, sy, sw / 2, sh, 0, 0, panelW, panelH);

    canvas1.parentElement.classList.remove('empty');
    canvas2.parentElement.classList.remove('empty');
    hasSplit = true;
    zipBtn.disabled = false;
    downloadBtn1.disabled = false;
    downloadBtn2.disabled = false;

    showToast('Image split successfully!');
  }

  // --- Downloads ---
  function downloadCanvas(canvas, panelNum) {
    const link = document.createElement('a');
    link.download = `${originalFileName}_panel${panelNum}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function downloadZip() {
    if (!hasSplit) return;

    const zip = new JSZip();

    const blob1 = await new Promise(r => canvas1.toBlob(r, 'image/png'));
    const blob2 = await new Promise(r => canvas2.toBlob(r, 'image/png'));

    zip.file(`${originalFileName}_panel1.png`, blob1);
    zip.file(`${originalFileName}_panel2.png`, blob2);

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.download = `${originalFileName}_splitgram.zip`;
    link.href = URL.createObjectURL(content);
    link.click();
    URL.revokeObjectURL(link.href);

    showToast('ZIP downloaded!');
  }

  // --- Event Listeners ---

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
    hasSplit = false;
    cropOffset = 0.5;
    splitHandle.style.top = '50%';
    originalImg.classList.remove('loaded');
    originalImg.src = '';
    fileInput.value = '';
    uploadSection.style.display = '';
    editorSection.classList.add('hidden');
  });

  ratioSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.ratio-btn');
    if (!btn) return;

    ratioSelector.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const ratio = btn.dataset.ratio.split(':');
    currentRatio = { w: parseInt(ratio[0]), h: parseInt(ratio[1]) };

    cropOffset = 0.5; // Reset offset on ratio change
    updateExportBadge();
    updateCropOverlay();

    if (hasSplit) splitImage();
  });

  splitBtn.addEventListener('click', splitImage);
  downloadBtn1.addEventListener('click', () => downloadCanvas(canvas1, 1));
  downloadBtn2.addEventListener('click', () => downloadCanvas(canvas2, 2));
  zipBtn.addEventListener('click', downloadZip);

  // --- Init ---
  updateExportBadge();

})();


/* ============================================
   STICKER MAKER MODULE
   ============================================ */
(() => {
  'use strict';

  // --- DOM Refs ---
  const tabSplitter        = document.getElementById('tabSplitter');
  const tabSticker         = document.getElementById('tabSticker');
  const mainSubtitle       = document.getElementById('mainSubtitle');
  const uploadSection      = document.getElementById('uploadSection');
  const editorSection      = document.getElementById('editorSection');
  const stickerSection     = document.getElementById('stickerSection');
  const stickerUploadZone  = document.getElementById('stickerUploadZone');
  const stickerFileInput   = document.getElementById('stickerFileInput');
  const stickerEditor      = document.getElementById('stickerEditor');
  const stickerUploadSection = document.getElementById('stickerUploadSection');
  const stickerImg         = document.getElementById('stickerImg');
  const stickerFileName    = document.getElementById('stickerFileName');
  const stickerImageSize   = document.getElementById('stickerImageSize');
  const stickerChangeBtn   = document.getElementById('stickerChangeBtn');
  const stickerRatioSelector = document.getElementById('stickerRatioSelector');
  const stickerCreateBtn   = document.getElementById('stickerCreateBtn');
  const stickerDownloadBtn = document.getElementById('stickerDownloadBtn');
  const stickerResult      = document.getElementById('stickerResult');
  const stickerCanvas      = document.getElementById('stickerCanvas');
  const stickerFileSizeBadge = document.getElementById('stickerFileSizeBadge');
  const cropBox            = document.getElementById('cropBox');
  const cropSelection      = document.getElementById('cropSelection');
  const cropMove           = document.getElementById('cropMove');
  const cropContainer      = document.getElementById('stickerCropContainer');
  const toast              = document.getElementById('toast');
  const toastText          = document.getElementById('toastText');

  const overlayTop    = cropBox.querySelector('.crop-box-overlay.top');
  const overlayBottom = cropBox.querySelector('.crop-box-overlay.bottom');
  const overlayLeft   = cropBox.querySelector('.crop-box-overlay.left');
  const overlayRight  = cropBox.querySelector('.crop-box-overlay.right');

  const stickerCtx = stickerCanvas.getContext('2d');

  // --- State ---
  let stickerSource = null;
  let stickerRatio  = '1:1';   // 'free' or 'W:H'
  let stickerBlob   = null;

  // Crop box in % of container dimensions
  let crop = { x: 0, y: 0, w: 100, h: 100 };

  // Drag state
  let drag = null; // { type: 'move'|handle, startX, startY, startCrop }

  // --- Helpers ---
  function showToast(msg) {
    toastText.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // --- Tab Switching ---
  const subtitles = {
    splitter: 'Split your horizontal photo into two perfect panels for Instagram carousels',
    sticker:  'Convert any photo into a WhatsApp sticker — 512\u00d7512 WebP, ready to send'
  };

  tabSplitter.addEventListener('click', () => switchTab('splitter'));
  tabSticker.addEventListener('click',  () => switchTab('sticker'));

  function switchTab(tool) {
    tabSplitter.classList.toggle('active', tool === 'splitter');
    tabSticker.classList.toggle('active',  tool === 'sticker');
    mainSubtitle.textContent = subtitles[tool];

    if (tool === 'splitter') {
      stickerSection.classList.add('hidden');
      uploadSection.style.display   = '';
      editorSection.classList.remove('hidden'); // handled by splitter own logic
      // actually splitter manages its own show/hide, just reveal the section
      uploadSection.style.display   = '';
    } else {
      // Hide splitter
      uploadSection.style.display   = 'none';
      editorSection.classList.add('hidden');
      stickerSection.classList.remove('hidden');
    }
  }

  // --- File Loading ---
  stickerUploadZone.addEventListener('click', () => stickerFileInput.click());
  stickerUploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') stickerFileInput.click(); });
  stickerFileInput.addEventListener('change', e => { if (e.target.files[0]) loadStickerFile(e.target.files[0]); });

  stickerUploadZone.addEventListener('dragover', e => { e.preventDefault(); stickerUploadZone.classList.add('drag-over'); });
  stickerUploadZone.addEventListener('dragleave', () => stickerUploadZone.classList.remove('drag-over'));
  stickerUploadZone.addEventListener('drop', e => {
    e.preventDefault();
    stickerUploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadStickerFile(e.dataTransfer.files[0]);
  });

  function loadStickerFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        stickerSource = img;
        stickerImg.src = e.target.result;
        stickerFileName.textContent = file.name;
        stickerImageSize.textContent = `${img.naturalWidth} \u00d7 ${img.naturalHeight} px`;

        stickerImg.onload = () => {
          initCropBox();
          stickerUploadSection.style.display = 'none';
          stickerEditor.classList.remove('hidden');
          stickerResult.classList.add('hidden');
          stickerDownloadBtn.disabled = true;
          stickerBlob = null;
        };
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  stickerChangeBtn.addEventListener('click', () => {
    stickerSource = null;
    stickerBlob   = null;
    stickerImg.src = '';
    stickerFileInput.value = '';
    stickerUploadSection.style.display = '';
    stickerEditor.classList.add('hidden');
    stickerResult.classList.add('hidden');
    stickerDownloadBtn.disabled = true;
  });

  // --- Crop Box Initialization ---
  function initCropBox() {
    // Start with the largest centered square (or ratio-locked region)
    const cw = cropContainer.offsetWidth;
    const ch = cropContainer.offsetHeight;

    if (stickerRatio === 'free') {
      crop = { x: 10, y: 10, w: 80, h: 80 };
    } else {
      const [rw, rh] = stickerRatio.split(':').map(Number);
      const ratioVal = rw / rh;
      const containerRatio = cw / ch;

      let wPct, hPct;
      if (ratioVal > containerRatio) {
        wPct = 90;
        hPct = (wPct * cw / ch) / ratioVal;
      } else {
        hPct = 90;
        wPct = (hPct * ch / cw) * ratioVal;
      }
      crop = {
        x: (100 - wPct) / 2,
        y: (100 - hPct) / 2,
        w: wPct,
        h: hPct
      };
    }
    applyCrop();
  }

  // --- Apply crop percentages to DOM ---
  function applyCrop() {
    const sel = cropSelection;
    sel.style.left   = crop.x + '%';
    sel.style.top    = crop.y + '%';
    sel.style.width  = crop.w + '%';
    sel.style.height = crop.h + '%';

    // Dark overlays
    overlayTop.style.height    = crop.y + '%';
    overlayBottom.style.height = (100 - crop.y - crop.h) + '%';
    overlayLeft.style.top      = crop.y + '%';
    overlayLeft.style.bottom   = (100 - crop.y - crop.h) + '%';
    overlayLeft.style.width    = crop.x + '%';
    overlayRight.style.top     = crop.y + '%';
    overlayRight.style.bottom  = (100 - crop.y - crop.h) + '%';
    overlayRight.style.width   = (100 - crop.x - crop.w) + '%';
  }

  // --- Drag Logic ---
  function getRelativePos(e) {
    const rect = cropContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width)  * 100,
      y: ((clientY - rect.top)  / rect.height) * 100
    };
  }

  function onDragStart(e, handleType) {
    e.preventDefault();
    const pos = getRelativePos(e);
    drag = {
      type: handleType,
      startX: pos.x,
      startY: pos.y,
      startCrop: { ...crop }
    };
  }

  // Move handle (inside the selection)
  cropMove.addEventListener('mousedown',  e => onDragStart(e, 'move'));
  cropMove.addEventListener('touchstart', e => onDragStart(e, 'move'), { passive: false });

  // Resize handles
  cropSelection.querySelectorAll('.crop-handle').forEach(handle => {
    handle.addEventListener('mousedown',  e => { e.stopPropagation(); onDragStart(e, handle.dataset.handle); });
    handle.addEventListener('touchstart', e => { e.stopPropagation(); onDragStart(e, handle.dataset.handle); }, { passive: false });
  });

  window.addEventListener('mousemove',  onDragMove);
  window.addEventListener('touchmove',  onDragMove, { passive: false });
  window.addEventListener('mouseup',   onDragEnd);
  window.addEventListener('touchend',  onDragEnd);

  function onDragMove(e) {
    if (!drag) return;
    if (e.cancelable) e.preventDefault();

    const pos = getRelativePos(e);
    const dx  = pos.x - drag.startX;
    const dy  = pos.y - drag.startY;
    const sc  = drag.startCrop;

    let { x, y, w, h } = sc;

    const MIN = 5; // Minimum crop size in %

    const [rw, rh] = stickerRatio !== 'free' ? stickerRatio.split(':').map(Number) : [0, 0];
    const cw = cropContainer.offsetWidth;
    const ch = cropContainer.offsetHeight;
    // Aspect ratio of crop in percentage units
    const ratioLocked = stickerRatio !== 'free';

    if (drag.type === 'move') {
      x = clamp(sc.x + dx, 0, 100 - sc.w);
      y = clamp(sc.y + dy, 0, 100 - sc.h);
      w = sc.w; h = sc.h;

    } else {
      // Resize handles
      const type = drag.type;

      if (type.includes('e')) {
        w = clamp(sc.w + dx, MIN, 100 - sc.x);
      }
      if (type.includes('s')) {
        h = clamp(sc.h + dy, MIN, 100 - sc.y);
      }
      if (type.includes('w')) {
        const newW = clamp(sc.w - dx, MIN, sc.x + sc.w);
        x = sc.x + sc.w - newW;
        w = newW;
      }
      if (type.includes('n')) {
        const newH = clamp(sc.h - dy, MIN, sc.y + sc.h);
        y = sc.y + sc.h - newH;
        h = newH;
      }

      // Lock aspect ratio
      if (ratioLocked) {
        // Convert % to pixels for ratio math
        const pixW = (w / 100) * cw;
        const pixH = (h / 100) * ch;
        const targetRatio = rw / rh;
        const currentRatioVal = pixW / pixH;

        if (type.includes('e') || type.includes('w')) {
          // Width was changed → adjust height
          const newPixH = pixW / targetRatio;
          const newH = (newPixH / ch) * 100;
          if (type.includes('n')) {
            y = sc.y + sc.h - newH;
          }
          h = clamp(newH, MIN, 100 - y);
        } else {
          // Height was changed → adjust width
          const newPixW = pixH * targetRatio;
          const newW = (newPixW / cw) * 100;
          if (type.includes('w')) {
            x = sc.x + sc.w - newW;
          }
          w = clamp(newW, MIN, 100 - x);
        }
      }
    }

    crop = { x, y, w, h };
    applyCrop();
  }

  function onDragEnd() {
    drag = null;
  }

  // --- Ratio Selector ---
  stickerRatioSelector.addEventListener('click', e => {
    const btn = e.target.closest('.ratio-btn');
    if (!btn) return;

    stickerRatioSelector.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    stickerRatio = btn.dataset.sratio;

    if (stickerSource) initCropBox();
  });

  // --- Create Sticker ---
  stickerCreateBtn.addEventListener('click', createSticker);

  function createSticker() {
    if (!stickerSource) return;

    const STICKER_SIZE = 512;
    stickerCanvas.width  = STICKER_SIZE;
    stickerCanvas.height = STICKER_SIZE;

    // Clear to transparent
    stickerCtx.clearRect(0, 0, STICKER_SIZE, STICKER_SIZE);

    // Map crop percentages → source image pixels
    const imgW = stickerSource.naturalWidth;
    const imgH = stickerSource.naturalHeight;

    // The img element is displayed with object-fit: contain inside the container
    const containerW = cropContainer.offsetWidth;
    const containerH = cropContainer.offsetHeight;

    // Compute actual rendered image dimensions inside the container
    const imgAspect = imgW / imgH;
    const containerAspect = containerW / containerH;

    let renderedW, renderedH, offsetX, offsetY;
    if (imgAspect > containerAspect) {
      renderedW = containerW;
      renderedH = containerW / imgAspect;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    } else {
      renderedH = containerH;
      renderedW = containerH * imgAspect;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    }

    // Crop box in container pixels
    const cropPxX = (crop.x / 100) * containerW;
    const cropPxY = (crop.y / 100) * containerH;
    const cropPxW = (crop.w / 100) * containerW;
    const cropPxH = (crop.h / 100) * containerH;

    // Clamp crop to rendered image area
    const clampedX = Math.max(cropPxX, offsetX);
    const clampedY = Math.max(cropPxY, offsetY);
    const clampedW = Math.min(cropPxX + cropPxW, offsetX + renderedW) - clampedX;
    const clampedH = Math.min(cropPxY + cropPxH, offsetY + renderedH) - clampedY;

    // Convert back to source image pixels
    const sx = ((clampedX - offsetX) / renderedW) * imgW;
    const sy = ((clampedY - offsetY) / renderedH) * imgH;
    const sw = (clampedW / renderedW) * imgW;
    const sh = (clampedH / renderedH) * imgH;

    // Draw cropped region centered on the 512x512 canvas
    const cropAspect = clampedW / clampedH;
    let destX = 0, destY = 0, destW = STICKER_SIZE, destH = STICKER_SIZE;

    if (stickerRatio === 'free') {
      // Fit into 512x512, centered, with transparent padding
      if (cropAspect > 1) {
        destH = STICKER_SIZE / cropAspect;
        destY = (STICKER_SIZE - destH) / 2;
      } else {
        destW = STICKER_SIZE * cropAspect;
        destX = (STICKER_SIZE - destW) / 2;
      }
    }

    stickerCtx.imageSmoothingEnabled = true;
    stickerCtx.imageSmoothingQuality = 'high';
    stickerCtx.drawImage(stickerSource, sx, sy, sw, sh, destX, destY, destW, destH);

    // Export as WebP blob
    stickerCanvas.toBlob(blob => {
      if (!blob) {
        showToast('WebP export not supported in this browser. Try Chrome or Safari 16+.');
        return;
      }

      stickerBlob = blob;
      const sizeKB = (blob.size / 1024).toFixed(1);
      stickerFileSizeBadge.textContent = `${sizeKB} KB`;

      if (blob.size > 100 * 1024) {
        stickerFileSizeBadge.style.background = 'rgba(239,68,68,0.15)';
        stickerFileSizeBadge.style.color = '#f87171';
        showToast(`File is ${sizeKB} KB — WhatsApp limit is 100 KB. Try a smaller crop.`);
      } else {
        stickerFileSizeBadge.style.background = '';
        stickerFileSizeBadge.style.color = '';
      }

      stickerResult.classList.remove('hidden');
      stickerDownloadBtn.disabled = false;
      showToast('Sticker created!');
    }, 'image/webp', 0.92);
  }

  // --- Download ---
  stickerDownloadBtn.addEventListener('click', () => {
    if (!stickerBlob) return;
    const url = URL.createObjectURL(stickerBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sticker.webp';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Sticker downloaded!');
  });

})();
