/**
 * Animation Module
 * Handles fold/unfold animations with easing and controls
 */

import { getPaperGroup, getPanelMeshes } from './foldMesh.js';
import { getCurrentFoldType, getCurrentOrientation, isVerticalOrientation } from './foldCalculator.js';

// Animation state
let currentFoldProgress = 0; // 0 = unfolded, 1 = fully folded
let targetFoldProgress = 0;
let isAnimating = false;
let animationSpeed = 1;
let animationDirection = 1; // 1 = folding, -1 = unfolding
let isPlaying = false;
let animationFrameId = null;

// Callbacks
let onProgressUpdateCallback = null;

// Animation timing
const BASE_ANIMATION_DURATION = 2000; // 2 seconds at 1x speed

// Maximum fold progress (0.8 = 80%) to prevent panel clipping
const MAX_FOLD_PROGRESS = 0.8;

/**
 * Initialize the animation system
 * @param {Function} onProgressUpdate - Callback when progress changes
 */
export function initAnimations(onProgressUpdate) {
    onProgressUpdateCallback = onProgressUpdate;
    
    // Setup UI controls
    setupControls();
    
    // Start animation loop
    startAnimationLoop();
}

/**
 * Setup animation controls
 */
function setupControls() {
    const foldBtn = document.getElementById('btn-fold');
    const unfoldBtn = document.getElementById('btn-unfold');
    const playPauseBtn = document.getElementById('btn-play-pause');
    const progressSlider = document.getElementById('fold-progress');
    const speedSlider = document.getElementById('animation-speed');
    const progressLabel = document.getElementById('fold-progress-label');
    const speedLabel = document.getElementById('speed-label');
    
    // Fold button
    foldBtn.addEventListener('click', () => {
        animateTo(1);
    });
    
    // Unfold button
    unfoldBtn.addEventListener('click', () => {
        animateTo(0);
    });
    
    // Play/Pause button
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            pause();
        } else {
            playToggle();
        }
    });
    
    // Progress slider
    progressSlider.addEventListener('input', (e) => {
        const progress = parseInt(e.target.value) / 100;
        setFoldProgress(progress, false);
        progressLabel.textContent = `${e.target.value}%`;
    });
    
    // Speed slider
    speedSlider.addEventListener('input', (e) => {
        animationSpeed = parseFloat(e.target.value);
        speedLabel.textContent = `${animationSpeed.toFixed(1)}x`;
    });
}

/**
 * Start the animation loop
 */
function startAnimationLoop() {
    let lastTime = performance.now();
    
    function loop(currentTime) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        if (isAnimating) {
            updateAnimation(deltaTime);
        }
        
        animationFrameId = requestAnimationFrame(loop);
    }
    
    animationFrameId = requestAnimationFrame(loop);
}

/**
 * Update animation progress
 * @param {number} deltaTime - Time since last frame in ms
 */
function updateAnimation(deltaTime) {
    if (!isAnimating) return;
    
    // Calculate progress change
    const progressPerMs = animationSpeed / BASE_ANIMATION_DURATION;
    const progressChange = progressPerMs * deltaTime * animationDirection;
    
    currentFoldProgress += progressChange;
    
    // Clamp progress
    if (currentFoldProgress >= 1) {
        currentFoldProgress = 1;
        if (isPlaying) {
            // Reverse direction for continuous play
            animationDirection = -1;
        } else {
            isAnimating = false;
        }
    } else if (currentFoldProgress <= 0) {
        currentFoldProgress = 0;
        if (isPlaying) {
            // Reverse direction for continuous play
            animationDirection = 1;
        } else {
            isAnimating = false;
        }
    }
    
    // Apply fold to mesh
    applyFoldProgress(currentFoldProgress);
    
    // Update UI
    updateProgressUI(currentFoldProgress);
}

/**
 * Apply fold progress to the paper mesh
 * @param {number} progress - 0 to 1 (slider value)
 */
function applyFoldProgress(progress) {
    const panelMeshes = getPanelMeshes();
    if (!panelMeshes || panelMeshes.length === 0) return;
    
    const foldType = getCurrentFoldType();
    const isVertical = isVerticalOrientation();
    
    // Cap the actual fold progress at MAX_FOLD_PROGRESS to prevent clipping
    // Slider shows 0-100%, but actual fold is 0-80%
    const cappedProgress = progress * MAX_FOLD_PROGRESS;
    const easedProgress = easeInOutCubic(cappedProgress);
    
    // Apply different folding logic based on fold type
    switch (foldType) {
        case 'bi-fold':
            applyBiFold(panelMeshes, easedProgress, isVertical);
            break;
            
        case 'tri-fold-z':
            applyTriFoldZ(panelMeshes, easedProgress, isVertical);
            break;
            
        case 'tri-fold-roll':
            applyTriFoldRoll(panelMeshes, easedProgress, isVertical);
            break;
            
        case 'gate-fold':
            applyGateFold(panelMeshes, easedProgress, isVertical);
            break;
    }
}

// Base rotation to lie flat (must match foldMesh.js)
const BASE_ROTATION_X = Math.PI / 2;

