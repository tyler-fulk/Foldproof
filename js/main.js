/**
 * Print Fold Visualizer - Main Entry Point
 * Integrates all modules and initializes the application
 */

import * as THREE from 'three';
import { initImageHandler, getImages, hasAllImages, createTexture, getAutofitEnabled, getImageDimensionsInInches } from './imageHandler.js';
import { initSizeParser, getCurrentSize, setSizeFromDimensions } from './sizeParser.js';
import { initFoldCalculator, getCurrentFoldType } from './foldCalculator.js';
import { initScene, getScene, addToScene, removeFromScene, clearMeshes, updateBackgroundColor, getGridHelper } from './scene.js';
import { createFoldMesh, getPaperGroup, disposeMesh, updateTextures } from './foldMesh.js';
import { initAnimations, resetAnimation, setFoldProgress } from './animations.js';
import { initGuides, createGuides, clearGuides } from './guides.js';
import { initExport } from './exportViewport.js';

// Application state
let isInitialized = false;
let currentTextures = { front: null, back: null };
let currentGuideGroup = null;

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Print Fold Visualizer...');
    
    // Initialize Three.js scene
    initScene();
    
    // Initialize UI modules
    initImageHandler(onImagesChanged);
    initSizeParser(onSizeChanged);
    initFoldCalculator(onFoldTypeChanged);
    initAnimations(onProgressUpdate);
    initGuides();
    initExport();
    setupReflectToggles();
    setupGridToggle();
    setupAboutToggle();
    
    // Setup theme toggle
    setupThemeToggle();
    
    // Mark as initialized
    isInitialized = true;
    
    console.log('Application initialized successfully');
}

/**
 * Setup dark/light theme toggle
 */
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    
    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set initial theme if not already set by the blocking script in index.html
    if (!document.documentElement.hasAttribute('data-theme')) {
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }
    
    // Update Three.js background to match initial theme
    updateBackgroundColor();
    
    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update Three.js background
        updateBackgroundColor();
    });
}

/**
 * Handle image changes
 * @param {Object} images - { front, back }
 */
function onImagesChanged(images) {
    console.log('Images changed:', images);
    
    // Update viewport overlay visibility
    const overlay = document.getElementById('viewport-overlay');
    
    if (images.front && images.back) {
        overlay.hidden = true;

        currentTextures.front = createTextureFromImage(images.front);
        currentTextures.back = createTextureFromImage(images.back);

        let didSetSizeFromImage = false;
        if (!getAutofitEnabled()) {
            const dims = getImageDimensionsInInches();
            if (dims) {
                setSizeFromDimensions(dims.width, dims.height);
                didSetSizeFromImage = true;
            }
        }

        if (!didSetSizeFromImage) rebuildMesh();
    } else if (images.front || images.back) {
        overlay.hidden = true;

        currentTextures.front = images.front ? createTextureFromImage(images.front) : null;
        currentTextures.back = images.back ? createTextureFromImage(images.back) : null;

        let didSetSizeFromImage = false;
        if (!getAutofitEnabled()) {
            const dims = getImageDimensionsInInches();
            if (dims) {
                setSizeFromDimensions(dims.width, dims.height);
                didSetSizeFromImage = true;
            }
        }

        if (!didSetSizeFromImage) rebuildMesh();
    } else {
        // No images
        overlay.hidden = false;
        currentTextures = { front: null, back: null };
        clearMeshes();
        
        // Clear guides
        if (currentGuideGroup) {
            removeFromScene(currentGuideGroup);
            clearGuides();
            currentGuideGroup = null;
        }
    }
}

/**
 * Create a Three.js texture from image data
 * @param {Object} imageData - Image data object
 * @returns {THREE.Texture}
 */
function createTextureFromImage(imageData) {
    if (!imageData || !imageData.dataUrl) return null;
    
    const texture = new THREE.TextureLoader().load(imageData.dataUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    return texture;
}

/**
 * Handle size changes
 * @param {Object} size - { width, height, aspectRatio }
 */
function onSizeChanged(size) {
    console.log('Size changed:', size);
    
    // Rebuild mesh with new size
    if (hasAnyImages()) {
        rebuildMesh();
    }
}

/**
 * Handle fold type changes
 * @param {string} foldType 
 */
function onFoldTypeChanged(foldType) {
    console.log('Fold type changed:', foldType);
    
    // Rebuild mesh with new fold configuration
    if (hasAnyImages()) {
        rebuildMesh();
    }
}

function getReflectState() {
    return {
        reflectFront: document.getElementById('reflect-front')?.checked ?? false,
        reflectBack: document.getElementById('reflect-back')?.checked ?? false
    };
}

function setupAboutToggle() {
    const toggle = document.getElementById('about-toggle');
    const content = document.getElementById('about-content');
    if (toggle && content) {
        toggle.addEventListener('click', () => {
            const isOpen = !content.hidden;
            content.hidden = isOpen;
            toggle.setAttribute('aria-expanded', !isOpen);
            toggle.querySelector('.about-chevron').textContent = isOpen ? '▾' : '▴';
        });
    }
}

function setupGridToggle() {
    const gridToggle = document.getElementById('guide-grid');
    if (gridToggle) {
        gridToggle.addEventListener('change', (e) => {
            const grid = getGridHelper();
            if (grid) grid.visible = e.target.checked;
        });
    }
}

function setupReflectToggles() {
    const reflectFront = document.getElementById('reflect-front');
    const reflectBack = document.getElementById('reflect-back');
    if (reflectFront) {
        reflectFront.addEventListener('change', () => {
            if (hasAnyImages()) {
                updateTextures(currentTextures, getReflectState());
            }
        });
    }
    if (reflectBack) {
        reflectBack.addEventListener('change', () => {
            if (hasAnyImages()) {
                updateTextures(currentTextures, getReflectState());
            }
        });
    }
}

/**
 * Handle animation progress updates
 * @param {number} progress 
 */
function onProgressUpdate(progress) {
    // Could add visual feedback here if needed
}

/**
 * Check if any images are uploaded
 * @returns {boolean}
 */
function hasAnyImages() {
    const images = getImages();
    return images.front !== null || images.back !== null;
}

/**
 * Rebuild the 3D mesh
 */
function rebuildMesh() {
    const scene = getScene();
    if (!scene) return;
    
    // Clear existing mesh
    const existingGroup = getPaperGroup();
    if (existingGroup) {
        removeFromScene(existingGroup);
        disposeMesh();
    }
    
    // Clear existing guides
    if (currentGuideGroup) {
        removeFromScene(currentGuideGroup);
        clearGuides();
        currentGuideGroup = null;
    }
    
    // Get current settings
    const size = getCurrentSize();
    const reflectOptions = getReflectState();
    
    // Create new mesh
    const paperGroup = createFoldMesh(size, currentTextures, reflectOptions);
    
    if (paperGroup) {
        addToScene(paperGroup);
        
        // Create guides based on paper configuration
        const panelConfig = paperGroup.userData.panelConfig;
        if (panelConfig) {
            currentGuideGroup = createGuides(size, panelConfig);
            if (currentGuideGroup) {
                addToScene(currentGuideGroup);
            }
        }
        
        // Reset animation to unfolded state
        resetAnimation();
    }
}

/**
 * Cleanup function
 */
function cleanup() {
    disposeMesh();
    clearGuides();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
