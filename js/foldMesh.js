/**
 * Fold Mesh Module
 * Creates 3D paper geometry with proper UV mapping and fold pivots
 */

import * as THREE from 'three';
import { calculatePanels } from './foldCalculator.js';

// Paper thickness for slight 3D effect
const PAPER_THICKNESS = 0.01;

// Scale factor to fit nicely in scene
const SCALE_FACTOR = 0.5;

// Store for current mesh group
let paperGroup = null;
let panelMeshes = [];

/**
 * Create the folded paper mesh
 * @param {Object} size - Paper size { width, height }
 * @param {Object} textures - { front: THREE.Texture, back: THREE.Texture }
 * @param {Object} options - { reflectFrontH, reflectBackH, reflectFrontV, reflectBackV }
 * @returns {THREE.Group} The paper mesh group
 */
export function createFoldMesh(size, textures, options = {}) {
    const { reflectFrontH = false, reflectBackH = true, reflectFrontV = false, reflectBackV = false } = options;
    // Calculate panel configuration
    const panelConfig = calculatePanels(size);
    
    // Create a group to hold all panels
    paperGroup = new THREE.Group();
    panelMeshes = [];
    
    // Create each panel
    panelConfig.panels.forEach((panel, index) => {
        const panelMesh = createPanel(panel, panelConfig, textures, { reflectFrontH, reflectBackH, reflectFrontV, reflectBackV });
        panelMeshes.push(panelMesh);
    });
    
    // Build the hierarchy (child panels attach to parent panels)
    buildPanelHierarchy(panelConfig.panels);
    
    // Add root panels to the group
    panelMeshes.forEach((mesh, index) => {
        const panel = panelConfig.panels[index];
        if (panel.isBase || panel.parentIndex === undefined) {
            if (!mesh.parent || mesh.parent === paperGroup) {
                paperGroup.add(mesh.pivot || mesh);
            }
        }
    });
    
    // Center the group
    centerGroup(paperGroup, panelConfig);
    
    // Store config for animation reference
    paperGroup.userData.panelConfig = panelConfig;
    paperGroup.userData.panelMeshes = panelMeshes;
    
    return paperGroup;
}

/**
 * Apply horizontal and/or vertical flip to a texture (clone to avoid mutating original)
 * @param {THREE.Texture} texture - Source texture
 * @param {boolean} flipH - Flip horizontally
 * @param {boolean} flipV - Flip vertically
 * @returns {THREE.Texture} Cloned texture with flip applied, or null
 */
function cloneTextureWithFlip(texture, flipH = true, flipV = false) {
    if (!texture) return null;
    const clone = texture.clone();
    clone.wrapS = THREE.RepeatWrapping;
    clone.wrapT = THREE.RepeatWrapping;
    
    if (flipH) {
        clone.repeat.x = -1;
        clone.offset.x = 1;
    }
    if (flipV) {
        clone.repeat.y = -1;
        clone.offset.y = 1;
    }
    return clone;
}

/**
 * Apply transformations to texture based on reflect options
 * @param {THREE.Texture} texture - Source texture
 * @param {boolean} flipH - Flip horizontally
 * @param {boolean} flipV - Flip vertically
 * @returns {THREE.Texture} Transformed texture or original
 */
function applyTextureTransforms(texture, flipH, flipV) {
    if (!texture) return null;
    if (!flipH && !flipV) return texture;
    return cloneTextureWithFlip(texture, flipH, flipV);
}

/**
 * Create a single panel mesh
 * @param {Object} panel - Panel configuration
 * @param {Object} panelConfig - Full panel config
 * @param {Object} textures - Front and back textures
 * @param {Object} options - { reflectFrontH, reflectBackH, reflectFrontV, reflectBackV }
 * @returns {Object} Panel mesh with pivot
 */
