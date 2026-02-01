/**
 * Image Handler Module
 * Handles image upload, validation, preview, and texture creation
 * Supports images (PNG, JPG, WebP, BMP, TIFF) and PDF files
 */

import * as THREE from 'three';

// Supported image formats
const SUPPORTED_IMAGE_FORMATS = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/svg+xml'
];

// PDF format
const PDF_FORMAT = 'application/pdf';

// All supported formats
const SUPPORTED_FORMATS = [...SUPPORTED_IMAGE_FORMATS, PDF_FORMAT];

// Maximum file size (20MB for PDFs)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// PDF.js worker
let pdfjsLib = null;

/**
 * Initialize PDF.js library
 */
async function initPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    
    try {
        pdfjsLib = await import('pdfjs-dist');
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
        return pdfjsLib;
    } catch (error) {
        console.error('Failed to load PDF.js:', error);
        return null;
    }
}

// Store for uploaded images
const uploadedImages = {
    front: null,
    back: null
};

// Autofit: when true, use paper size from sidebar; when false, use image dimensions
let autofitEnabled = false;

// Callbacks for when images change
let onImageChangeCallback = null;

// Default DPI for raster images when converting pixels to inches
const DEFAULT_IMAGE_DPI = 96;

/**
 * Initialize the image handler
 * @param {Function} onImageChange - Callback when images are uploaded/removed
 */
export function initImageHandler(onImageChange) {
    onImageChangeCallback = onImageChange;
    
    setupUploadZone('front');
    setupUploadZone('back');
    setupAutofitToggle();
    setupSwapButton();
    
    // Global event delegation for remove buttons - more reliable than per-element listeners
    document.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-btn');
        if (removeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const side = removeBtn.dataset.side;
            if (side) {
                removeImage(side);
            }
        }
    }, true); // Capture phase to intercept before other handlers
}

function setupAutofitToggle() {
    const checkbox = document.getElementById('autofit-image');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            autofitEnabled = e.target.checked;
            notifyImageChange();
        });
    }

    setupAutofitTooltip();
}

