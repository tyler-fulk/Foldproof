/**
 * Export Viewport Module
 * Captures the current 3D viewport as JPG or PDF with optional background and guides
 */

import * as THREE from 'three';
import { getRenderer, getScene, getCamera, getGridHelper } from './scene.js';
import { getGuideGroup } from './guides.js';

const SCENE_CONFIG = {
    backgroundColor: 0xf0f0f5,
    backgroundColorDark: 0x1a1a2e
};

/**
 * Initialize export UI and handlers
 */
export function initExport() {
    const exportBtn = document.getElementById('export-btn');
    const exportDropdown = document.getElementById('export-dropdown');
    const exportApply = document.getElementById('export-apply');
    const exportFormat = document.getElementById('export-format');
    const exportBackground = document.getElementById('export-background');
    const exportGrid = document.getElementById('export-grid');
    const exportGuides = document.getElementById('export-guides');

    if (!exportBtn || !exportDropdown) return;

    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.hidden = !exportDropdown.hidden;
    });

    exportDropdown.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
        if (!exportDropdown.contains(e.target) && !exportBtn.contains(e.target)) {
            exportDropdown.hidden = true;
        }
    });

    if (exportApply) {
        exportApply.addEventListener('click', async () => {
            const format = exportFormat?.value || 'jpg';
            const showBackground = exportBackground?.checked ?? true;
            const showGrid = exportGrid?.checked ?? true;
            const showGuides = exportGuides?.checked ?? true;
            await captureAndExport({ format, showBackground, showGrid, showGuides });
            exportDropdown.hidden = true;
        });
    }
}

/**
 * Capture viewport and export
 * @param {Object} options - { format, showBackground, showGrid, showGuides }
 */
async function captureAndExport(options) {
    const { format, showBackground, showGrid, showGuides } = options;
    const renderer = getRenderer();
    const scene = getScene();
    const camera = getCamera();

    if (!renderer || !scene || !camera) return;

    const guideGroup = getGuideGroup();
    const gridHelper = getGridHelper();

    // Store current state
    const origBackground = scene.background ? scene.background.clone() : null;
    const origGuideVisible = guideGroup ? guideGroup.visible : true;
    const origGridVisible = gridHelper ? gridHelper.visible : true;

    // Apply export options
    const isPng = format === 'png';
    if (showBackground) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        scene.background = new THREE.Color(
            isDark ? SCENE_CONFIG.backgroundColorDark : SCENE_CONFIG.backgroundColor
        );
    } else {
        scene.background = isPng ? null : new THREE.Color(0xffffff);
    }

    if (gridHelper) {
        gridHelper.visible = showGrid;
    }

    if (guideGroup) {
        guideGroup.visible = showGuides;
    }

    // Render to ensure latest frame
    renderer.render(scene, camera);

    // Capture canvas
    const canvas = renderer.domElement;
    const mimeType = isPng ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, isPng ? undefined : 0.92);

    // Restore state
    scene.background = origBackground;
    if (guideGroup) {
        guideGroup.visible = origGuideVisible;
    }
    if (gridHelper) {
        gridHelper.visible = origGridVisible;
    }

    // Re-render with restored state
    renderer.render(scene, camera);

    // Export
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const filename = `foldproof-export-${timestamp}`;
    const ext = isPng ? 'png' : 'jpg';

    if (format === 'pdf') {
        try {
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(dataUrl, isPng ? 'PNG' : 'JPEG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${filename}.pdf`);
        } catch (err) {
            console.error('PDF export failed:', err);
            downloadDataUrl(dataUrl, `${filename}.${ext}`);
        }
    } else {
        downloadDataUrl(dataUrl, `${filename}.${ext}`);
    }
}

function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}
