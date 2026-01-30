# Print Fold Visualizer

A web application for visualizing folded print layouts in 3D. Upload front and back images of your print design, select the paper size and fold type, then preview the result with interactive 3D animations.

## Features

- **Image Upload**: Drag-and-drop or click to upload front and back print images
- **Supported Formats**: PNG, JPG, JPEG, WebP, BMP, TIFF, and PDF
- **PDF Support**: Automatically renders the first page of PDF files as high-quality images
- **Paper Sizes**: Common presets (Letter, Legal, Tabloid, A4, A3) plus custom size entry with fractional support (e.g., "16 5/16")
- **Fold Types**:
  - Bi-Fold (Vertical/Horizontal)
  - Tri-Fold Z-Fold (Accordion)
  - Tri-Fold Roll (Letter Fold)
  - Gate Fold
- **3D Preview**: Rotatable 3D model of the folded print
- **Animations**: Smooth fold/unfold animations with speed control
- **Themes**: Light and dark mode support

## Deployment

### Option 1: Simple File Server

Since this is a static web application, you can deploy it to any web server:

1. Copy all files to your web server's document root
2. Ensure the server is configured to serve static files
3. Access via your domain/IP address

### Option 2: Apache

```apache
# .htaccess (optional, for clean URLs)
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
</IfModule>

# Enable CORS if needed
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
</IfModule>
```

### Option 3: Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/print-fold-visualizer;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option 4: IIS (Windows Server)

1. Create a new website in IIS Manager
2. Point the physical path to the application folder
3. Ensure the MIME types include:
   - `.js` → `application/javascript`
   - `.css` → `text/css`
   - `.json` → `application/json`

### Option 5: Local Development

For local testing, you can use any simple HTTP server:

```bash
# Python 3
python -m http.server 8080

# Node.js (with http-server installed globally)
npx http-server -p 8080

# PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## Browser Requirements

- Modern browser with ES6+ module support
- WebGL support for 3D rendering
- Recommended: Chrome, Firefox, Edge, Safari (latest versions)

## File Structure

```
/
├── index.html           # Main HTML page
├── css/
│   └── styles.css       # Application styles
├── js/
│   ├── main.js          # Application entry point
│   ├── imageHandler.js  # Image upload handling
│   ├── sizeParser.js    # Paper size parsing
│   ├── foldCalculator.js# Fold configuration
│   ├── scene.js         # Three.js scene setup
│   ├── foldMesh.js      # 3D paper geometry
│   └── animations.js    # Fold animations
└── README.md            # This file
```

## Usage

1. **Upload Images**: Drag and drop or click the upload areas to add your front and back print images
2. **Select Paper Size**: Choose a preset or enter a custom size (supports fractions like "16 5/16")
3. **Choose Fold Type**: Select how you want the paper to be folded
4. **Preview**: The 3D model updates automatically
5. **Interact**:
   - Click and drag to rotate the view
   - Scroll to zoom in/out
   - Use the Fold/Unfold buttons or slider to control the fold state
   - Adjust animation speed as needed

## Technologies Used

- HTML5/CSS3
- Vanilla JavaScript (ES6 Modules)
- Three.js for 3D rendering
- No build step required

## License

MIT License - Feel free to use and modify for your projects.