function setupAutofitTooltip() {
    const trigger = document.getElementById('autofit-tooltip-trigger');
    const tooltip = document.getElementById('autofit-tooltip-box');
    if (!trigger || !tooltip) return;

    const TOOLTIP_OFFSET = 8;
    const VIEWPORT_PADDING = 12;

    trigger.addEventListener('mouseenter', () => {
        tooltip.classList.add('visible');
        requestAnimationFrame(() => {
            positionTooltip();
        });
    });

    trigger.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });

    function positionTooltip() {
        const triggerRect = trigger.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const tooltipWidth = 320;
        const tooltipHeight = 80;

        let left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
        left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - tooltipWidth - VIEWPORT_PADDING));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${triggerRect.bottom + TOOLTIP_OFFSET}px`;
    }
}

export function getAutofitEnabled() {
    return autofitEnabled;
}

/**
 * Setup upload zone with drag-drop and click handlers
 * @param {string} side - 'front' or 'back'
 */
function setupUploadZone(side) {
    const zone = document.getElementById(`${side}-upload-zone`);
    const input = document.getElementById(`${side}-image`);
    
    // Click to upload (but not when clicking the remove button)
    zone.addEventListener('click', (e) => {
        // Don't trigger file input if clicking the remove button
        if (e.target.closest('.remove-btn')) {
            return;
        }
        input.click();
    });
    
    // File input change
    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0], side);
        }
    });
    
    // Drag and drop events
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('drag-over');
    });
    
    zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0], side);
        }
    });
}

/**
 * Handle uploaded file
 * @param {File} file - The uploaded file
 * @param {string} side - 'front' or 'back'
 */
async function handleFile(file, side) {
    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type)) {
        alert(`Unsupported file format. Please use: PNG, JPG, WebP, BMP, TIFF, or PDF`);
        return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        alert(`File too large. Maximum size is 20MB.`);
        return;
    }
    
    // Handle PDF files differently
    if (file.type === PDF_FORMAT) {
        await handlePdfFile(file, side);
        return;
    }
    
    // Handle SVG files (parse for physical dimensions)
    if (file.type === 'image/svg+xml') {
        await handleSvgFile(file, side);
        return;
    }
    
    // Handle regular image files
    handleImageFile(file, side);
}

/**
 * Handle regular image file upload
 * @param {File} file - The image file
 * @param {string} side - 'front' or 'back'
 */
function handleImageFile(file, side) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        
        // Create an image to get dimensions
        const img = new Image();
        img.onload = () => {
            const widthInches = img.width / DEFAULT_IMAGE_DPI;
            const heightInches = img.height / DEFAULT_IMAGE_DPI;

            uploadedImages[side] = {
                dataUrl: dataUrl,
                width: img.width,
                height: img.height,
                widthInches,
                heightInches,
                file: file,
                isPdf: false
            };
            
            updatePreview(side, dataUrl);
            notifyImageChange();
        };
        img.src = dataUrl;
    };
    
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };
    
    reader.readAsDataURL(file);
}

/**
 * Parse SVG for width/height in physical units (in, pt)
 * @param {string} svgText - SVG file content
 * @returns {{ widthInches: number, heightInches: number } | null}
 */
function parseSvgDimensions(svgText) {
    const widthMatch = svgText.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
    const heightMatch = svgText.match(/\bheight\s*=\s*["']([^"']+)["']/i);
    const viewBoxMatch = svgText.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);

    let widthInches = null;
    let heightInches = null;

    const parseUnit = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return null;
        if (/in/i.test(val)) return num;
        if (/pt/i.test(val)) return num / 72;
        return num / DEFAULT_IMAGE_DPI;
    };

    if (widthMatch) widthInches = parseUnit(widthMatch[1]);
    if (heightMatch) heightInches = parseUnit(heightMatch[1]);

    if (widthInches && heightInches && widthInches > 0 && heightInches > 0) {
        return { widthInches, heightInches };
    }
    return null;
}

/**
 * Handle SVG file upload
 * @param {File} file - The SVG file
 * @param {string} side - 'front' or 'back'
 */
async function handleSvgFile(file, side) {
    try {
        const text = await file.text();
        const dims = parseSvgDimensions(text);

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const img = new Image();
            img.onload = () => {
                const widthInches = dims ? dims.widthInches : img.width / DEFAULT_IMAGE_DPI;
                const heightInches = dims ? dims.heightInches : img.height / DEFAULT_IMAGE_DPI;

                uploadedImages[side] = {
                    dataUrl: dataUrl,
                    width: img.width,
                    height: img.height,
                    widthInches,
                    heightInches,
                    file: file,
                    isPdf: false
                };

                updatePreview(side, dataUrl);
                notifyImageChange();
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('Error loading SVG:', err);
        handleImageFile(file, side);
    }
}

/**
 * Render a single PDF page to image data
 * @param {Object} pdf - PDF.js document
 * @param {number} pageNum - 1-based page number
 * @param {File} file - Original PDF file
 * @returns {Object} Image data object for uploadedImages
 */
async function renderPdfPageToImageData(pdf, pageNum, file, options = {}) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2048 / viewport.width, 2048 / viewport.height, 3);
    const scaledViewport = page.getViewport({ scale });

    const widthInches = viewport.width / 72;
    const heightInches = viewport.height / 72;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({
        canvasContext: context,
        viewport: scaledViewport
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');
    const result = {
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        widthInches,
        heightInches,
        file,
        isPdf: true,
        pageCount: pdf.numPages,
        currentPage: pageNum
    };
    if (options.storePdfDoc && pdf.numPages > 2) {
        result.pdfDoc = pdf;
    }
    return result;
}

/**
 * Handle PDF file upload.
 * If the PDF has 2 pages, automatically inserts page 1 into front and page 2 into back.
 * Otherwise, inserts the first page into the dropped zone.
 * @param {File} file - The PDF file
 * @param {string} side - 'front' or 'back' (zone where file was dropped)
 */
async function handlePdfFile(file, side) {
    try {
        const loadingMsg = 'Loading PDF...';
        showLoadingState(side, loadingMsg);

        const pdfjs = await initPdfJs();
        if (!pdfjs) {
            throw new Error('PDF.js library not available');
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        const pageCount = Number(pdf.numPages) || 0;
        if (pageCount === 2) {
            showLoadingState('front', 'Loading PDF (2 pages)...');
            showLoadingState('back', 'Loading PDF (2 pages)...');
            const frontData = await renderPdfPageToImageData(pdf, 1, file);
            const backData = await renderPdfPageToImageData(pdf, 2, file);
            uploadedImages.front = frontData;
            uploadedImages.back = backData;
            updatePreview('front', frontData.dataUrl);
            updatePreview('back', backData.dataUrl);
            document.getElementById('front-image').value = '';
            document.getElementById('back-image').value = '';
            hidePageSelector('front');
            hidePageSelector('back');
            hideLoadingState('front');
            hideLoadingState('back');
        } else if (pageCount > 2) {
            showLoadingState('front', 'Loading PDF...');
            showLoadingState('back', 'Loading PDF...');
            const frontData = await renderPdfPageToImageData(pdf, 1, file, { storePdfDoc: true });
            const backData = await renderPdfPageToImageData(pdf, 2, file, { storePdfDoc: true });
            uploadedImages.front = frontData;
            uploadedImages.back = backData;
            updatePreview('front', frontData.dataUrl);
            updatePreview('back', backData.dataUrl);
            showPageSelector('front', pageCount, 1);
            showPageSelector('back', pageCount, 2);
            document.getElementById('front-image').value = '';
            document.getElementById('back-image').value = '';
            hideLoadingState('front');
            hideLoadingState('back');
        } else {
            const imageData = await renderPdfPageToImageData(pdf, 1, file);
            uploadedImages[side] = imageData;
            updatePreview(side, imageData.dataUrl);
            hidePageSelector(side);
            hideLoadingState(side);
        }

        notifyImageChange();
    } catch (error) {
        console.error('Error processing PDF:', error);
        hideLoadingState('front');
        hideLoadingState('back');
        alert(`Error loading PDF: ${error.message}. Please try a different file.`);
    }
}

/**
 * Show page selector for multi-page PDF
 * @param {string} side - 'front' or 'back'
 * @param {number} pageCount - Total pages
 * @param {number} currentPage - Currently displayed page (1-based)
 */
function showPageSelector(side, pageCount, currentPage) {
    const wrap = document.getElementById(`${side}-page-selector`);
    if (!wrap) return;
    wrap.hidden = false;
    wrap.innerHTML = '';
    const select = document.createElement('select');
    select.className = 'page-select';
    select.title = 'Select page';
    for (let i = 1; i <= pageCount; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `Page ${i}`;
        if (i === currentPage) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', (e) => {
        e.stopPropagation();
        const pageNum = parseInt(e.target.value, 10);
        handlePageChange(side, pageNum);
    });
    wrap.addEventListener('click', (e) => e.stopPropagation());
    wrap.appendChild(select);
}

/**
 * Hide page selector
 * @param {string} side - 'front' or 'back'
 */
function hidePageSelector(side) {
    const wrap = document.getElementById(`${side}-page-selector`);
    if (wrap) {
        wrap.hidden = true;
        wrap.innerHTML = '';
    }
}

/**
 * Handle page selection change - re-render and update
 * @param {string} side - 'front' or 'back'
 * @param {number} pageNum - 1-based page number
 */
async function handlePageChange(side, pageNum) {
    const img = uploadedImages[side];
    if (!img || !img.pdfDoc || !img.file) return;
    const wrap = document.getElementById(`${side}-page-selector`);
    if (wrap) wrap.style.opacity = '0.6';
    try {
        const newData = await renderPdfPageToImageData(img.pdfDoc, pageNum, img.file, { storePdfDoc: true });
        newData.pdfDoc = img.pdfDoc;
        uploadedImages[side] = newData;
        updatePreview(side, newData.dataUrl);
        const select = wrap?.querySelector('select');
        if (select) select.value = String(pageNum);
        notifyImageChange();
    } catch (err) {
        console.error('Error rendering PDF page:', err);
    } finally {
        if (wrap) wrap.style.opacity = '';
    }
}

/**
 * Refresh page selectors after swap - update visibility and options based on current image data
 */
function refreshPageSelectors() {
    for (const side of ['front', 'back']) {
        const img = uploadedImages[side];
        if (img && img.pageCount > 2 && img.pdfDoc) {
            showPageSelector(side, img.pageCount, img.currentPage || 1);
        } else {
            hidePageSelector(side);
        }
    }
}

/**
 * Show loading state on upload zone
 * @param {string} side - 'front' or 'back'
 * @param {string} message - Loading message
 */
function showLoadingState(side, message) {
    const zone = document.getElementById(`${side}-upload-zone`);
    const placeholder = zone.querySelector('.upload-placeholder');
    const uploadText = placeholder.querySelector('.upload-text');
    
    uploadText.innerHTML = message;
    zone.style.pointerEvents = 'none';
    zone.style.opacity = '0.7';
}

/**
 * Hide loading state on upload zone
 * @param {string} side - 'front' or 'back'
 */
function hideLoadingState(side) {
    const zone = document.getElementById(`${side}-upload-zone`);
    const placeholder = zone.querySelector('.upload-placeholder');
    const uploadText = placeholder.querySelector('.upload-text');
    
    uploadText.innerHTML = `Drop ${side} image or PDF<br>or click to browse`;
    zone.style.pointerEvents = '';
    zone.style.opacity = '';
}

/**
 * Update the preview image
 * @param {string} side - 'front' or 'back'
 * @param {string} dataUrl - Image data URL
 */
function updatePreview(side, dataUrl) {
    const zone = document.getElementById(`${side}-upload-zone`);
    const placeholder = zone.querySelector('.upload-placeholder');
    const preview = zone.querySelector('.upload-preview');
    const previewImg = document.getElementById(`${side}-preview`);
    
    previewImg.src = dataUrl;
    placeholder.hidden = true;
    preview.hidden = false;
}

/**
 * Swap front and back images
 */
function swapImages() {
    const front = uploadedImages.front;
    const back = uploadedImages.back;
    if (!front && !back) return;

    uploadedImages.front = back;
    uploadedImages.back = front;

    const frontPreview = document.getElementById('front-preview');
    const backPreview = document.getElementById('back-preview');
    const frontZone = document.getElementById('front-upload-zone');
    const backZone = document.getElementById('back-upload-zone');

    if (front && back) {
        const frontSrc = frontPreview.src;
        const backSrc = backPreview.src;
        frontPreview.src = backSrc;
        backPreview.src = frontSrc;
    } else if (front) {
        frontPreview.src = '';
        frontZone.querySelector('.upload-placeholder').hidden = false;
        frontZone.querySelector('.upload-preview').hidden = true;
        backPreview.src = front.dataUrl;
        backZone.querySelector('.upload-placeholder').hidden = true;
        backZone.querySelector('.upload-preview').hidden = false;
    } else if (back) {
        backPreview.src = '';
        backZone.querySelector('.upload-placeholder').hidden = false;
        backZone.querySelector('.upload-preview').hidden = true;
        frontPreview.src = back.dataUrl;
        frontZone.querySelector('.upload-placeholder').hidden = true;
        frontZone.querySelector('.upload-preview').hidden = false;
    }

    refreshPageSelectors();
    notifyImageChange();
}

/**
 * Setup swap button click handler
 */
function setupSwapButton() {
    const btn = document.getElementById('swap-images-btn');
    if (btn) {
        btn.addEventListener('click', () => swapImages());
    }
}

/**
 * Remove an uploaded image
 * @param {string} side - 'front' or 'back'
 */
function removeImage(side) {
    uploadedImages[side] = null;
    
    const zone = document.getElementById(`${side}-upload-zone`);
    const placeholder = zone.querySelector('.upload-placeholder');
    const preview = zone.querySelector('.upload-preview');
    const input = document.getElementById(`${side}-image`);
    
    placeholder.hidden = false;
    preview.hidden = true;
    input.value = '';
    hidePageSelector(side);
    
    // Reset loading state (text, pointer events, opacity)
    hideLoadingState(side);
    
    notifyImageChange();
}

// Expose removeImage globally for onclick handlers
window.removeUploadedImage = removeImage;

/**
 * Notify that images have changed
 */
function notifyImageChange() {
    if (onImageChangeCallback) {
        onImageChangeCallback(getImages());
    }
}

/**
 * Get the current uploaded images
 * @returns {Object} Object with front and back image data
 */
export function getImages() {
    return {
        front: uploadedImages.front,
        back: uploadedImages.back
    };
}

/**
 * Get physical dimensions (in inches) from the first available image
 * @returns {{ width: number, height: number } | null}
 */
export function getImageDimensionsInInches() {
    const img = uploadedImages.front || uploadedImages.back;
    if (!img || img.widthInches == null || img.heightInches == null) return null;
    return { width: img.widthInches, height: img.heightInches };
}

/**
 * Check if both images are uploaded
 * @returns {boolean}
 */
export function hasAllImages() {
    return uploadedImages.front !== null && uploadedImages.back !== null;
}

/**
 * Create a Three.js texture from an uploaded image
 * @param {string} side - 'front' or 'back'
 * @returns {THREE.Texture|null}
 */
export function createTexture(side) {
    const imageData = uploadedImages[side];
    if (!imageData) return null;
    
    const texture = new THREE.TextureLoader().load(imageData.dataUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    return texture;
}
