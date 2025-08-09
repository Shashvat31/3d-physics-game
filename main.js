// Mini 3D physics game using three.js + cannon-es (ES modules via CDN). Mobile-friendly with onscreen buttons.
// Controls: on-screen D-pad moves the player; FIRE spawns a projectile.
// To run: open index.html in a modern mobile browser (Firefox for Android or Chrome). If modules fail, try Kiwi Browser or host the folder (GitHub Pages).

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.module.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1e2a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000);
camera.position.set(0, 6, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,1,0);
controls.enablePan = false;
controls.enableRotate = true;
controls.enableZoom = true;
controls.enableDamping = true;

// Lights
const hemi = new THREE.HemisphereLight(0xffffee, 0x080820, 0.6); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(5,10,5); dir.castShadow = true; scene.add(dir);

// THREE ground
const groundMat = new THREE.MeshStandardMaterial({ color: 0x335544, roughness: 0.95 });
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(200,200), groundMat);
groundMesh.rotation.x = -Math.PI/2; groundMesh.receiveShadow = true; scene.add(groundMesh);

// CANNON world
const world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.82,0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Physics ground
const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: new CANNON.Material() });
groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(groundBody);

// Player: physics box
const playerSize = { x:0.9, y:1.6, z:0.9 };
const playerGeo = new THREE.BoxGeometry(playerSize.x, playerSize.y, playerSize.z);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x33aaff });
const playerMesh = new THREE.Mesh(playerGeo, playerMat); playerMesh.castShadow = true; playerMesh.position.set(0,1,0); scene.add(playerMesh);

const playerShape = new CANNON.Box(new CANNON.Vec3(playerSize.x/2, playerSize.y/2, playerSize.z/2));
const playerBody = new CANNON.Body({ mass: 4, shape: playerShape, position: new CANNON.Vec3(0,1,0), fixedRotation: false, linearDamping: 0.9 });
world.addBody(playerBody);

// Some targets (spheres) with physics
const targets = [];
const targetMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
for (let i=0;i<7;i++){
  const r = 0.5 + Math.random()*0.6;
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), targetMat.clone());
  m.castShadow = true;
  const x = (Math.random()-0.5)*12 + 4;
  const z = (Math.random()-0.5)*12 - 2;
  m.position.set(x, r+0.05, z);
  scene.add(m);

  const shape = new CANNON.Sphere(r);
  const body = new CANNON.Body({ mass: 1.2, shape, position: new CANNON.Vec3(x, r+0.05, z), linearDamping: 0.2, angularDamping: 0.4 });
  body.userData = { three: m };
  world.addBody(body);
  targets.push(body);
}

// Projectiles array (physics bodies)
const projectiles = [];
const projRadius = 0.12;

// Simple ambient movement state (from onscreen buttons)
const input = { up:false, down:false, left:false, right:false, fire:false };

// Attach touch controls
function bindBtn(id, key){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('touchstart', (e)=>{ e.preventDefault(); input[key]=true; }, {passive:false});
  el.addEventListener('touchend', (e)=>{ e.preventDefault(); input[key]=false; }, {passive:false});
  el.addEventListener('mousedown', ()=> input[key]=true);
  el.addEventListener('mouseup', ()=> input[key]=false);
  el.addEventListener('mouseleave', ()=> input[key]=false);
}
bindBtn('up','up'); bindBtn('down','down'); bindBtn('left','left'); bindBtn('right','right'); bindBtn('fire','fire');

// keyboard for desktop testing
window.addEventListener('keydown', (e)=>{ const k=e.key.toLowerCase(); if(k==='w') input.up=true; if(k==='s') input.down=true; if(k==='a') input.left=true; if(k==='d') input.right=true; if(e.code==='Space') input.fire=true; });
window.addEventListener('keyup', (e)=>{ const k=e.key.toLowerCase(); if(k==='w') input.up=false; if(k==='s') input.down=false; if(k==='a') input.left=false; if(k==='d') input.right=false; if(e.code==='Space') input.fire=false; });

// shoot cooldown
let lastShot = 0;
const shotCooldown = 0.28; // seconds

function shoot(){
  const now = performance.now()/1000;
  if (now - lastShot < shotCooldown) return;
  lastShot = now;

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(projRadius, 10,10), new THREE.MeshStandardMaterial({ color:0xffff88, emissive:0x332200 }));
  mesh.castShadow = true;
  scene.add(mesh);

  const start = new CANNON.Vec3().copy(playerBody.position);
  start.y += 0.8;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  const speed = 18;
  const vel = new CANNON.Vec3(dir.x*speed, 1.5, dir.z*speed);

  const body = new CANNON.Body({ mass: 0.2, shape: new CANNON.Sphere(projRadius), position: start, velocity: vel, linearDamping: 0.01 });
  body.userData = { three: mesh, life: 6.0 };
  world.addBody(body);
  projectiles.push(body);
}

// Main loop
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  // movement
  const moveForce = 40;
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
  let mv = new THREE.Vector3();
  if (input.up) mv.add(forward);
  if (input.down) mv.sub(forward);
  if (input.left) mv.sub(right);
  if (input.right) mv.add(right);
  if (mv.lengthSq() > 0.001){
    mv.normalize();
    const f = new CANNON.Vec3(mv.x*moveForce, 0, mv.z*moveForce);
    playerBody.applyForce(f, playerBody.position);
    const hv = new CANNON.Vec3(playerBody.velocity.x, 0, playerBody.velocity.z);
    const maxSpeed = 6;
    const speed = hv.length();
    if (speed > maxSpeed){
      hv.scale(maxSpeed/speed, hv);
      playerBody.velocity.x = hv.x; playerBody.velocity.z = hv.z;
    }
  } else {
    playerBody.velocity.x *= 0.98; playerBody.velocity.z *= 0.98;
  }

  if (input.fire) { shoot(); input.fire = false; }

  world.step(1/60, dt, 3);

  playerMesh.position.copy(playerBody.position);
  playerMesh.quaternion.copy(playerBody.quaternion);

  for (let i = targets.length-1; i>=0; i--){
    const b = targets[i];
    const m = b.userData.three;
    m.position.copy(b.position);
    m.quaternion.copy(b.quaternion);
    if (b.position.y < -10){
      world.removeBody(b); scene.remove(m); targets.splice(i,1);
    }
  }

  for (let i = projectiles.length-1; i>=0; i--){
    const p = projectiles[i];
    const m = p.userData.three;
    m.position.copy(p.position);
    p.userData.life -= dt;
    if (p.userData.life <= 0 || p.position.y < -5){
      world.removeBody(p); scene.remove(m); projectiles.splice(i,1); continue;
    }
    for (let j = targets.length-1; j>=0; j--){
      const t = targets[j];
      const dist2 = p.position.vsub(t.position).lengthSquared();
      const r = (t.shapes[0].radius) + projRadius + 0.01;
      if (dist2 <= r*r){
        const imp = p.velocity.scale(0.15);
        t.applyImpulse(imp, t.position);
        world.removeBody(p); scene.remove(m); projectiles.splice(i,1);
        if (Math.random() < 0.6){
          world.removeBody(t); scene.remove(t.userData.three); targets.splice(j,1);
        }
        break;
      }
    }
  }

  controls.target.lerp(playerMesh.position, 0.08);
  controls.update();
  renderer.render(scene, camera);
}
animate();
  
