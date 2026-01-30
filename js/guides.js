/**
 * Guides Module
 * Creates and manages visual guides for trim, bleed, safe zone, and fold lines
 */

import * as THREE from 'three';

// Guide colors
const GUIDE_COLORS = {
    trim: 0xef4444,      // Red
    bleed: 0xf97316,     // Orange
    safe: 0x22c55e,      // Green
    folds: 0x3b82f6      // Blue
};

// Standard print margins (in inches)
const BLEED_MARGIN = 0.125;  // 1/8 inch
const SAFE_MARGIN = 0.25;    // 1/4 inch

// Scale factor (must match foldMesh.js)
const SCALE_FACTOR = 0.5;

// Guide visibility state
let guideState = {
    trim: true,
    bleed: false,
    safe: false,
    folds: true
};

// Guide objects
let guideGroup = null;
let trimLines = null;
let bleedLines = null;
let safeLines = null;
let foldLines = null;

// Current configuration
let currentSize = null;
let currentPanelConfig = null;

/**
 * Initialize the guides system
 */
export function initGuides() {
    // Set up toggle listeners
    const trimToggle = document.getElementById('guide-trim');
    const bleedToggle = document.getElementById('guide-bleed');
    const safeToggle = document.getElementById('guide-safe');
    const foldsToggle = document.getElementById('guide-folds');
    
    if (trimToggle) {
        trimToggle.addEventListener('change', (e) => {
            guideState.trim = e.target.checked;
            updateGuideVisibility();
        });
    }
    
    if (bleedToggle) {
        bleedToggle.addEventListener('change', (e) => {
            guideState.bleed = e.target.checked;
            updateGuideVisibility();
        });
    }
    
    if (safeToggle) {
        safeToggle.addEventListener('change', (e) => {
            guideState.safe = e.target.checked;
            updateGuideVisibility();
        });
    }
    
    if (foldsToggle) {
        foldsToggle.addEventListener('change', (e) => {
            guideState.folds = e.target.checked;
            updateGuideVisibility();
        });
    }
}

/**
 * Create guide overlays for the paper
 * @param {Object} size - Paper size { width, height }
 * @param {Object} panelConfig - Panel configuration from foldCalculator
 * @returns {THREE.Group} Group containing all guide lines
 */
export function createGuides(size, panelConfig) {
    currentSize = size;
    currentPanelConfig = panelConfig;
    
    // Create main group for guides
    guideGroup = new THREE.Group();
    guideGroup.name = 'guides';
    
    // Scale dimensions
    const scaledWidth = size.width * SCALE_FACTOR;
    const scaledHeight = size.height * SCALE_FACTOR;
    
    // Create each guide type
    trimLines = createRectangleGuide(scaledWidth, scaledHeight, GUIDE_COLORS.trim, 0);
    bleedLines = createRectangleGuide(
        scaledWidth + (BLEED_MARGIN * 2 * SCALE_FACTOR),
        scaledHeight + (BLEED_MARGIN * 2 * SCALE_FACTOR),
        GUIDE_COLORS.bleed,
        0
    );
    safeLines = createRectangleGuide(
        scaledWidth - (SAFE_MARGIN * 2 * SCALE_FACTOR),
        scaledHeight - (SAFE_MARGIN * 2 * SCALE_FACTOR),
        GUIDE_COLORS.safe,
        0
    );
    foldLines = createFoldGuides(panelConfig);
    
    // Add to group
    guideGroup.add(trimLines);
    guideGroup.add(bleedLines);
    guideGroup.add(safeLines);
    guideGroup.add(foldLines);
    
    // Position guides slightly above paper to prevent z-fighting
    guideGroup.position.y = 0.02;
    
    // Apply initial visibility
    updateGuideVisibility();
    
    return guideGroup;
}

/**
 * Create a rectangle guide outline
 * @param {number} width - Width of rectangle
 * @param {number} height - Height of rectangle
 * @param {number} color - Line color
 * @param {number} yOffset - Y position offset
 * @returns {THREE.Line}
 */
