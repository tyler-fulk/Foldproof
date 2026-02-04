/**
 * Export Viewport Module
 * Captures the current 3D viewport as JPG or PDF with optional background and guides
 * Also supports exporting source images with transformations applied
 */

import * as THREE from 'three';
import { getRenderer, getScene, getCamera, getGridHelper } from './scene.js';
import { getGuideGroup } from './guides.js';
import { getImages } from './imageHandler.js';
import { getCurrentSize } from './sizeParser.js';
import { getCurrentOrientation } from './foldCalculator.js';
import { setFoldProgress, getFoldProgress } from './animations.js';

const SCENE_CONFIG = {
    backgroundColor: 0xf0f0f5,
    backgroundColorDark: 0x1a1a2e
};

// DPI for source export to match viewport paper size
const EXPORT_DPI = 300;

/**
 * Initialize export UI and handlers
 */
export function initExport() {
    const screenshotBtn = document.getElementById('screenshot-btn');
    const screenshotDropdown = document.getElementById('screenshot-dropdown');
    const screenshotApply = document.getElementById('screenshot-apply');
    const exportFormat = document.getElementById('export-format');
    const exportBackground = document.getElementById('export-background');
    const exportGrid = document.getElementById('export-grid');
    const exportGuides = document.getElementById('export-guides');
    const exportBtn = document.getElementById('export-btn');

    if (screenshotBtn && screenshotDropdown) {
        screenshotBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            screenshotDropdown.hidden = !screenshotDropdown.hidden;
        });

        screenshotDropdown.addEventListener('click', (e) => e.stopPropagation());

        document.addEventListener('click', (e) => {
            if (!screenshotDropdown.contains(e.target) && !screenshotBtn.contains(e.target)) {
                screenshotDropdown.hidden = true;
            }
        });
    }

    if (screenshotApply) {
        screenshotApply.addEventListener('click', async () => {
            const format = exportFormat?.value || 'jpg';
            const showBackground = exportBackground?.checked ?? true;
            const showGrid = exportGrid?.checked ?? true;
            const showGuides = exportGuides?.checked ?? true;
            
            if (format === 'gif') {
                await captureAnimatedGif({ showBackground, showGrid, showGuides });
            } else {
                await captureAndExport({ format, showBackground, showGrid, showGuides });
            }
            if (screenshotDropdown) screenshotDropdown.hidden = true;
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (screenshotDropdown) screenshotDropdown.hidden = true;
            openSourceExportModal();
        });
    }

    setupSourceExportModal();
}

/**
 * Capture viewport and export
 * @param {Object} options - { format, showBackground, showGrid, showGuides }
 */
async function captureAndExport(options) {
    const { format, showBackground, showGrid, showGuides } = options;
    const renderer = getRenderer();
    const scene = getScene();
    const camera = getCamera();

    if (!renderer || !scene || !camera) return;

    const guideGroup = getGuideGroup();
    const gridHelper = getGridHelper();

    // Store current state
    const origBackground = scene.background ? scene.background.clone() : null;
    const origGuideVisible = guideGroup ? guideGroup.visible : true;
    const origGridVisible = gridHelper ? gridHelper.visible : true;

    // Apply export options
    const isPng = format === 'png';
    if (showBackground) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        scene.background = new THREE.Color(
            isDark ? SCENE_CONFIG.backgroundColorDark : SCENE_CONFIG.backgroundColor
        );
    } else {
        scene.background = isPng ? null : new THREE.Color(0xffffff);
    }

    if (gridHelper) {
        gridHelper.visible = showGrid;
    }

    if (guideGroup) {
        guideGroup.visible = showGuides;
    }

    // Render to ensure latest frame
    renderer.render(scene, camera);

    // Capture canvas
    const canvas = renderer.domElement;
    const mimeType = isPng ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, isPng ? undefined : 0.92);

    // Restore state
    scene.background = origBackground;
    if (guideGroup) {
        guideGroup.visible = origGuideVisible;
    }
    if (gridHelper) {
        gridHelper.visible = origGridVisible;
    }

    // Re-render with restored state
    renderer.render(scene, camera);

    // Export
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const filename = `foldproof-export-${timestamp}`;
    const ext = isPng ? 'png' : 'jpg';

    if (format === 'pdf') {
        try {
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(dataUrl, isPng ? 'PNG' : 'JPEG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${filename}.pdf`);
        } catch (err) {
            console.error('PDF export failed:', err);
            downloadDataUrl(dataUrl, `${filename}.${ext}`);
        }
    } else {
        downloadDataUrl(dataUrl, `${filename}.${ext}`);
    }
}

function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

