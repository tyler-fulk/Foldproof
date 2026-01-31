/**
 * Infinite Grid Helper for Three.js
 * Shader-based grid that follows the camera and fades with distance
 * Adapted from Fyrestar's THREE.InfiniteGridHelper
 */

import * as THREE from 'three';

export class InfiniteGridHelper extends THREE.Mesh {
    constructor(size1 = 1, size2 = 10, color = 0xcccccc, distance = 100) {
        const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
        const colorObj = color instanceof THREE.Color ? color : new THREE.Color(color);
        const material = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            uniforms: {
                uSize1: { value: size1 },
                uSize2: { value: size2 },
                uColor: { value: colorObj },
                uDistance: { value: distance }
            },
            transparent: true,
            vertexShader: `
                varying vec3 worldPosition;

                uniform float uDistance;

                void main() {
                    vec3 pos = position.xzy * uDistance;
                    pos.xz += cameraPosition.xz;
                    worldPosition = pos;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 worldPosition;

                uniform float uSize1;
                uniform float uSize2;
                uniform vec3 uColor;
                uniform float uDistance;

                float getGrid(float size) {
                    vec2 r = worldPosition.xz / size;
                    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
                    float line = min(grid.x, grid.y);
                    return 1.0 - min(line, 1.0);
                }

                void main() {
                    float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0);
                    float g1 = getGrid(uSize1);
                    float g2 = getGrid(uSize2);

                    gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0) * 0.7);
                    gl_FragColor.a = mix(0.7 * gl_FragColor.a, gl_FragColor.a, g2);

                    if (gl_FragColor.a <= 0.0) discard;
                }
            `,
            extensions: { derivatives: true }
        });

        super(geometry, material);
        this.frustumCulled = false;
    }
}
