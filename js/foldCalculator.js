/**
 * Fold Calculator Module
 * Calculates panel dimensions and fold configurations
 */

// Fold type definitions (orientation-agnostic)
const FOLD_TYPES = {
    'bi-fold': {
        name: 'Bi-Fold',
        panelCount: 2,
        description: '2 equal panels, folds in half'
    },
    'tri-fold-z': {
        name: 'Tri-Fold Z-Fold',
        panelCount: 3,
        description: '3 panels, accordion style (Z-shape)'
    },
    'tri-fold-roll': {
        name: 'Tri-Fold Roll',
        panelCount: 3,
        description: '3 panels, one folds in first (letter fold)'
    },
    'gate-fold': {
        name: 'Gate Fold',
        panelCount: 3,
        description: '2 outer panels fold to center'
    }
};

// Current fold configuration
let currentFoldType = 'bi-fold';
let currentOrientation = 'vertical'; // 'vertical' or 'horizontal'
let onFoldChangeCallback = null;

/**
 * Initialize the fold calculator
 * @param {Function} onFoldChange - Callback when fold type changes
 */
export function initFoldCalculator(onFoldChange) {
    onFoldChangeCallback = onFoldChange;
    
    const foldSelect = document.getElementById('fold-type');
    const orientationSelect = document.getElementById('fold-orientation');
    
    // Handle fold type change
    foldSelect.addEventListener('change', (e) => {
        currentFoldType = e.target.value;
        updateFoldDiagram();
        notifyFoldChange();
    });
    
    // Handle orientation change
    orientationSelect.addEventListener('change', (e) => {
        currentOrientation = e.target.value;
        updateFoldDiagram();
        notifyFoldChange();
    });
    
    // Initialize diagram
    updateFoldDiagram();
}

/**
 * Notify listeners of fold configuration change
 */
function notifyFoldChange() {
    if (onFoldChangeCallback) {
        onFoldChangeCallback(getCurrentFoldType());
    }
}

/**
 * Calculate panel layout for current fold type and size
 * @param {Object} size - Paper size { width, height }
 * @returns {Object} Panel configuration
 */
export function calculatePanels(size) {
    const foldType = FOLD_TYPES[currentFoldType];
    const isVertical = currentOrientation === 'vertical';
    
    // Determine the dimension to divide based on orientation
    // Vertical: divide width (left-right panels)
    // Horizontal: divide height (top-bottom panels)
    const totalLength = isVertical ? size.width : size.height;
    const panelHeight = isVertical ? size.height : size.width;
    
    let panels = [];
    
    switch (currentFoldType) {
        case 'bi-fold':
            panels = calculateBiFold(totalLength, panelHeight);
            break;
            
        case 'tri-fold-z':
            panels = calculateTriFoldZ(totalLength, panelHeight);
            break;
            
        case 'tri-fold-roll':
            panels = calculateTriFoldRoll(totalLength, panelHeight);
            break;
            
        case 'gate-fold':
            panels = calculateGateFold(totalLength, panelHeight);
            break;
            
        default:
            panels = calculateBiFold(totalLength, panelHeight);
    }
    
    return {
        foldType: currentFoldType,
        orientation: currentOrientation,
        foldInfo: foldType,
        panels: panels,
        totalWidth: size.width,
        totalHeight: size.height,
        isVertical: isVertical
    };
}

/**
 * Calculate bi-fold panels
 * @param {number} totalLength - Total length to divide
 * @param {number} panelHeight - Height of each panel (perpendicular dimension)
 * @returns {Array} Panel configurations
 */
function calculateBiFold(totalLength, panelHeight) {
    const panelWidth = totalLength / 2;
    
    return [
        {
            index: 0,
            width: panelWidth,
            height: panelHeight,
            offsetX: 0,
            pivotEdge: 'right',
            foldDirection: 1,
            foldAngle: Math.PI,
            isBase: true
        },
        {
            index: 1,
            width: panelWidth,
            height: panelHeight,
            offsetX: panelWidth,
            pivotEdge: 'left',
            foldDirection: -1,
            foldAngle: Math.PI,
            isBase: false
        }
    ];
}