/**
 * Apply bi-fold animation
 * @param {Array} panelMeshes 
 * @param {number} progress 
 * @param {boolean} isVertical 
 */
function applyBiFold(panelMeshes, progress, isVertical) {
    if (panelMeshes.length < 2) return;
    
    const foldAngle = progress * Math.PI;
    
    // Panel 0 is base (doesn't move)
    // Panel 1 folds over panel 0
    const panel1 = panelMeshes[1];
    if (panel1 && panel1.pivot) {
        if (isVertical) {
            // Vertical fold: rotate around Y axis (left-right fold)
            panel1.pivot.rotation.y = foldAngle;
        } else {
            // Horizontal fold: rotate around X axis (top-bottom fold)
            // ADD to base rotation, don't replace it
            panel1.pivot.rotation.x = BASE_ROTATION_X + foldAngle;
        }
        // Add slight height offset to prevent Z-fighting
        panel1.pivot.position.y = progress * PANEL_Z_OFFSET;
    }
}

// Z-offset to prevent panel clipping during folds
const PANEL_Z_OFFSET = 0.05;

/**
 * Apply tri-fold Z (accordion) animation
 * @param {Array} panelMeshes 
 * @param {number} progress 
 * @param {boolean} isVertical
 */
function applyTriFoldZ(panelMeshes, progress, isVertical) {
    if (panelMeshes.length < 3) return;
    
    const foldAngle = progress * Math.PI;
    
    // Panel 0 is base
    // Panel 1 folds backward (down, away from viewer)
    // Panel 2 folds forward (up, toward viewer, relative to panel 1)
    
    const panel1 = panelMeshes[1];
    const panel2 = panelMeshes[2];
    
    if (panel1 && panel1.pivot) {
        if (isVertical) {
            panel1.pivot.rotation.y = -foldAngle; // Fold backward
        } else {
            panel1.pivot.rotation.x = -foldAngle; // Fold backward (horizontal) - child panels don't need base rotation
        }
        panel1.pivot.position.y = progress * PANEL_Z_OFFSET;
    }
    
    if (panel2 && panel2.pivot) {
        if (isVertical) {
            panel2.pivot.rotation.y = foldAngle; // Fold forward relative to panel 1
        } else {
            panel2.pivot.rotation.x = foldAngle; // Fold forward (horizontal)
        }
        panel2.pivot.position.y = progress * PANEL_Z_OFFSET * 2;
    }
}

/**
 * Apply tri-fold roll (letter fold) animation
 * @param {Array} panelMeshes 
 * @param {number} progress 
 * @param {boolean} isVertical
 */
function applyTriFoldRoll(panelMeshes, progress, isVertical) {
    if (panelMeshes.length < 3) return;
    
    // Panel 0 is base
    // Panel 2 (inner) folds first, then panel 1 folds over
    // Use staged animation: panel 2 leads, panel 1 follows
    
    const panel1Progress = Math.max(0, (progress - 0.2) / 0.8);
    const panel2Progress = Math.min(1, progress / 0.8);
    
    const easedPanel1 = easeInOutCubic(panel1Progress);
    const easedPanel2 = easeInOutCubic(panel2Progress);
    
    const panel1 = panelMeshes[1];
    const panel2 = panelMeshes[2];
    
    if (panel2 && panel2.pivot) {
        if (isVertical) {
            panel2.pivot.rotation.y = -easedPanel2 * Math.PI;
        } else {
            panel2.pivot.rotation.x = -easedPanel2 * Math.PI;
        }
        // Panel 2 (inner) gets base offset - ends up between panel 0 and panel 1
        // Use nestOffset if provided in panel config
        const nestOffset = (panel2.pivot.userData.panelConfig && panel2.pivot.userData.panelConfig.nestOffset) || 0;
        panel2.pivot.position.y = easedPanel2 * (PANEL_Z_OFFSET + nestOffset);
    }
    
    if (panel1 && panel1.pivot) {
        if (isVertical) {
            panel1.pivot.rotation.y = -easedPanel1 * Math.PI;
        } else {
            panel1.pivot.rotation.x = -easedPanel1 * Math.PI;
        }
        // Panel 1 (outer) needs to be above panel 2 during folding
        // Only apply height offset when there's actual progress to avoid starting displaced
        if (progress > 0) {
            // Ensure panel 1 is always above panel 2
            // Use a very small initial offset and scale it with progress to prevent the 4% jump
            const panel1YOffset = (PANEL_Z_OFFSET * 2 * easedPanel1) + (easedPanel1 * PANEL_Z_OFFSET);
            panel1.pivot.position.y = panel1YOffset;
        } else {
            panel1.pivot.position.y = 0;
        }
    }
}

/**
 * Apply gate fold animation
 * @param {Array} panelMeshes 
 * @param {number} progress 
 * @param {boolean} isVertical
 */
