/**
 * Size Parser Module
 * Handles parsing of fractional measurements and size presets
 */

// Preset paper sizes (in inches)
const SIZE_PRESETS = {
    'letter': { width: 8.5, height: 11, label: '8.5" × 11" (Letter)' },
    'legal': { width: 8.5, height: 14, label: '8.5" × 14" (Legal)' },
    'tabloid': { width: 11, height: 17, label: '11" × 17" (Tabloid)' },
    'a4': { width: 8.27, height: 11.69, label: '210mm × 297mm (A4)' },
    'a3': { width: 11.69, height: 16.54, label: '297mm × 420mm (A3)' },
    'custom': { width: 0, height: 0, label: 'Custom Size...' }
};

// Current size state
let currentSize = { ...SIZE_PRESETS['letter'] };

// Callback for size changes
let onSizeChangeCallback = null;

/**
 * Initialize the size parser
 * @param {Function} onSizeChange - Callback when size changes
 */
export function initSizeParser(onSizeChange) {
    onSizeChangeCallback = onSizeChange;
    
    const sizePreset = document.getElementById('size-preset');
    const customSection = document.getElementById('custom-size-section');
    const applyBtn = document.getElementById('apply-custom-size');
    
    // Handle preset selection
    sizePreset.addEventListener('change', (e) => {
        const preset = e.target.value;
        
        if (preset === 'custom') {
            customSection.hidden = false;
        } else {
            customSection.hidden = true;
            setSize(SIZE_PRESETS[preset].width, SIZE_PRESETS[preset].height);
        }
    });
    
    // Handle custom size apply
    applyBtn.addEventListener('click', () => {
        const widthInput = document.getElementById('custom-width').value;
        const heightInput = document.getElementById('custom-height').value;
        
        const width = parseFractionalMeasurement(widthInput);
        const height = parseFractionalMeasurement(heightInput);
        
        if (width > 0 && height > 0) {
            setSize(width, height);
        } else {
            alert('Please enter valid dimensions. Examples: 8.5", 16 5/16", 11"');
        }
    });
    
    // Initialize display
    updateSizeDisplay();
}

/**
 * Parse a fractional measurement string to decimal inches
 * Supports formats like: "8.5", "8.5"", "16 5/16", "16 5/16"", etc.
 * @param {string} input - The measurement string
 * @returns {number} The measurement in decimal inches, or 0 if invalid
 */
export function parseFractionalMeasurement(input) {
    if (!input || typeof input !== 'string') return 0;
    
    // Clean the input - remove quotes, extra spaces, and convert to lowercase
    let cleaned = input.trim().replace(/["'"]/g, '').replace(/\s+/g, ' ');
    
    // Handle mm conversion (rough approximation)
    if (cleaned.toLowerCase().includes('mm')) {
        const mmValue = parseFloat(cleaned);
        if (!isNaN(mmValue)) {
            return mmValue / 25.4; // Convert mm to inches
        }
        return 0;
    }
    
    // Handle cm conversion
    if (cleaned.toLowerCase().includes('cm')) {
        const cmValue = parseFloat(cleaned);
        if (!isNaN(cmValue)) {
            return cmValue / 2.54; // Convert cm to inches
        }
        return 0;
    }
    
    // Try to parse as a simple decimal first
    const simpleNum = parseFloat(cleaned);
    if (!isNaN(simpleNum) && !cleaned.includes('/') && !cleaned.includes(' ')) {
        return simpleNum;
    }
    
    // Parse mixed fraction (e.g., "16 5/16")
    const mixedFractionRegex = /^(\d+)\s+(\d+)\/(\d+)$/;
    const match = cleaned.match(mixedFractionRegex);
    
    if (match) {
        const whole = parseInt(match[1], 10);
        const numerator = parseInt(match[2], 10);
        const denominator = parseInt(match[3], 10);
        
        if (denominator !== 0) {
            return whole + (numerator / denominator);
        }
    }
    
    // Parse simple fraction (e.g., "5/16")
    const simpleFractionRegex = /^(\d+)\/(\d+)$/;
    const fractionMatch = cleaned.match(simpleFractionRegex);
    
    if (fractionMatch) {
        const numerator = parseInt(fractionMatch[1], 10);
        const denominator = parseInt(fractionMatch[2], 10);
        
        if (denominator !== 0) {
            return numerator / denominator;
        }
    }
    
    return 0;
}

/**
 * Format a decimal measurement to a readable string
 * @param {number} inches - The measurement in inches
 * @returns {string} Formatted string
 */
export function formatMeasurement(inches) {
    // Common fractions to check
    const fractions = [
        { denom: 16, tolerance: 0.03 },
        { denom: 8, tolerance: 0.06 },
        { denom: 4, tolerance: 0.12 },
        { denom: 2, tolerance: 0.25 }
    ];
    
    const whole = Math.floor(inches);
    const remainder = inches - whole;
    
    // Check if it's close to a common fraction
    for (const { denom, tolerance } of fractions) {
        for (let num = 1; num < denom; num++) {
            const fracValue = num / denom;
            if (Math.abs(remainder - fracValue) < tolerance) {
                // Simplify the fraction
                const gcd = greatestCommonDivisor(num, denom);
                const simplifiedNum = num / gcd;
                const simplifiedDenom = denom / gcd;
                
                if (whole > 0) {
                    return `${whole} ${simplifiedNum}/${simplifiedDenom}"`;
                } else {
                    return `${simplifiedNum}/${simplifiedDenom}"`;
                }
            }
        }
    }
    
    // If close to a whole number
    if (remainder < 0.03 || remainder > 0.97) {
        return `${Math.round(inches)}"`;
    }
    
    // Default to decimal
    return `${inches.toFixed(2)}"`;
}

/**
 * Calculate greatest common divisor
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
function greatestCommonDivisor(a, b) {
    return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/**
 * Set the current size
 * @param {number} width - Width in inches
 * @param {number} height - Height in inches
 */
function setSize(width, height) {
    currentSize = {
        width: width,
        height: height,
        label: `${formatMeasurement(width)} × ${formatMeasurement(height)}`
    };
    
    updateSizeDisplay();
    
    if (onSizeChangeCallback) {
        onSizeChangeCallback(getCurrentSize());
    }
}

/**
 * Update the size display
 */
function updateSizeDisplay() {
    const display = document.getElementById('current-size');
    display.textContent = currentSize.label;
}

/**
 * Get the current size
 * @returns {Object} Current size with width, height in inches
 */
export function getCurrentSize() {
    return {
        width: currentSize.width,
        height: currentSize.height,
        aspectRatio: currentSize.width / currentSize.height
    };
}

/**
 * Get all available presets
 * @returns {Object}
 */
export function getPresets() {
    return SIZE_PRESETS;
}
