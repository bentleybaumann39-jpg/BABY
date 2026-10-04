// Planar mirror (reflected camera + oblique near plane), rendered only when relevant.
// The mirror camera also sees layer 2 — things that exist only in reflections.
import * as THREE from 'three';

export class Mirror {
  constructor(renderer, width, height, size = 512) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(size, Math.round(size * height / width), { type: THREE.HalfFloatType });
    this.textureMatrix = new THREE.Matrix4();
    this.cam = new THREE.PerspectiveCamera();
    this.cam.layers.enable(2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMirror: { value: this.rt.texture }, textureMatrix: { value: this.textureMatrix }, tint: { value: new THREE.Color(0.75, 0.78, 0.8) }, grime: { value: 0.0 } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv4; varying vec2 vUv; void main(){ vUv = uv; vUv4 = textureMatrix * vec4(position,1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D tMirror; uniform vec3 tint; varying vec4 vUv4; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec3 c = texture2DProj(tMirror, vUv4).rgb * tint; float sp = h(floor(vUv*vec2(180.0,60.0))); c *= 0.85 + 0.15*step(0.08, sp); float edge = smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x)*smoothstep(0.0,0.1,vUv.y)*smoothstep(1.0,0.9,vUv.y); c *= mix(0.4,1.0,edge); gl_FragColor = vec4(c,1.0); }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    this.active = false;
  }

  render(scene, camera) {
    const m = this.mesh;
    m.updateMatrixWorld();
    const mirrorPos = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rotM = new THREE.Matrix4().extractRotation(m.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).applyMatrix4(rotM);
    const view = mirrorPos.clone().sub(camPos);
    if (view.dot(normal) > 0) return;
    view.reflect(normal).negate().add(mirrorPos);
    rotM.extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rotM).add(camPos);
    const target = mirrorPos.clone().sub(look).reflect(normal).negate().add(mirrorPos);
    const c = this.cam;
    c.position.copy(view);
    c.up.set(0, 1, 0).applyMatrix4(rotM).reflect(normal);
    c.lookAt(target);
    c.far = camera.far; c.near = camera.near; c.fov = camera.fov; c.aspect = camera.aspect;
    c.updateMatrixWorld();
    c.projectionMatrix.copy(camera.projectionMatrix);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(c.projectionMatrix).multiply(c.matrixWorldInverse).multiply(m.matrixWorld);
    // Oblique clip plane
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, mirrorPos).applyMatrix4(c.matrixWorldInverse);
    const cp = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = c.projectionMatrix;
    const q = new THREE.Vector4((Math.sign(cp.x) + pm.elements[8]) / pm.elements[0], (Math.sign(cp.y) + pm.elements[9]) / pm.elements[5], -1, (1 + pm.elements[10]) / pm.elements[14]);
    cp.multiplyScalar(2 / cp.dot(q));
    pm.elements[2] = cp.x; pm.elements[6] = cp.y; pm.elements[10] = cp.z + 1; pm.elements[14] = cp.w;
    m.visible = false;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, c);
    r.setRenderTarget(prev);
    m.visible = true;
  }
}