/**
 * Capture animated GIF of fold animation cycle (-100% to 0% to 100%)
 * @param {Object} options - { showBackground, showGrid, showGuides }
 */
async function captureAnimatedGif(options) {
    const { showBackground, showGrid, showGuides } = options;
    const renderer = getRenderer();
    const scene = getScene();
    const camera = getCamera();

    if (!renderer || !scene || !camera) return;

    const guideGroup = getGuideGroup();
    const gridHelper = getGridHelper();

    // Store current state
    const origBackground = scene.background ? scene.background.clone() : null;
    const origGuideVisible = guideGroup ? guideGroup.visible : true;
    const origGridVisible = gridHelper ? gridHelper.visible : true;
    const origFoldProgress = getFoldProgress();

    // Apply export options
    if (showBackground) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        scene.background = new THREE.Color(
            isDark ? SCENE_CONFIG.backgroundColorDark : SCENE_CONFIG.backgroundColor
        );
    } else {
        scene.background = new THREE.Color(0xffffff);
    }

    if (gridHelper) gridHelper.visible = showGrid;
    if (guideGroup) guideGroup.visible = showGuides;

    const canvas = renderer.domElement;
    const width = canvas.width;
    const height = canvas.height;

    // GIF settings
    const frameCount = 60;
    const frameDelayMs = 50; // ms between frames (~20fps)

    // Show progress indicator
    const progressEl = document.createElement('div');
    progressEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-secondary);color:var(--text-primary);padding:20px 40px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:10000;font-family:inherit;';
    progressEl.innerHTML = '<div style="text-align:center;"><div style="margin-bottom:8px;">Creating GIF...</div><div id="gif-progress">0%</div></div>';
    document.body.appendChild(progressEl);
    const progressText = document.getElementById('gif-progress');

    const cleanup = () => {
        try {
            if (progressEl.parentNode) document.body.removeChild(progressEl);
        } catch (_) {}
        scene.background = origBackground;
        if (guideGroup) guideGroup.visible = origGuideVisible;
        if (gridHelper) gridHelper.visible = origGridVisible;
        setFoldProgress(origFoldProgress, true);
        renderer.render(scene, camera);
    };

    try {
        // Try multiple CDN sources for gifenc
        let gifencModule;
        const cdnUrls = [
            'gifenc', // import map
            'https://esm.sh/gifenc@1.0.3',
            'https://cdn.skypack.dev/gifenc@1.0.3',
            'https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js'
        ];
        
        let GIFEncoder, quantize, applyPalette;
        for (const url of cdnUrls) {
            try {
                gifencModule = await import(url);
                // Try to extract exports
                const api =
                    (gifencModule.GIFEncoder && gifencModule.quantize)
                        ? gifencModule
                        : (gifencModule.default && typeof gifencModule.default === 'object' && gifencModule.default.quantize)
                            ? gifencModule.default
                            : gifencModule;
                GIFEncoder = api.GIFEncoder || (typeof gifencModule.default === 'function' ? gifencModule.default : null);
                quantize = api.quantize || gifencModule.quantize;
                applyPalette = api.applyPalette || gifencModule.applyPalette;
                if (GIFEncoder && quantize && applyPalette) break;
            } catch (e) {
                console.warn(`Failed to load gifenc from ${url}:`, e.message);
            }
        }
        
        if (!GIFEncoder || !quantize || !applyPalette) {
            console.error('gifenc module structure:', gifencModule);
            console.error('Keys:', gifencModule ? Object.keys(gifencModule) : 'null');
            throw new Error('Could not load GIF encoder from any CDN source');
        }
        const gif = GIFEncoder();

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext('2d');

        for (let i = 0; i < frameCount; i++) {
            const progress = -1 + (2 * i / Math.max(1, frameCount - 1));
            setFoldProgress(progress, false);
            renderer.render(scene, camera);

            frameCtx.drawImage(canvas, 0, 0);
            const imageData = frameCtx.getImageData(0, 0, width, height);
            const rgba = imageData.data;

            const palette = quantize(rgba, 256);
            const index = applyPalette(rgba, palette);
            gif.writeFrame(index, width, height, {
                palette,
                delay: frameDelayMs
            });

            if (progressText) {
                progressText.textContent = `Capturing: ${Math.round((i + 1) / frameCount * 100)}%`;
            }
            await new Promise(r => setTimeout(r, 0));
        }

        if (progressText) progressText.textContent = 'Encoding...';
        gif.finish();
        const bytes = gif.bytes();
        const blob = new Blob([bytes], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `foldproof-animation-${timestamp}.gif`;
        a.click();
        URL.revokeObjectURL(url);

        cleanup();
    } catch (err) {
        console.error('GIF export failed:', err);
        cleanup();
        const msg = err?.message || String(err);
        alert(`GIF export failed: ${msg}. Please try again.`);
    }
}

