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
    'image/tiff'
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

// Callbacks for when images change
let onImageChangeCallback = null;

/**
 * Initialize the image handler
 * @param {Function} onImageChange - Callback when images are uploaded/removed
 */
export function initImageHandler(onImageChange) {
    onImageChangeCallback = onImageChange;
    
    setupUploadZone('front');
    setupUploadZone('back');
    
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
            uploadedImages[side] = {
                dataUrl: dataUrl,
                width: img.width,
                height: img.height,
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
 * Handle PDF file upload
 * @param {File} file - The PDF file
 * @param {string} side - 'front' or 'back'
 */
async function handlePdfFile(file, side) {
    try {
        // Show loading state
        showLoadingState(side, 'Loading PDF...');
        
        // Initialize PDF.js
        const pdfjs = await initPdfJs();
        if (!pdfjs) {
            throw new Error('PDF.js library not available');
        }
        
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load the PDF document
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Get the first page
        const page = await pdf.getPage(1);
        
        // Calculate scale for high-quality rendering
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2048 / viewport.width, 2048 / viewport.height, 3);
        const scaledViewport = page.getViewport({ scale });
        
        // Create canvas to render PDF
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        
        // Render PDF page to canvas
        await page.render({
            canvasContext: context,
            viewport: scaledViewport
        }).promise;
        
        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        
        // Store the image data
        uploadedImages[side] = {
            dataUrl: dataUrl,
            width: canvas.width,
            height: canvas.height,
            file: file,
            isPdf: true,
            pageCount: pdf.numPages
        };
        
        updatePreview(side, dataUrl);
        notifyImageChange();
        
        // Show page count info if multi-page PDF
        if (pdf.numPages > 1) {
            console.log(`PDF has ${pdf.numPages} pages. Using page 1 for ${side} side.`);
        }
        
    } catch (error) {
        console.error('Error processing PDF:', error);
        hideLoadingState(side);
        alert(`Error loading PDF: ${error.message}. Please try a different file.`);
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