function createPanel(panel, panelConfig, textures, options = {}) {
    const { reflectFrontH = false, reflectBackH = true, reflectFrontV = false, reflectBackV = false } = options;
    const isHorizontalFold = !panelConfig.isVertical;
    
    // panel.width is the dimension along the fold direction
    // panel.height is the dimension perpendicular to the fold
    const scaledPanelWidth = panel.width * SCALE_FACTOR;
    const scaledPanelHeight = panel.height * SCALE_FACTOR;
    
    // For horizontal folds: X = paper width (panel.height), Y = panel strip height (panel.width)
    // For vertical folds: X = panel strip width (panel.width), Y = paper height (panel.height)
    const geomWidth = isHorizontalFold ? scaledPanelHeight : scaledPanelWidth;
    const geomHeight = isHorizontalFold ? scaledPanelWidth : scaledPanelHeight;
    
    // Calculate UV coordinates for this panel
    const uvs = calculatePanelUVs(panel, panelConfig);
    
    // Create geometry with correct dimensions for fold orientation
    const geometry = new THREE.PlaneGeometry(geomWidth, geomHeight);
    
    // Apply custom UVs
    applyUVs(geometry, uvs, isHorizontalFold);
    
    // Create materials for front and back (sides swapped: front upload shows on back mesh, back upload on front mesh)
    // Reflect buttons match user's view: reflectFront flips back mesh (shows front upload), reflectBack flips front mesh (shows back upload)
    const frontTexture = applyTextureTransforms(textures.back, reflectBackH, reflectBackV);
    const backTexture = applyTextureTransforms(textures.front, reflectFrontH, reflectFrontV);

    const frontMaterial = new THREE.MeshStandardMaterial({
        map: frontTexture,
        color: textures.back ? 0xffffff : 0xf5f5f5,
        side: THREE.FrontSide,
        roughness: 0.8,
        metalness: 0.0
    });
    
    const backMaterial = new THREE.MeshStandardMaterial({
        map: backTexture,
        color: textures.front ? 0xffffff : 0xe8e8e8,
        side: THREE.FrontSide,
        roughness: 0.8,
        metalness: 0.0
    });
    
    // Create front mesh
    const frontMesh = new THREE.Mesh(geometry.clone(), frontMaterial);
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    
    // Create back mesh (slightly offset and flipped)
    const backGeometry = geometry.clone();
    // Flip UVs horizontally for back
    applyUVs(backGeometry, flipUVsHorizontally(uvs), isHorizontalFold);
    
    const backMesh = new THREE.Mesh(backGeometry, backMaterial);
    backMesh.rotation.y = Math.PI; // Flip to show back
    backMesh.position.z = -PAPER_THICKNESS;
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    
    // Create a group for this panel (front + back)
    const panelGroup = new THREE.Group();
    panelGroup.add(frontMesh);
    panelGroup.add(backMesh);
    
    // Create pivot point for folding
    const pivot = new THREE.Group();
    pivot.name = `panel-${panel.index}`;
    pivot.userData.panelIndex = panel.index;
    pivot.userData.panelConfig = panel;
    pivot.userData.isHorizontalFold = isHorizontalFold;
    // Track if this is a root panel (no parent) - root panels keep their base rotation
    pivot.userData.isRoot = (panel.parentIndex === undefined || panel.isBase);
    
    // Position panel within pivot based on pivot edge
    // Use geometry dimensions for positioning
    positionPanelInPivot(panelGroup, panel, geomWidth, geomHeight, isHorizontalFold);
    
    pivot.add(panelGroup);
    
    // Position pivot in world space
    positionPivot(pivot, panel, panelConfig, scaledPanelWidth, scaledPanelHeight, isHorizontalFold);
    
    // Store reference
    pivot.userData.panelGroup = panelGroup;
    pivot.userData.frontMesh = frontMesh;
    pivot.userData.backMesh = backMesh;
    
    return {
        pivot: pivot,
        panelGroup: panelGroup,
        frontMesh: frontMesh,
        backMesh: backMesh,
        panel: panel
    };
}

/**
 * Calculate UV coordinates for a panel
 * @param {Object} panel - Panel configuration
 * @param {Object} panelConfig - Full config
 * @returns {Object} UV coordinates
 */