function createRectangleGuide(width, height, color, yOffset) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    const points = [
        new THREE.Vector3(-halfWidth, yOffset, -halfHeight),
        new THREE.Vector3(halfWidth, yOffset, -halfHeight),
        new THREE.Vector3(halfWidth, yOffset, halfHeight),
        new THREE.Vector3(-halfWidth, yOffset, halfHeight),
        new THREE.Vector3(-halfWidth, yOffset, -halfHeight)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
    });
    
    return new THREE.Line(geometry, material);
}

/**
 * Create fold line guides
 * @param {Object} panelConfig - Panel configuration
 * @returns {THREE.Group}
 */
function createFoldGuides(panelConfig) {
    const group = new THREE.Group();
    group.name = 'fold-lines';
    
    if (!panelConfig || !panelConfig.panels) return group;
    
    const scaledWidth = panelConfig.totalWidth * SCALE_FACTOR;
    const scaledHeight = panelConfig.totalHeight * SCALE_FACTOR;
    const isVertical = panelConfig.isVertical;
    
    // Find fold positions from panel edges
    const foldPositions = [];
    
    panelConfig.panels.forEach((panel, index) => {
        // Skip the last panel - it doesn't have a fold after it
        if (index < panelConfig.panels.length - 1) {
            const foldOffset = (panel.offsetX + panel.width) * SCALE_FACTOR;
            foldPositions.push(foldOffset);
        }
    });
    
    // Create fold lines
    foldPositions.forEach(offset => {
        const line = createFoldLine(offset, scaledWidth, scaledHeight, isVertical);
        group.add(line);
    });
    
    return group;
}

/**
 * Create a single dashed fold line
 * @param {number} offset - Position of fold line
 * @param {number} totalWidth - Total paper width (scaled)
 * @param {number} totalHeight - Total paper height (scaled)
 * @param {boolean} isVertical - Whether fold is vertical
 * @returns {THREE.Line}
 */
function createFoldLine(offset, totalWidth, totalHeight, isVertical) {
    const points = [];
    
    if (isVertical) {
        // Vertical fold - line runs top to bottom
        const x = offset - (totalWidth / 2);
        points.push(new THREE.Vector3(x, 0.01, -totalHeight / 2));
        points.push(new THREE.Vector3(x, 0.01, totalHeight / 2));
    } else {
        // Horizontal fold - line runs left to right
        const z = (totalHeight / 2) - offset;
        points.push(new THREE.Vector3(-totalWidth / 2, 0.01, z));
        points.push(new THREE.Vector3(totalWidth / 2, 0.01, z));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create dashed line material
    const material = new THREE.LineDashedMaterial({
        color: GUIDE_COLORS.folds,
        linewidth: 2,
        dashSize: 0.1,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.9
    });
    
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances(); // Required for dashed lines
    
    return line;
}

/**
 * Update visibility of all guides based on state
 */
function updateGuideVisibility() {
    if (trimLines) trimLines.visible = guideState.trim;
    if (bleedLines) bleedLines.visible = guideState.bleed;
    if (safeLines) safeLines.visible = guideState.safe;
    if (foldLines) foldLines.visible = guideState.folds;
}

/**
 * Get the current guide group
 * @returns {THREE.Group}
 */
export function getGuideGroup() {
    return guideGroup;
}

/**
 * Clear all guides
 */
export function clearGuides() {
    if (guideGroup) {
        guideGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        guideGroup = null;
    }
    trimLines = null;
    bleedLines = null;
    safeLines = null;
    foldLines = null;
}

/**
 * Update guides when paper configuration changes
 * @param {Object} size - New paper size
 * @param {Object} panelConfig - New panel configuration
 */
export function updateGuides(size, panelConfig) {
    clearGuides();
    return createGuides(size, panelConfig);
}