/**
 * Get current reflect state from UI
 */
function getReflectState() {
    return {
        reflectFrontH: document.getElementById('reflect-front-h')?.checked ?? false,
        reflectBackH: document.getElementById('reflect-back-h')?.checked ?? true,
        reflectFrontV: document.getElementById('reflect-front-v')?.checked ?? false,
        reflectBackV: document.getElementById('reflect-back-v')?.checked ?? false
    };
}

/**
 * Apply viewport match (size + orientation) and user transforms to an image
 * Output matches current paper size and fold orientation as displayed in viewport
 * @param {string} dataUrl - Source image data URL
 * @param {Object} opts - { flipH, flipV, rotate } user transforms
 * @returns {Promise<string>} Transformed image data URL
 */
async function applyImageTransformsForExport(dataUrl, opts = {}) {
    if (!dataUrl) return dataUrl;
    
    const { flipH = false, flipV = false, rotate = 0 } = opts;
    const size = getCurrentSize();
    const orientation = getCurrentOrientation();
    const isHorizontal = orientation === 'horizontal';
    
    // Paper dimensions in inches; horizontal fold displays as rotated 90°
    const widthIn = size.width;
    const heightIn = size.height;
    const targetW = Math.round((isHorizontal ? heightIn : widthIn) * EXPORT_DPI);
    const targetH = Math.round((isHorizontal ? widthIn : heightIn) * EXPORT_DPI);
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const c = canvas.getContext('2d');
            
            // 1. Scale source to paper size (cover) on a temp canvas
            const paperW = Math.round(widthIn * EXPORT_DPI);
            const paperH = Math.round(heightIn * EXPORT_DPI);
            const temp = document.createElement('canvas');
            temp.width = paperW;
            temp.height = paperH;
            const t = temp.getContext('2d');
            const scale = Math.max(paperW / img.width, paperH / img.height);
            const sw = img.width * scale;
            const sh = img.height * scale;
            const sx = (sw - paperW) / 2;
            const sy = (sh - paperH) / 2;
            t.drawImage(img, -sx, -sy, sw, sh);
            
            // 2. If horizontal, rotate 90° CW onto output canvas (targetW×targetH = paperH×paperW)
            if (isHorizontal) {
                c.translate(targetW, 0);
                c.rotate(-Math.PI / 2);
                c.drawImage(temp, 0, 0, paperW, paperH, 0, 0, paperH, paperW);
                c.setTransform(1, 0, 0, 1, 0, 0);
            } else {
                c.drawImage(temp, 0, 0);
            }
            
            // 3. Apply user flip and rotate
            const userRotate = Number(rotate) || 0;
            if (flipH || flipV || userRotate !== 0) {
                const out = document.createElement('canvas');
                const rad = (userRotate * Math.PI) / 180;
                let ow = targetW;
                let oh = targetH;
                if (userRotate === 90 || userRotate === -90) [ow, oh] = [oh, ow];
                out.width = ow;
                out.height = oh;
                const oc = out.getContext('2d');
                oc.translate(ow / 2, oh / 2);
                oc.rotate(rad);
                oc.translate(-targetW / 2, -targetH / 2);
                if (flipH || flipV) {
                    oc.translate(targetW / 2, targetH / 2);
                    oc.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                    oc.translate(-targetW / 2, -targetH / 2);
                }
                oc.drawImage(canvas, 0, 0);
                resolve(out.toDataURL('image/png'));
            } else {
                resolve(canvas.toDataURL('image/png'));
            }
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

/**
 * Convert data URL to blob for specified format
 * @param {string} dataUrl - PNG data URL
 * @param {string} format - 'png' | 'jpg'
 * @param {number} quality - 0-1 for jpg
 * @returns {Promise<Blob>}
 */
async function dataUrlToBlob(dataUrl, format = 'png', quality = 0.92) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('Blob conversion failed')),
                format === 'jpg' ? 'image/jpeg' : 'image/png',
                format === 'jpg' ? quality : undefined
            );
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

/**
 * Setup source export modal (show/hide, sync from reflect state)
 */