function calculatePanelUVs(panel, panelConfig) {
    const isHorizontalFold = !panelConfig.isVertical;
    
    if (isHorizontalFold) {
        // For horizontal fold, we divide along height (V axis)
        const totalHeight = panelConfig.totalHeight;
        const vStart = panel.offsetX / totalHeight; // offsetX is actually offset along height
        const vEnd = (panel.offsetX + panel.width) / totalHeight;
        
        return {
            uStart: 0,
            uEnd: 1,
            vStart: vStart,
            vEnd: vEnd
        };
    } else {
        // For vertical fold, divide along width (U axis)
        const totalWidth = panelConfig.totalWidth;
        const uStart = panel.offsetX / totalWidth;
        const uEnd = (panel.offsetX + panel.width) / totalWidth;
        
        return {
            uStart: uStart,
            uEnd: uEnd,
            vStart: 0,
            vEnd: 1
        };
    }
}

/**
 * Apply UV coordinates to geometry
 * @param {THREE.BufferGeometry} geometry 
 * @param {Object} uvs 
 * @param {boolean} isHorizontalFold
 */
function applyUVs(geometry, uvs, isHorizontalFold = false) {
    const uvAttribute = geometry.getAttribute('uv');
    const uvArray = uvAttribute.array;
    
    // PlaneGeometry UV layout:
    // 0: bottom-left, 1: bottom-right, 2: top-left, 3: top-right
    // UV array: [u0,v0, u1,v1, u2,v2, u3,v3]
    
    // Bottom-left
    uvArray[0] = uvs.uStart;
    uvArray[1] = uvs.vStart;
    
    // Bottom-right
    uvArray[2] = uvs.uEnd;
    uvArray[3] = uvs.vStart;
    
    // Top-left
    uvArray[4] = uvs.uStart;
    uvArray[5] = uvs.vEnd;
    
    // Top-right
    uvArray[6] = uvs.uEnd;
    uvArray[7] = uvs.vEnd;
    
    uvAttribute.needsUpdate = true;
}

/**
 * Flip UVs horizontally (for back side)
 * @param {Object} uvs 
 * @returns {Object} Flipped UVs
 */
function flipUVsHorizontally(uvs) {
    return {
        uStart: uvs.uEnd,
        uEnd: uvs.uStart,
        vStart: uvs.vStart,
        vEnd: uvs.vEnd
    };
}

/**
 * Position panel within its pivot point
 * @param {THREE.Group} panelGroup 
 * @param {Object} panel 
 * @param {number} geomWidth - Geometry width (X dimension)
 * @param {number} geomHeight - Geometry height (Y dimension)
 * @param {boolean} isHorizontalFold
 */
function positionPanelInPivot(panelGroup, panel, geomWidth, geomHeight, isHorizontalFold) {
    // The pivot is at the fold edge
    // Position the panel so the pivot edge is at the origin of the pivot group
    
    if (isHorizontalFold) {
        // For horizontal fold, pivot edge is top or bottom (Y axis of geometry)
        // geomHeight is the panel strip height
        // Panel extends AWAY from the pivot/fold line
        switch (panel.pivotEdge) {
            case 'left': // Panel's top edge is at pivot, panel extends downward
                panelGroup.position.y = -geomHeight / 2;
                break;
            case 'right': // Panel's bottom edge is at pivot, panel extends upward
                panelGroup.position.y = geomHeight / 2;
                break;
            case 'center':
                panelGroup.position.y = 0;
                break;
        }
    } else {
        // For vertical fold, pivot edge is left or right (X axis of geometry)
        // geomWidth is the panel strip width
        switch (panel.pivotEdge) {
            case 'left':
                panelGroup.position.x = geomWidth / 2;
                break;
            case 'right':
                panelGroup.position.x = -geomWidth / 2;
                break;
            case 'center':
                panelGroup.position.x = 0;
                break;
        }
    }
}

/**
 * Position pivot in world space
 * @param {THREE.Group} pivot 
 * @param {Object} panel 
 * @param {Object} panelConfig 
 * @param {number} scaledPanelWidth - The panel's strip dimension (along fold)
 * @param {number} scaledPanelHeight - The panel's perpendicular dimension
 * @param {boolean} isHorizontalFold
 */
