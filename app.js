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