function setupSourceExportModal() {
    const modal = document.getElementById('source-export-modal');
    const overlay = document.getElementById('source-export-overlay');
    const closeBtn = document.getElementById('source-export-close');
    const applyBtn = document.getElementById('source-export-apply');
    const formatSelect = document.getElementById('source-export-format');
    const outputCombined = document.querySelector('input[name="source-export-output"][value="combined"]');
    const outputMultiple = document.querySelector('input[name="source-export-output"][value="multiple"]');

    function closeModal() {
        if (modal) modal.hidden = true;
    }

    function updateCombinedVisibility() {
        const isPdf = formatSelect?.value === 'pdf';
        const wrap = document.getElementById('source-export-combined-wrap');
        if (wrap) wrap.style.display = isPdf ? 'flex' : 'none';
        if (outputMultiple && !isPdf) outputMultiple.checked = true;
    }

    overlay?.addEventListener('click', closeModal);
    closeBtn?.addEventListener('click', closeModal);
    formatSelect?.addEventListener('change', updateCombinedVisibility);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
    });

    applyBtn?.addEventListener('click', async () => {
        await runSourceExport();
    });
}

/**
 * Open source export modal and sync options from current reflect state
 */
function openSourceExportModal() {
    const images = getImages();
    const hasFront = images.front && images.front.dataUrl;
    const hasBack = images.back && images.back.dataUrl;
    
    if (!hasFront && !hasBack) {
        alert('No images to export. Please upload front and/or back images first.');
        return;
    }

    const reflectState = getReflectState();
    document.getElementById('source-front-flip-h').checked = reflectState.reflectFrontH;
    document.getElementById('source-front-flip-v').checked = reflectState.reflectFrontV;
    document.getElementById('source-back-flip-h').checked = reflectState.reflectBackH;
    document.getElementById('source-back-flip-v').checked = reflectState.reflectBackV;
    
    const formatSelect = document.getElementById('source-export-format');
    const combinedWrap = document.getElementById('source-export-combined-wrap');
    if (combinedWrap) combinedWrap.style.display = formatSelect?.value === 'pdf' ? 'flex' : 'none';
    
    document.getElementById('source-export-modal').hidden = false;
}

/**
 * Run source export from modal options
 */
async function runSourceExport() {
    const images = getImages();
    const format = document.getElementById('source-export-format')?.value || 'png';
    const outputMode = document.querySelector('input[name="source-export-output"]:checked')?.value || 'multiple';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const frontOpts = {
        flipH: document.getElementById('source-front-flip-h')?.checked ?? false,
        flipV: document.getElementById('source-front-flip-v')?.checked ?? false,
        rotate: Number(document.getElementById('source-front-rotate')?.value || 0)
    };
    const backOpts = {
        flipH: document.getElementById('source-back-flip-h')?.checked ?? true,
        flipV: document.getElementById('source-back-flip-v')?.checked ?? false,
        rotate: Number(document.getElementById('source-back-rotate')?.value || 0)
    };

    const mimeExt = { png: ['image/png', 'png'], jpg: ['image/jpeg', 'jpg'] };

    if (format === 'pdf') {
        try {
            const { default: jsPDF } = await import('jspdf');
            const pages = [];
            if (images.front?.dataUrl) {
                const dataUrl = await applyImageTransformsForExport(images.front.dataUrl, frontOpts);
                pages.push({ dataUrl, label: 'front' });
            }
            if (images.back?.dataUrl) {
                const dataUrl = await applyImageTransformsForExport(images.back.dataUrl, backOpts);
                pages.push({ dataUrl, label: 'back' });
            }
            if (pages.length === 0) return;

            if (outputMode === 'combined' && pages.length > 0) {
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = pages[0].dataUrl;
                });
                const w = img.width;
                const h = img.height;
                const pdf = new jsPDF({ unit: 'px', format: [w, h] });
                for (let i = 0; i < pages.length; i++) {
                    if (i > 0) pdf.addPage();
                    pdf.addImage(pages[i].dataUrl, 'PNG', 0, 0, w, h);
                }
                pdf.save(`foldproof-export-${timestamp}.pdf`);
            } else {
                for (const p of pages) {
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = p.dataUrl;
                    });
                    const pdf = new jsPDF({ unit: 'px', format: [img.width, img.height] });
                    pdf.addImage(p.dataUrl, 'PNG', 0, 0, img.width, img.height);
                    pdf.save(`foldproof-${p.label}-${timestamp}.pdf`);
                }
            }
        } catch (err) {
            console.error('PDF export failed:', err);
            alert('PDF export failed. Please try PNG or JPG instead.');
            return;
        }
    } else {
        const [mime, ext] = mimeExt[format] || mimeExt.png;
        if (images.front?.dataUrl) {
            const dataUrl = await applyImageTransformsForExport(images.front.dataUrl, frontOpts);
            const blob = await dataUrlToBlob(dataUrl, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `foldproof-front-${timestamp}.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
        }
        if (images.back?.dataUrl) {
            const dataUrl = await applyImageTransformsForExport(images.back.dataUrl, backOpts);
            const blob = await dataUrlToBlob(dataUrl, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `foldproof-back-${timestamp}.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    document.getElementById('source-export-modal').hidden = true;
}