function positionPivot(pivot, panel, panelConfig, scaledPanelWidth, scaledPanelHeight, isHorizontalFold) {
    if (isHorizontalFold) {
        // For horizontal fold, panels stack along Y (before rotation)
        // Total height being divided is panelConfig.totalHeight
        const totalDividedDimension = panelConfig.totalHeight * SCALE_FACTOR;
        
        // Calculate pivot Y position based on where this panel sits
        // INVERT Y axis: offset=0 should be at TOP (positive Y), not bottom
        let pivotY = 0;
        
        switch (panel.pivotEdge) {
            case 'left': // Top edge of this panel strip (inverted)
                pivotY = (totalDividedDimension / 2) - (panel.offsetX * SCALE_FACTOR);
                break;
            case 'right': // Bottom edge of this panel strip (inverted)
                pivotY = (totalDividedDimension / 2) - ((panel.offsetX + panel.width) * SCALE_FACTOR);
                break;
            case 'center':
                pivotY = (totalDividedDimension / 2) - ((panel.offsetX + panel.width / 2) * SCALE_FACTOR);
                break;
        }
        
        // Center the paper when root is at edge. Bi-fold root is already at center.
        // Each fold type needs its own offset due to different panel counts/widths
        let centerOffset = 0;
        if (panel.pivotEdge !== 'center' && panelConfig.foldType !== 'bi-fold') {
            switch (panelConfig.foldType) {
                case 'tri-fold-z':
                    centerOffset = totalDividedDimension * 20 / 120;
                    break;
                case 'tri-fold-roll':
                    centerOffset = totalDividedDimension * 19.5 / 120;
                    break;
                case 'double-gate-fold':
                    // 4-panel fold: base pivot is near center, minimal offset needed
                    centerOffset = 0;
                    break;
                default:
                    centerOffset = totalDividedDimension * 19.5 / 120;
            }
        }
        pivot.position.x = 0;
        pivot.position.y = 0;
        pivot.position.z = -pivotY + centerOffset;
        
        // Rotate to lie flat (front facing up)
        pivot.rotation.x = Math.PI / 2;
        
    } else {
        // For vertical fold, panels are arranged along X
        const totalScaledWidth = panelConfig.totalWidth * SCALE_FACTOR;
        
        // Calculate pivot X position
        let pivotX = 0;
        
        switch (panel.pivotEdge) {
            case 'left':
                pivotX = (panel.offsetX * SCALE_FACTOR) - (totalScaledWidth / 2);
                break;
            case 'right':
                pivotX = ((panel.offsetX + panel.width) * SCALE_FACTOR) - (totalScaledWidth / 2);
                break;
            case 'center':
                pivotX = ((panel.offsetX + panel.width / 2) * SCALE_FACTOR) - (totalScaledWidth / 2);
                break;
        }
        
        pivot.position.x = pivotX;
        pivot.position.y = 0;
        pivot.position.z = 0;
        
        // Rotate to lie flat initially (front facing up)
        pivot.rotation.x = Math.PI / 2;
    }
}

/**
 * Build panel hierarchy (child panels attach to parent panels)
 * @param {Array} panels 
 */
