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
    folds: 0x3b82f6,     // Blue
    ruler: 0x8b5cf6,     // Purple (dark mode)
    rulerLight: 0x4c1d95 // Dark purple (light mode only)
};

function getRulerColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? GUIDE_COLORS.ruler : GUIDE_COLORS.rulerLight;
}

// Default print margins (in inches)
const DEFAULT_BLEED_MARGIN = 0.125;  // 1/8 inch
const DEFAULT_SAFE_MARGIN = 0.25;    // 1/4 inch

// Editable margin values
let bleedMargin = DEFAULT_BLEED_MARGIN;
let safeMargin = DEFAULT_SAFE_MARGIN;

// Scale factor (must match foldMesh.js)
const SCALE_FACTOR = 0.5;

// Guide visibility state
let guideState = {
    trim: true,
    bleed: false,
    safe: false,
    folds: true,
    ruler: false,
    rulerLabels: true
};

// Guide objects
let guideGroup = null;
let trimLines = null;
let bleedLines = null;
let safeLines = null;
let foldLines = null;
let rulerGroup = null;
let rulerLabelsGroup = null;

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
    const rulerToggle = document.getElementById('guide-ruler');
    const rulerLabelsToggle = document.getElementById('guide-ruler-labels');
    const rulerSubmenu = document.getElementById('ruler-submenu');
    
    if (trimToggle) {
        trimToggle.addEventListener('change', (e) => {
            guideState.trim = e.target.checked;
            updateGuideVisibility();
        });
    }
    
    const bleedSubmenu = document.getElementById('bleed-submenu');
    const safeSubmenu = document.getElementById('safe-submenu');
    const bleedSlider = document.getElementById('bleed-margin');
    const safeSlider = document.getElementById('safe-margin');
    const bleedValueSpan = document.getElementById('bleed-value');
    const safeValueSpan = document.getElementById('safe-value');
    
    if (bleedToggle) {
        bleedToggle.addEventListener('change', (e) => {
            guideState.bleed = e.target.checked;
            updateGuideVisibility();
            if (bleedSubmenu) bleedSubmenu.hidden = !e.target.checked;
        });
    }
    
    if (bleedSlider) {
        bleedSlider.addEventListener('input', (e) => {
            bleedMargin = parseFloat(e.target.value);
            if (bleedValueSpan) bleedValueSpan.textContent = bleedMargin.toFixed(3);
            updateBleedSafeGuides();
        });
        bleedSlider.addEventListener('dblclick', () => {
            bleedMargin = DEFAULT_BLEED_MARGIN;
            bleedSlider.value = bleedMargin;
            if (bleedValueSpan) bleedValueSpan.textContent = bleedMargin.toFixed(3);
            updateBleedSafeGuides();
        });
    }
    
    if (safeToggle) {
        safeToggle.addEventListener('change', (e) => {
            guideState.safe = e.target.checked;
            updateGuideVisibility();
            if (safeSubmenu) safeSubmenu.hidden = !e.target.checked;
        });
    }
    
    if (safeSlider) {
        safeSlider.addEventListener('input', (e) => {
            safeMargin = parseFloat(e.target.value);
            if (safeValueSpan) safeValueSpan.textContent = safeMargin.toFixed(3);
            updateBleedSafeGuides();
        });
        safeSlider.addEventListener('dblclick', () => {
            safeMargin = DEFAULT_SAFE_MARGIN;
            safeSlider.value = safeMargin;
            if (safeValueSpan) safeValueSpan.textContent = safeMargin.toFixed(3);
            updateBleedSafeGuides();
        });
    }
    
    if (foldsToggle) {
        foldsToggle.addEventListener('change', (e) => {
            guideState.folds = e.target.checked;
            updateGuideVisibility();
        });
    }
    
    if (rulerToggle) {
        rulerToggle.addEventListener('change', (e) => {
            guideState.ruler = e.target.checked;
            updateGuideVisibility();
            // Show/hide submenu
            if (rulerSubmenu) {
                rulerSubmenu.hidden = !e.target.checked;
            }
        });
    }
    
    if (rulerLabelsToggle) {
        rulerLabelsToggle.addEventListener('change', (e) => {
            guideState.rulerLabels = e.target.checked;
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
        scaledWidth + (bleedMargin * 2 * SCALE_FACTOR),
        scaledHeight + (bleedMargin * 2 * SCALE_FACTOR),
        GUIDE_COLORS.bleed,
        0
    );
    safeLines = createRectangleGuide(
        scaledWidth - (safeMargin * 2 * SCALE_FACTOR),
        scaledHeight - (safeMargin * 2 * SCALE_FACTOR),
        GUIDE_COLORS.safe,
        0
    );
    foldLines = createFoldGuides(panelConfig);
    
    // Create ruler guides
    const rulerResult = createRulerGuides(size);
    rulerGroup = rulerResult.ruler;
    rulerLabelsGroup = rulerResult.labels;
    
    // Add to group
    guideGroup.add(trimLines);
    guideGroup.add(bleedLines);
    guideGroup.add(safeLines);
    guideGroup.add(foldLines);
    guideGroup.add(rulerGroup);
    guideGroup.add(rulerLabelsGroup);
    
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
 * Create ruler guides with tick marks and labels
 * @param {Object} size - Paper size { width, height }
 * @returns {Object} { ruler: THREE.Group, labels: THREE.Group }
 */
function createRulerGuides(size) {
    const rulerColor = getRulerColor();
    const rulerGroup = new THREE.Group();
    rulerGroup.name = 'ruler';
    
    const labelsGroup = new THREE.Group();
    labelsGroup.name = 'ruler-labels';
    
    const scaledWidth = size.width * SCALE_FACTOR;
    const scaledHeight = size.height * SCALE_FACTOR;
    const halfWidth = scaledWidth / 2;
    const halfHeight = scaledHeight / 2;
    
    // Ruler settings
    const majorTickInterval = 1; // Every 1 inch
    const minorTickInterval = 0.5; // Every 0.5 inch
    const majorTickSize = 0.15;
    const minorTickSize = 0.08;
    const rulerOffset = 0.05; // Offset from paper edge
    
    // Create horizontal ruler (top edge)
    const hRulerPoints = [
        new THREE.Vector3(-halfWidth, 0, -halfHeight - rulerOffset),
        new THREE.Vector3(halfWidth, 0, -halfHeight - rulerOffset)
    ];
    const hRulerGeom = new THREE.BufferGeometry().setFromPoints(hRulerPoints);
    const hRulerMat = new THREE.LineBasicMaterial({ color: rulerColor, transparent: true, opacity: 0.8 });
    rulerGroup.add(new THREE.Line(hRulerGeom, hRulerMat));
    
    // Create vertical ruler (left edge)
    const vRulerPoints = [
        new THREE.Vector3(-halfWidth - rulerOffset, 0, -halfHeight),
        new THREE.Vector3(-halfWidth - rulerOffset, 0, halfHeight)
    ];
    const vRulerGeom = new THREE.BufferGeometry().setFromPoints(vRulerPoints);
    const vRulerMat = new THREE.LineBasicMaterial({ color: rulerColor, transparent: true, opacity: 0.8 });
    rulerGroup.add(new THREE.Line(vRulerGeom, vRulerMat));
    
    // Create tick marks and labels for horizontal ruler (width)
    for (let i = 0; i <= size.width; i += minorTickInterval) {
        const x = -halfWidth + (i * SCALE_FACTOR);
        const isMajor = i % majorTickInterval === 0;
        const tickSize = isMajor ? majorTickSize : minorTickSize;
        
        // Create tick mark
        const tickPoints = [
            new THREE.Vector3(x, 0, -halfHeight - rulerOffset),
            new THREE.Vector3(x, 0, -halfHeight - rulerOffset - tickSize)
        ];
        const tickGeom = new THREE.BufferGeometry().setFromPoints(tickPoints);
        const tickMat = new THREE.LineBasicMaterial({ color: rulerColor, transparent: true, opacity: 0.8 });
        rulerGroup.add(new THREE.Line(tickGeom, tickMat));
        
        // Add label for major ticks
        if (isMajor && i > 0) {
            const label = createTextSprite(i.toString() + '"', rulerColor);
            label.position.set(x, 0.01, -halfHeight - rulerOffset - tickSize - 0.15);
            label.scale.set(0.3, 0.15, 1);
            labelsGroup.add(label);
        }
    }
    
    // Create tick marks and labels for vertical ruler (height)
    for (let i = 0; i <= size.height; i += minorTickInterval) {
        const z = -halfHeight + (i * SCALE_FACTOR);
        const isMajor = i % majorTickInterval === 0;
        const tickSize = isMajor ? majorTickSize : minorTickSize;
        
        // Create tick mark
        const tickPoints = [
            new THREE.Vector3(-halfWidth - rulerOffset, 0, z),
            new THREE.Vector3(-halfWidth - rulerOffset - tickSize, 0, z)
        ];
        const tickGeom = new THREE.BufferGeometry().setFromPoints(tickPoints);
        const tickMat = new THREE.LineBasicMaterial({ color: rulerColor, transparent: true, opacity: 0.8 });
        rulerGroup.add(new THREE.Line(tickGeom, tickMat));
        
        // Add label for major ticks
        if (isMajor && i > 0) {
            const label = createTextSprite(i.toString() + '"', rulerColor);
            label.position.set(-halfWidth - rulerOffset - tickSize - 0.2, 0.01, z);
            label.scale.set(0.3, 0.15, 1);
            labelsGroup.add(label);
        }
    }
    
    // Add dimension labels at the ends
    const widthLabel = createTextSprite(size.width.toFixed(2) + '"', rulerColor);
    widthLabel.position.set(0, 0.01, -halfHeight - rulerOffset - majorTickSize - 0.35);
    widthLabel.scale.set(0.5, 0.25, 1);
    labelsGroup.add(widthLabel);
    
    const heightLabel = createTextSprite(size.height.toFixed(2) + '"', rulerColor);
    heightLabel.position.set(-halfWidth - rulerOffset - majorTickSize - 0.4, 0.01, 0);
    heightLabel.scale.set(0.5, 0.25, 1);
    labelsGroup.add(heightLabel);
    
    return { ruler: rulerGroup, labels: labelsGroup };
}

// High-DPI scale for crisp text when zoomed
const TEXTURE_DPI_SCALE = 4;

/**
 * Create a text sprite for labels (high-res for sharp rendering when zoomed)
 * @param {string} text - Text to display
 * @param {number} color - Color of text
 * @returns {THREE.Sprite}
 */
function createTextSprite(text, color) {
    const baseWidth = 128;
    const baseHeight = 64;
    const canvas = document.createElement('canvas');
    canvas.width = baseWidth * TEXTURE_DPI_SCALE;
    canvas.height = baseHeight * TEXTURE_DPI_SCALE;
    const context = canvas.getContext('2d');
    
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    const cssColor = '#' + color.toString(16).padStart(6, '0');
    context.fillStyle = cssColor;
    context.font = `bold ${32 * TEXTURE_DPI_SCALE}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });
    
    return new THREE.Sprite(material);
}

/**
 * Update ruler colors when theme changes (dark purple in light mode, lighter purple in dark)
 */
export function updateRulerColors() {
    if (!guideGroup || !currentSize) return;
    if (!rulerGroup || !rulerLabelsGroup) return;

    const disposeGroup = (group) => {
        group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    };

    guideGroup.remove(rulerGroup);
    guideGroup.remove(rulerLabelsGroup);
    disposeGroup(rulerGroup);
    disposeGroup(rulerLabelsGroup);

    const rulerResult = createRulerGuides(currentSize);
    rulerGroup = rulerResult.ruler;
    rulerLabelsGroup = rulerResult.labels;
    guideGroup.add(rulerGroup);
    guideGroup.add(rulerLabelsGroup);
    updateGuideVisibility();
}

/**
 * Update visibility of all guides based on state
 */
function updateGuideVisibility() {
    if (trimLines) trimLines.visible = guideState.trim;
    if (bleedLines) bleedLines.visible = guideState.bleed;
    if (safeLines) safeLines.visible = guideState.safe;
    if (foldLines) foldLines.visible = guideState.folds;
    if (rulerGroup) rulerGroup.visible = guideState.ruler;
    if (rulerLabelsGroup) rulerLabelsGroup.visible = guideState.ruler && guideState.rulerLabels;
}

/**
 * Rebuild bleed and safe guides with current margin values
 */
function updateBleedSafeGuides() {
    if (!currentSize || !guideGroup) return;
    
    const scaledWidth = currentSize.width * SCALE_FACTOR;
    const scaledHeight = currentSize.height * SCALE_FACTOR;
    
    if (bleedLines) {
        guideGroup.remove(bleedLines);
        if (bleedLines.geometry) bleedLines.geometry.dispose();
        if (bleedLines.material) bleedLines.material.dispose();
    }
    bleedLines = createRectangleGuide(
        scaledWidth + (bleedMargin * 2 * SCALE_FACTOR),
        scaledHeight + (bleedMargin * 2 * SCALE_FACTOR),
        GUIDE_COLORS.bleed,
        0
    );
    bleedLines.visible = guideState.bleed;
    guideGroup.add(bleedLines);
    
    if (safeLines) {
        guideGroup.remove(safeLines);
        if (safeLines.geometry) safeLines.geometry.dispose();
        if (safeLines.material) safeLines.material.dispose();
    }
    safeLines = createRectangleGuide(
        scaledWidth - (safeMargin * 2 * SCALE_FACTOR),
        scaledHeight - (safeMargin * 2 * SCALE_FACTOR),
        GUIDE_COLORS.safe,
        0
    );
    safeLines.visible = guideState.safe;
    guideGroup.add(safeLines);
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
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
        guideGroup = null;
    }
    trimLines = null;
    bleedLines = null;
    safeLines = null;
    foldLines = null;
    rulerGroup = null;
    rulerLabelsGroup = null;
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