/**
 * Calculate tri-fold Z (accordion) panels
 * @param {number} totalLength - Total length to divide
 * @param {number} panelHeight - Height of each panel
 * @returns {Array} Panel configurations
 */
function calculateTriFoldZ(totalLength, panelHeight) {
    const panelWidth = totalLength / 3;
    
    return [
        {
            index: 0,
            width: panelWidth,
            height: panelHeight,
            offsetX: 0,
            pivotEdge: 'right',
            foldDirection: 0,
            foldAngle: 0,
            isBase: true
        },
        {
            index: 1,
            width: panelWidth,
            height: panelHeight,
            offsetX: panelWidth,
            pivotEdge: 'left',
            foldDirection: -1, // Folds backward (toward back)
            foldAngle: Math.PI,
            isBase: false,
            parentIndex: 0
        },
        {
            index: 2,
            width: panelWidth,
            height: panelHeight,
            offsetX: panelWidth * 2,
            pivotEdge: 'left',
            foldDirection: 1, // Folds forward (toward front)
            foldAngle: Math.PI,
            isBase: false,
            parentIndex: 1
        }
    ];
}

/**
 * Calculate tri-fold roll (letter fold) panels
 * The rightmost panel folds in first, then the left panel folds over
 * @param {number} totalLength - Total length to divide
 * @param {number} panelHeight - Height of each panel
 * @returns {Array} Panel configurations
 */
function calculateTriFoldRoll(totalLength, panelHeight) {
    // Slightly smaller inner panel to nest properly
    const innerPanelWidth = totalLength / 3 - 0.1;
    const outerPanelWidth = totalLength / 3 + 0.05;
    const centerPanelWidth = totalLength - innerPanelWidth - outerPanelWidth;
    
    return [
        {
            index: 0,
            width: outerPanelWidth,
            height: panelHeight,
            offsetX: 0,
            pivotEdge: 'right',
            foldDirection: 0,
            foldAngle: 0,
            isBase: true
        },
        {
            index: 1,
            width: centerPanelWidth,
            height: panelHeight,
            offsetX: outerPanelWidth,
            pivotEdge: 'left',
            foldDirection: -1,
            foldAngle: Math.PI,
            isBase: false,
            parentIndex: 0
        },
        {
            index: 2,
            width: innerPanelWidth,
            height: panelHeight,
            offsetX: outerPanelWidth + centerPanelWidth,
            pivotEdge: 'left',
            foldDirection: -1, // Same direction as panel 1
            foldAngle: Math.PI,
            isBase: false,
            parentIndex: 1,
            nestOffset: 0.02 // Add slight offset to prevent Z-fighting when folded
        }
    ];
}

/**
 * Calculate gate fold panels
 * Two outer panels fold toward center
 * @param {number} totalLength - Total length to divide
 * @param {number} panelHeight - Height of each panel
 * @returns {Array} Panel configurations
 */
function calculateGateFold(totalLength, panelHeight) {
    const outerPanelWidth = totalLength / 4;
    const centerPanelWidth = totalLength / 2;
    
    return [
        {
            index: 0,
            width: outerPanelWidth,
            height: panelHeight,
            offsetX: 0,
            pivotEdge: 'right',
            foldDirection: -1, // Folds inward
            foldAngle: Math.PI,
            isBase: false,
            parentIndex: 1
        },
        {
            index: 1,
            width: centerPanelWidth,
            height: panelHeight,
            offsetX: outerPanelWidth,
            pivotEdge: 'center',
            foldDirection: 0,
            foldAngle: 0,
            isBase: true
        },
        {
            index: 2,
            width: outerPanelWidth,
            height: panelHeight,
            offsetX: outerPanelWidth + centerPanelWidth,
            pivotEdge: 'left',
            foldDirection: -1, // Folds inward
            foldAngle: Math.PI,
            isBase: false,
            parentIndex: 1
        }
    ];
}