function buildPanelHierarchy(panels) {
    panels.forEach((panel, index) => {
        if (panel.parentIndex !== undefined && panel.parentIndex !== index) {
            const parentMesh = panelMeshes[panel.parentIndex];
            const childMesh = panelMeshes[index];
            
            if (parentMesh && childMesh) {
                // Get the parent's panel group
                const parentPanelGroup = parentMesh.pivot.userData.panelGroup;
                const isHorizontalFold = childMesh.pivot.userData.isHorizontalFold;
                
                // Calculate child pivot position relative to parent panel
                const parentPanel = panels[panel.parentIndex];
                // For horizontal fold, we need the geometry height (which is parent's strip height)
                // For vertical fold, we need the geometry width (which is parent's strip width)
                const parentStripDimension = parentPanel.width * SCALE_FACTOR;
                
                if (isHorizontalFold) {
                    // For horizontal fold, child attaches at parent's Y edge
                    // Y axis is inverted: positive Y is TOP, negative Y is BOTTOM
                    // Child's pivot edge determines which edge of parent it attaches to
                    let childPivotY = 0;
                    if (panel.pivotEdge === 'left') {
                        // Child's 'left' (top) edge attaches at parent's bottom edge
                        childPivotY = -parentStripDimension / 2;
                    } else {
                        // Child's 'right' (bottom) edge attaches at parent's top edge
                        childPivotY = parentStripDimension / 2;
                    }
                    
                    childMesh.pivot.position.x = 0;
                    childMesh.pivot.position.y = childPivotY;
                    childMesh.pivot.position.z = 0;
                    childMesh.pivot.rotation.x = 0;
                } else {
                    // For vertical fold, child attaches at parent's X edge
                    let childPivotX = 0;
                    if (panel.pivotEdge === 'left') {
                        childPivotX = parentStripDimension / 2;
                    } else {
                        childPivotX = -parentStripDimension / 2;
                    }
                    
                    childMesh.pivot.position.x = childPivotX;
                    childMesh.pivot.position.y = 0;
                    childMesh.pivot.position.z = 0;
                    childMesh.pivot.rotation.x = 0;
                }
                
                // Add to parent
                parentPanelGroup.add(childMesh.pivot);
            }
        }
    });
}

/**
 * Center the paper group
 * @param {THREE.Group} group 
 * @param {Object} panelConfig 
 */
function centerGroup(group, panelConfig) {
    group.position.y = 0;
    group.position.x = 0;
    group.position.z = 0;
}

/**
 * Recompute and apply centering after the group is in the scene.
 * Call this after addToScene so world matrices are correct.
 * @param {THREE.Group} group 
 */
export function recalculatePaperCenter(group) {
    if (!group) return;
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.x = -center.x;
    group.position.z = -center.z;
}

/**
 * Get the current paper group
 * @returns {THREE.Group}
 */
export function getPaperGroup() {
    return paperGroup;
}

/**
 * Get panel meshes
 * @returns {Array}
 */
export function getPanelMeshes() {
    return panelMeshes;
}

/**
 * Update textures on existing mesh
 * @param {Object} textures - { front, back }
 * @param {Object} options - { reflectFrontH, reflectBackH, reflectFrontV, reflectBackV }
 */
export function updateTextures(textures, options = {}) {
    if (!panelMeshes || panelMeshes.length === 0) return;
    
    const { reflectFrontH = false, reflectBackH = true, reflectFrontV = false, reflectBackV = false } = options;
    const frontTexture = applyTextureTransforms(textures.back, reflectBackH, reflectBackV);
    const backTexture = applyTextureTransforms(textures.front, reflectFrontH, reflectFrontV);

    panelMeshes.forEach(meshData => {
        if (meshData.frontMesh) {
            const oldMap = meshData.frontMesh.material.map;
            if (oldMap && oldMap !== textures.back && oldMap !== textures.front) oldMap.dispose();
            meshData.frontMesh.material.map = frontTexture;
            meshData.frontMesh.material.needsUpdate = true;
        }
        if (meshData.backMesh) {
            const oldMap = meshData.backMesh.material.map;
            if (oldMap && oldMap !== textures.back && oldMap !== textures.front) oldMap.dispose();
            meshData.backMesh.material.map = backTexture;
            meshData.backMesh.material.needsUpdate = true;
        }
    });
}

/**
 * Dispose of mesh resources
 */
export function disposeMesh() {
    if (panelMeshes) {
        panelMeshes.forEach(meshData => {
            if (meshData.frontMesh) {
                meshData.frontMesh.geometry.dispose();
                meshData.frontMesh.material.dispose();
            }
            if (meshData.backMesh) {
                meshData.backMesh.geometry.dispose();
                meshData.backMesh.material.dispose();
            }
        });
    }
    
    panelMeshes = [];
    paperGroup = null;
}

/**
 * Get scale factor
 * @returns {number}
 */
export function getScaleFactor() {
    return SCALE_FACTOR;
}
