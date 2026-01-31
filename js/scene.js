/**
 * Three.js Scene Module
 * Sets up the 3D scene, camera, lighting, and controls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Export THREE for other modules
export { THREE };

// Scene components
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let gridHelper = null;
let animationFrameId = null;

// Scene configuration
const SCENE_CONFIG = {
    backgroundColor: 0xf0f0f5,
    backgroundColorDark: 0x1a1a2e,
    cameraFov: 45,
    cameraNear: 0.1,
    cameraFar: 1000,
    cameraPosition: { x: 0, y: 5, z: 12 },
    ambientLightColor: 0xffffff,
    ambientLightIntensity: 0.6,
    directionalLightColor: 0xffffff,
    directionalLightIntensity: 0.8,
    directionalLightPosition: { x: 5, y: 10, z: 7 }
};

/**
 * Initialize the Three.js scene
 * @returns {Object} Scene components
 */
export function initScene() {
    const canvas = document.getElementById('three-canvas');
    const container = canvas.parentElement;
    
    // Create scene
    scene = new THREE.Scene();
    updateBackgroundColor();
    
    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(
        SCENE_CONFIG.cameraFov,
        aspect,
        SCENE_CONFIG.cameraNear,
        SCENE_CONFIG.cameraFar
    );
    camera.position.set(
        SCENE_CONFIG.cameraPosition.x,
        SCENE_CONFIG.cameraPosition.y,
        SCENE_CONFIG.cameraPosition.z
    );
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Setup lighting
    setupLighting();
    
    // Setup orbit controls
    setupControls();
    
    // Add grid helper for reference (optional, can be toggled)
    addHelpers();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start render loop
    startRenderLoop();
    
    return {
        scene,
        camera,
        renderer,
        controls
    };
}

/**
 * Setup scene lighting
 */
function setupLighting() {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(
        SCENE_CONFIG.ambientLightColor,
        SCENE_CONFIG.ambientLightIntensity
    );
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(
        SCENE_CONFIG.directionalLightColor,
        SCENE_CONFIG.directionalLightIntensity
    );
    directionalLight.position.set(
        SCENE_CONFIG.directionalLightPosition.x,
        SCENE_CONFIG.directionalLightPosition.y,
        SCENE_CONFIG.directionalLightPosition.z
    );
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);
    
    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Bottom fill light
    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.2);
    bottomLight.position.set(0, -5, 0);
    scene.add(bottomLight);
}

/**
 * Setup orbit controls
 */
function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI;
    controls.target.set(0, 0, 0);
    controls.update();
}

/**
 * Add helper objects to the scene
 */
function addHelpers() {
    gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xe0e0e0);
    gridHelper.position.y = -0.01;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
}

/**
 * Update background color based on theme
 */
export function updateBackgroundColor() {
    if (!scene) return;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColor = isDark ? SCENE_CONFIG.backgroundColorDark : SCENE_CONFIG.backgroundColor;
    scene.background = new THREE.Color(bgColor);
}

/**
 * Handle window resize
 */
function onWindowResize() {
    const canvas = document.getElementById('three-canvas');
    const container = canvas.parentElement;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Start the render loop
 */
function startRenderLoop() {
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        
        // Update controls
        if (controls) {
            controls.update();
        }
        
        // Render
        renderer.render(scene, camera);
    }
    
    animate();
}

/**
 * Stop the render loop
 */
export function stopRenderLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

/**
 * Get the scene
 * @returns {THREE.Scene}
 */
export function getScene() {
    return scene;
}

/**
 * Get the camera
 * @returns {THREE.PerspectiveCamera}
 */
export function getCamera() {
    return camera;
}

/**
 * Get the renderer
 * @returns {THREE.WebGLRenderer}
 */
export function getRenderer() {
    return renderer;
}

/**
 * Get the grid helper
 * @returns {THREE.GridHelper|null}
 */
export function getGridHelper() {
    return gridHelper;
}

/**
 * Get the controls
 * @returns {THREE.OrbitControls}
 */
export function getControls() {
    return controls;
}

/**
 * Reset camera to default position
 */
export function resetCamera() {
    camera.position.set(
        SCENE_CONFIG.cameraPosition.x,
        SCENE_CONFIG.cameraPosition.y,
        SCENE_CONFIG.cameraPosition.z
    );
    controls.target.set(0, 0, 0);
    controls.update();
}

/**
 * Add an object to the scene
 * @param {THREE.Object3D} object 
 */
export function addToScene(object) {
    if (scene && object) {
        scene.add(object);
    }
}

/**
 * Remove an object from the scene
 * @param {THREE.Object3D} object 
 */
export function removeFromScene(object) {
    if (scene && object) {
        scene.remove(object);
    }
}

/**
 * Clear all meshes from the scene (keeps lights and helpers)
 */
export function clearMeshes() {
    if (!scene) return;
    
    const objectsToRemove = [];
    scene.traverse((child) => {
        if (child.isMesh && child.name !== 'helper') {
            objectsToRemove.push(child);
        }
    });
    
    objectsToRemove.forEach((obj) => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });
}

/**
 * Dispose of all scene resources
 */
export function disposeScene() {
    stopRenderLoop();
    
    if (controls) {
        controls.dispose();
    }
    
    if (renderer) {
        renderer.dispose();
    }
    
    window.removeEventListener('resize', onWindowResize);
}