function applyGateFold(panelMeshes, progress, isVertical) {
    if (panelMeshes.length < 3) return;
    
    const foldAngle = progress * Math.PI;
    
    // Panel 1 is center (base)
    // Panel 0 (left/top) folds inward
    // Panel 2 (right/bottom) folds inward
    
    const panel0 = panelMeshes[0];
    const panel2 = panelMeshes[2];
    
    if (panel0 && panel0.pivot) {
        if (isVertical) {
            panel0.pivot.rotation.y = -foldAngle; // Fold right (inward)
            // Add height offset (Y) to prevent clipping with center panel
            const yCurve = Math.sin(progress * Math.PI) * 0.2;
            panel0.pivot.position.y = (progress * PANEL_Z_OFFSET) + yCurve;
            panel0.pivot.position.z = 0;
        } else {
            panel0.pivot.rotation.x = -foldAngle; // Fold down (inward)
            // Use a much smaller curve and offset for horizontal
            const yCurve = Math.sin(progress * Math.PI) * 0.05; // Reduced from 0.4
            panel0.pivot.position.z = -((progress * PANEL_Z_OFFSET) + yCurve);
        }
    }
    
    if (panel2 && panel2.pivot) {
        if (isVertical) {
            panel2.pivot.rotation.y = foldAngle; // Fold left (inward)
            // Panel 2 on top of panel 0 (higher Y-offset)
            const yCurve = Math.sin(progress * Math.PI) * 0.3;
            panel2.pivot.position.y = (progress * PANEL_Z_OFFSET * 2.5) + yCurve;
            panel2.pivot.position.z = 0;
        } else {
            panel2.pivot.rotation.x = foldAngle; // Fold up (inward)
            // Use a much smaller curve and offset for horizontal
            const yCurve = Math.sin(progress * Math.PI) * 0.08; // Reduced from 0.6
            panel2.pivot.position.z = -((progress * PANEL_Z_OFFSET * 2.1) + yCurve);
        }
    }
}

/**
 * Easing function - cubic ease in/out
 * @param {number} t - Progress 0 to 1
 * @returns {number} Eased progress
 */
function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Update progress UI elements
 * @param {number} progress 
 */
function updateProgressUI(progress) {
    const progressSlider = document.getElementById('fold-progress');
    const progressLabel = document.getElementById('fold-progress-label');
    
    const percentValue = Math.round(progress * 100);
    progressSlider.value = percentValue;
    progressLabel.textContent = `${percentValue}%`;
    
    if (onProgressUpdateCallback) {
        onProgressUpdateCallback(progress);
    }
}

/**
 * Animate to a target progress
 * @param {number} target - Target progress 0 to 1
 */
export function animateTo(target) {
    targetFoldProgress = target;
    animationDirection = target > currentFoldProgress ? 1 : -1;
    isAnimating = true;
    isPlaying = false;
    updatePlayPauseUI();
}

/**
 * Set fold progress directly (no animation)
 * @param {number} progress - Progress 0 to 1
 * @param {boolean} updateUI - Whether to update UI
 */
export function setFoldProgress(progress, updateUI = true) {
    currentFoldProgress = Math.max(0, Math.min(1, progress));
    applyFoldProgress(currentFoldProgress);
    
    if (updateUI) {
        updateProgressUI(currentFoldProgress);
    }
}

/**
 * Play continuous animation (toggle between fold/unfold)
 */
export function playToggle() {
    isPlaying = true;
    isAnimating = true;
    
    // Set direction based on current progress
    if (currentFoldProgress >= 1) {
        animationDirection = -1;
    } else if (currentFoldProgress <= 0) {
        animationDirection = 1;
    }
    // Otherwise keep current direction
    
    updatePlayPauseUI();
}

/**
 * Pause animation
 */
export function pause() {
    isPlaying = false;
    isAnimating = false;
    updatePlayPauseUI();
}

/**
 * Update play/pause button UI
 */
function updatePlayPauseUI() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    if (isPlaying) {
        playIcon.hidden = true;
        pauseIcon.hidden = false;
    } else {
        playIcon.hidden = false;
        pauseIcon.hidden = true;
    }
}

/**
 * Set animation speed
 * @param {number} speed - Speed multiplier
 */
export function setAnimationSpeed(speed) {
    animationSpeed = speed;
}

/**
 * Get current fold progress
 * @returns {number}
 */
export function getFoldProgress() {
    return currentFoldProgress;
}

/**
 * Reset animation state
 */
export function resetAnimation() {
    currentFoldProgress = 0;
    targetFoldProgress = 0;
    isAnimating = false;
    isPlaying = false;
    animationDirection = 1;
    
    // Reset all panel positions and rotations
    const panelMeshes = getPanelMeshes();
    if (panelMeshes) {
        panelMeshes.forEach((meshData, index) => {
            if (meshData.pivot) {
                // Only reset rotation for child panels (non-root)
                // Root panels keep their base rotation from foldMesh.js
                if (meshData.pivot.userData && meshData.pivot.userData.isRoot === false) {
                    meshData.pivot.rotation.x = 0;
                    meshData.pivot.rotation.y = 0;
                }
                meshData.pivot.position.z = 0;
            }
        });
    }
    
    applyFoldProgress(0);
    updateProgressUI(0);
    updatePlayPauseUI();
}

/**
 * Stop animation loop
 */
export function stopAnimations() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}