/**
 * Update the fold diagram in the UI
 */
function updateFoldDiagram() {
    const container = document.getElementById('fold-diagram');
    const isVertical = currentOrientation === 'vertical';
    
    // Create SVG diagram
    let svg = '';
    const svgWidth = 200;
    const svgHeight = 60;
    
    switch (currentFoldType) {
        case 'bi-fold':
            svg = createBiFoldDiagram(svgWidth, svgHeight, isVertical);
            break;
        case 'tri-fold-z':
            svg = createTriFoldZDiagram(svgWidth, svgHeight, isVertical);
            break;
        case 'tri-fold-roll':
            svg = createTriFoldRollDiagram(svgWidth, svgHeight, isVertical);
            break;
        case 'gate-fold':
            svg = createGateFoldDiagram(svgWidth, svgHeight, isVertical);
            break;
    }
    
    container.innerHTML = svg;
}

/**
 * Create bi-fold diagram SVG
 */
function createBiFoldDiagram(width, height, isVertical) {
    const color = 'var(--accent-primary)';
    const lineColor = 'var(--text-muted)';
    
    if (isVertical) {
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="10" y="10" width="${width/2 - 15}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${width/2 + 5}" y="10" width="${width/2 - 15}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <line x1="${width/2}" y1="5" x2="${width/2}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <text x="${width/2}" y="${height - 2}" text-anchor="middle" 
                    fill="${lineColor}" font-size="10">fold</text>
            </svg>
        `;
    } else {
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="30" y="5" width="${width - 60}" height="${height/2 - 8}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${height/2 + 3}" width="${width - 60}" height="${height/2 - 8}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <line x1="25" y1="${height/2}" x2="${width - 25}" y2="${height/2}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
            </svg>
        `;
    }
}

/**
 * Create tri-fold Z diagram SVG
 */
function createTriFoldZDiagram(width, height, isVertical) {
    const color = 'var(--accent-primary)';
    const lineColor = 'var(--text-muted)';
    
    if (isVertical) {
        const panelWidth = (width - 30) / 3;
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="10" y="10" width="${panelWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${15 + panelWidth}" y="10" width="${panelWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${20 + panelWidth * 2}" y="10" width="${panelWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <line x1="${12.5 + panelWidth}" y1="5" x2="${12.5 + panelWidth}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <line x1="${17.5 + panelWidth * 2}" y1="5" x2="${17.5 + panelWidth * 2}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
            </svg>
        `;
    } else {
        const panelHeight = (height - 20) / 3;
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="30" y="5" width="${width - 60}" height="${panelHeight - 3}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${8 + panelHeight}" width="${width - 60}" height="${panelHeight - 3}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${11 + panelHeight * 2}" width="${width - 60}" height="${panelHeight - 3}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <line x1="25" y1="${6.5 + panelHeight}" x2="${width - 25}" y2="${6.5 + panelHeight}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <line x1="25" y1="${9.5 + panelHeight * 2}" x2="${width - 25}" y2="${9.5 + panelHeight * 2}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
            </svg>
        `;
    }
}

/**
 * Create tri-fold roll diagram SVG
 */
