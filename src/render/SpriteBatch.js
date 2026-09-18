// Immediate-mode instanced sprite batcher. Everything on the battlefield
// (shadows, units, projectiles, particles, numbers, bases) is pushed here each
// frame and drawn with a single instanced draw call from the atlas.
import * as THREE from '../../vendor/three.module.js';

const VERT = /* glsl */`
  attribute vec3 iPos;
  attribute vec4 iUV;
  attribute vec2 iSize;
  attribute vec2 iAnchor;
  attribute vec4 iParam;   // flip, rot, flash, alpha
  attribute vec3 iTint;
  uniform float uPPU;
  varying vec2 vUv;
  varying float vFlash;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 local = position.xy;                        // 0..1 quad
    vec2 p = (local - iAnchor) * iSize;
    if (iParam.x > 0.5) p.x = -p.x;
    float c = cos(iParam.y), s = sin(iParam.y);
    vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    vec2 base = floor(iPos.xy * uPPU + 0.5) / uPPU;   // snap sprite origin to the pixel grid
    vec3 world = vec3(base + r, iPos.z);
    float u = mix(iUV.x, iUV.z, local.x);
    float v = mix(iUV.w, iUV.y, local.y);
    vUv = vec2(u, v);
    vFlash = iParam.z; vAlpha = iParam.w; vTint = iTint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`;
const FRAG = /* glsl */`
  precision mediump float;
  uniform sampler2D uTex;
  varying vec2 vUv;
  varying float vFlash;
  varying float vAlpha;
  varying vec3 vTint;
  float bayer(vec2 p) {
    vec2 q = floor(mod(p, 4.0));
    float i = q.x + q.y * 4.0;
    // 4x4 ordered dither matrix
    float m[16];
    m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
    m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
    float v = 0.0;
    for (int k = 0; k < 16; k++) if (float(k) == i) v = m[k];
    return (v + 0.5) / 16.0;
  }
  void main() {
    vec4 t = texture2D(uTex, vUv);
    if (t.a < 0.05) discard;
    if (vAlpha < 0.999 && vAlpha < bayer(gl_FragCoord.xy)) discard;
    vec3 col = t.rgb * vTint;
    col = mix(col, vec3(1.0), vFlash);
    gl_FragColor = vec4(col, t.a);
  }
`;

export class SpriteBatch {
  constructor(atlas, capacity = 6000, ppu = 12) {
    this.atlas = atlas;
    this.capacity = capacity;
    this.count = 0;
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0.5, 0.5, 0);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.aPos = mk(3); this.aUV = mk(4); this.aSize = mk(2); this.aAnchor = mk(2); this.aParam = mk(4); this.aTint = mk(3);
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iUV', this.aUV); geo.setAttribute('iSize', this.aSize);
    geo.setAttribute('iAnchor', this.aAnchor); geo.setAttribute('iParam', this.aParam); geo.setAttribute('iTint', this.aTint);
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: atlas.texture }, uPPU: { value: ppu } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.ppu = ppu;
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  }

  begin() { this.count = 0; }

  // Push one sprite. Sizes are in world units (frame pixels / ppu * scale).
  push(key, x, y, z, opts) {
    if (this.count >= this.capacity) return;
    const f = this.atlas.frame(key);
    const i = this.count++;
    const scale = (opts && opts.scale) || 1;
    const sx = (opts && opts.sx != null ? opts.sx : f.w * scale) / this.ppu;
    const sy = (opts && opts.sy != null ? opts.sy : f.h * scale) / this.ppu;
    this.aPos.array[i * 3] = x; this.aPos.array[i * 3 + 1] = y; this.aPos.array[i * 3 + 2] = z;
    this.aUV.array[i * 4] = f.u0; this.aUV.array[i * 4 + 1] = f.v0; this.aUV.array[i * 4 + 2] = f.u1; this.aUV.array[i * 4 + 3] = f.v1;
    this.aSize.array[i * 2] = sx; this.aSize.array[i * 2 + 1] = sy;
    const ax = (opts && opts.ax != null) ? opts.ax : f.ax / f.w;
    const ay = (opts && opts.ay != null) ? opts.ay : 1 - f.ay / f.h;
    this.aAnchor.array[i * 2] = ax; this.aAnchor.array[i * 2 + 1] = ay;
    this.aParam.array[i * 4] = (opts && opts.flip) ? 1 : 0;
    this.aParam.array[i * 4 + 1] = (opts && opts.rot) || 0;
    this.aParam.array[i * 4 + 2] = (opts && opts.flash) || 0;
    this.aParam.array[i * 4 + 3] = (opts && opts.alpha != null) ? opts.alpha : 1;
    const tint = opts && opts.tint;
    this.aTint.array[i * 3] = tint ? tint[0] : 1; this.aTint.array[i * 3 + 1] = tint ? tint[1] : 1; this.aTint.array[i * 3 + 2] = tint ? tint[2] : 1;
  }

  // Axis-aligned filled rectangle in world units (uses the 1x1 'px' frame).
  rect(x, y, z, w, h, tint, alpha = 1) {
    this.push('px', x, y, z, { sx: w * this.ppu, sy: h * this.ppu, ax: 0, ay: 0, tint, alpha });
  }

  end() {
    this.geo.instanceCount = this.count;
    for (const a of [this.aPos, this.aUV, this.aSize, this.aAnchor, this.aParam, this.aTint]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * a.itemSize);
      a.needsUpdate = true;
    }
  }
}
