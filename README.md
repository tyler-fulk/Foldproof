# <img src="assets/favicon.png" width="32" height="32"> Foldproof - 3D Print Fold Preview

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A web application for visualizing folded print layouts in 3D. Upload front and back images of your print design, select the paper size and fold type, then preview the result with interactive 3D animations.

**Live demo:** [tyler-fulk.github.io/Foldproof](https://tyler-fulk.github.io/Foldproof/)

## Features

### Image Upload
- Drag-and-drop or click to upload front and back print images
- **Supported formats:** PNG, JPG, JPEG, WebP, BMP, TIFF, SVG, and PDF
- **PDF support:**
  - 2-page PDFs automatically fill both slots (page 1 → front, page 2 → back)
  - PDFs with 3+ pages show a page selector on each slot to choose which page to display
- **Swap front/back** — One-click button to swap the front and back images
- **Autofit image:** When disabled, paper size is taken from the uploaded file (e.g., a 1″×1″ PDF displays at 1″×1″)
- **Reflect front/back** — Mirror individual images
- **Inactivity pulse** — Upload zones pulse after 10 seconds of inactivity (without an image) to draw attention; stops when you interact with the upload areas

### Paper Sizes
- Common presets: Letter, Legal, Tabloid, A4, A3
- Custom size entry with fractional inch support (e.g., "16 5/16\"")

### Fold Types
- Bi-Fold (Vertical/Horizontal)
- Tri-Fold Z-Fold (Accordion)
- Tri-Fold Roll (Letter Fold)
- Gate Fold
- **Orientation:** Vertical (left-right) or horizontal (top-bottom) for all fold types

### Viewport Toolbar (Top-Left)
- **Fold style buttons** — Switch between fold types with icon buttons
- **Orientation buttons** — Toggle Vertical or Horizontal fold direction
- Both toolbars stay in sync with the sidebar controls

### 3D Preview
- Rotatable 3D model with orbit controls
- Infinite grid background (toggleable)
- Smooth fold/unfold animations with adjustable speed
- **Play/Pause** — Animate fold progress
- **Fold/Unfold** — Quick buttons to set fold state
- Double-click progress or speed sliders to reset
- **Controls disabled until upload** — Fold controls are greyed out until at least one image is uploaded; clicking them pulses the "Upload front and back images to preview" tip

### Print Guides
- **Trim line** — Cut boundary
- **Bleed area** — Adjustable slider (default 0.125″)
- **Safe zone** — Adjustable slider (default 0.25″)
- **Fold lines** — Panel fold boundaries
- **Ruler** — Distance measurements with optional labels
- **Grid** — Infinite ground grid

### Export
- Export viewport as **JPG**, **PNG** (transparent), or **PDF**
- Toggle background, grid, and guides in export
- Export button in top-right of viewport

### Themes
- Light and dark mode (follows system preference, saves preference)
- No white flash on page reload

## Deployment

### Option 1: Simple File Server

Copy all files to your web server's document root. This is a static app—no build step required.

### Option 2: Local Development

```bash
# Python 3
python -m http.server 8080

# Node.js
npx http-server -p 8080
```

Then open `http://localhost:8080` in your browser.

### Option 3: Apache

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
</IfModule>
```

### Option 4: Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/Foldproof;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Option 5: GitHub Pages

Push to a GitHub repository and enable Pages in Settings → Pages. The app will be served from `https://<user>.github.io/<repo>/`.

## Browser Requirements

- Modern browser with ES6+ module support
- WebGL support for 3D rendering
- JavaScript required
- Recommended: Chrome, Firefox, Edge, Safari (latest versions)

## File Structure

```
/
├── index.html              # Main HTML page
├── css/
│   └── styles.css          # Application styles
├── js/
│   ├── main.js             # Application entry point
│   ├── imageHandler.js     # Image upload, PDF, SVG, swap handling
│   ├── sizeParser.js       # Paper size parsing
│   ├── foldCalculator.js   # Fold configuration
│   ├── foldMesh.js         # 3D paper geometry
│   ├── animations.js       # Fold animations
│   ├── scene.js            # Three.js scene setup
│   ├── guides.js           # Trim, bleed, safe zone, ruler guides
│   ├── exportViewport.js   # JPG/PNG/PDF export
│   └── infiniteGrid.js     # Shader-based infinite grid
└── README.md
```

## Usage

1. **Upload images** — Drop or click to add front and back designs (images or PDF). Use the swap button between upload zones to swap front and back.
2. **Paper size** — Choose a preset or enter a custom size.
3. **Fold type** — Select fold style and orientation from the sidebar, or use the viewport toolbar (top-left).
4. **Preview** — The 3D model updates automatically.
5. **Interact**
   - Drag to rotate, scroll to zoom
   - Use Fold/Unfold buttons, Play/Pause, or the progress slider
   - Double-click sliders to reset
6. **Guides** — Toggle trim, bleed, safe zone, fold lines, ruler, grid.
7. **Export** — Use the Export button (top right) to save the viewport as JPG, PNG, or PDF.

## Technologies Used

- HTML5 / CSS3
- Vanilla JavaScript (ES6 modules)
- Three.js for 3D rendering
- PDF.js for PDF rendering
- jsPDF for PDF export
- No build step required

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.

---

**Made by [Tyler Fulk](https://tylerfulk.com)**