function createTriFoldRollDiagram(width, height, isVertical) {
    const color = 'var(--accent-primary)';
    const lineColor = 'var(--text-muted)';
    
    if (isVertical) {
        const panelWidth = (width - 30) / 3;
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="10" y="10" width="${panelWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${15 + panelWidth}" y="10" width="${panelWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${20 + panelWidth * 2}" y="10" width="${panelWidth - 5}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2" stroke-dasharray="4"/>
                <line x1="${12.5 + panelWidth}" y1="5" x2="${12.5 + panelWidth}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <line x1="${17.5 + panelWidth * 2}" y1="5" x2="${17.5 + panelWidth * 2}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <text x="${22 + panelWidth * 2.5}" y="${height/2 + 3}" 
                    fill="${lineColor}" font-size="8">inner</text>
            </svg>
        `;
    } else {
        const panelHeight = (height - 20) / 3;
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="30" y="5" width="${width - 60}" height="${panelHeight - 3}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${8 + panelHeight}" width="${width - 60}" height="${panelHeight - 3}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${11 + panelHeight * 2}" width="${width - 60}" height="${panelHeight - 6}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2" stroke-dasharray="4"/>
                <line x1="25" y1="${6.5 + panelHeight}" x2="${width - 25}" y2="${6.5 + panelHeight}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <line x1="25" y1="${9.5 + panelHeight * 2}" x2="${width - 25}" y2="${9.5 + panelHeight * 2}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <text x="${width - 20}" y="${13 + panelHeight * 2.5}" 
                    fill="${lineColor}" font-size="7">inner</text>
            </svg>
        `;
    }
}

/**
 * Create gate fold diagram SVG
 */
function createGateFoldDiagram(width, height, isVertical) {
    const color = 'var(--accent-primary)';
    const lineColor = 'var(--text-muted)';
    
    if (isVertical) {
        const outerWidth = (width - 30) / 4;
        const centerWidth = (width - 30) / 2;
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="10" y="10" width="${outerWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${15 + outerWidth}" y="10" width="${centerWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="${20 + outerWidth + centerWidth}" y="10" width="${outerWidth}" height="${height - 20}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <line x1="${12.5 + outerWidth}" y1="5" x2="${12.5 + outerWidth}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <line x1="${17.5 + outerWidth + centerWidth}" y1="5" x2="${17.5 + outerWidth + centerWidth}" y2="${height - 5}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <text x="${15 + outerWidth + centerWidth/2}" y="${height - 2}" text-anchor="middle" 
                    fill="${lineColor}" font-size="8">center</text>
            </svg>
        `;
    } else {
        const outerHeight = (height - 16) / 4;
        const centerHeight = (height - 16) / 2;
        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                <rect x="30" y="5" width="${width - 60}" height="${outerHeight}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${8 + outerHeight}" width="${width - 60}" height="${centerHeight}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <rect x="30" y="${11 + outerHeight + centerHeight}" width="${width - 60}" height="${outerHeight}" 
                    fill="none" stroke="${color}" stroke-width="2" rx="2"/>
                <line x1="25" y1="${6.5 + outerHeight}" x2="${width - 25}" y2="${6.5 + outerHeight}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <line x1="25" y1="${9.5 + outerHeight + centerHeight}" x2="${width - 25}" y2="${9.5 + outerHeight + centerHeight}" 
                    stroke="${lineColor}" stroke-width="1" stroke-dasharray="4"/>
                <text x="${width/2}" y="${10 + outerHeight + centerHeight/2}" text-anchor="middle" 
                    fill="${lineColor}" font-size="8">center</text>
            </svg>
        `;
    }
}

/**
 * Get the current fold type
 * @returns {string}
 */
export function getCurrentFoldType() {
    return currentFoldType;
}

/**
 * Get the current orientation
 * @returns {string} 'vertical' or 'horizontal'
 */
export function getCurrentOrientation() {
    return currentOrientation;
}

/**
 * Check if current orientation is vertical
 * @returns {boolean}
 */
export function isVerticalOrientation() {
    return currentOrientation === 'vertical';
}

/**
 * Get fold type info
 * @param {string} type - Fold type key
 * @returns {Object}
 */
export function getFoldTypeInfo(type) {
    return FOLD_TYPES[type] || FOLD_TYPES['bi-fold'];
}

/**
 * Get all available fold types
 * @returns {Object}
 */
export function getAllFoldTypes() {
    return FOLD_TYPES;
}
