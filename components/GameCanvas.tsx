import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// @ts-ignore
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// @ts-ignore
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { GameState, CarConfig, PowerUpLevels, PowerUpType, CarModel } from '../types';
import { GAME_CONFIG, SCALING_CONFIG, COLORS, CAR_MODELS, RARITY_BONUS } from '../constants';
import { audioManager } from '../utils/AudioManager';

// --- GEOMETRY CACHE ---
const geoCache: Record<string, THREE.BufferGeometry> = {};
const getCachedGeo = (Type: any, args: any[]) => {
    const key = Type.name + args.join('_');
    if (!geoCache[key]) {
        geoCache[key] = new Type(...args);
    }
    return geoCache[key];
};

// --- SHARED MATERIALS (OPTIMIZATION) ---
const MAT_GLASS = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 100, transparent: true, opacity: 0.9 });
const MAT_DARK_METAL = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 30 });
const MAT_CHROME = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 200, specular: 0xffffff });
const MAT_TIRE = new THREE.MeshLambertMaterial({ color: 0x111111 });
const MAT_RIM_DARK = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 50 });

const MAT_ENEMY_BODY = new THREE.MeshPhongMaterial({ color: COLORS.enemy, shininess: 50 });
const MAT_ENEMY_EMISSIVE = new THREE.MeshBasicMaterial({ color: COLORS.enemyEmissive });
const MAT_COIN = new THREE.MeshPhongMaterial({ color: COLORS.coin, emissive: COLORS.coinEmissive, shininess: 100 });
const MAT_GEM = new THREE.MeshPhongMaterial({ color: COLORS.gem, emissive: COLORS.gemEmissive, shininess: 100, transparent: true, opacity: 0.9 });

const MAT_NEON_HEADLIGHT = new THREE.MeshBasicMaterial({ color: 0xccffff }); // Bright white/blue glow
const MAT_NEON_TAILLIGHT = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Bright red glow

const MAT_SHIELD_CORE = new THREE.MeshBasicMaterial({ color: COLORS.shield });
const MAT_MAGNET_CORE = new THREE.MeshBasicMaterial({ color: COLORS.magnet });
const MAT_SHIELD_RING = new THREE.MeshBasicMaterial({ color: COLORS.shield, wireframe: true });
const MAT_MAGNET_RING = new THREE.MeshBasicMaterial({ color: COLORS.magnet, wireframe: true });

// --- PROCEDURAL TEXTURES ---
const createBuildingTexture = () => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Dark Base
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, size, size);

        // Windows
        ctx.fillStyle = '#442266'; // Dim purple light base
        // Draw grid
        const rows = 8; const cols = 4;
        const w = size / cols; const h = size / rows;
        const pad = 4;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                // Randomly light up windows
                if (Math.random() > 0.4) {
                    ctx.fillStyle = Math.random() > 0.8 ? '#ff00ff' : (Math.random() > 0.5 ? '#00ffff' : '#221133');
                    ctx.fillRect(x * w + pad, y * h + pad, w - pad * 2, h - pad * 2);
                } else {
                    ctx.fillStyle = '#0a0a15'; // Unlit
                    ctx.fillRect(x * w + pad, y * h + pad, w - pad * 2, h - pad * 2);
                }
            }
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; // Pixelated look
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
};
const MAT_BUILDING = new THREE.MeshStandardMaterial({
    map: createBuildingTexture(),
    color: 0x8888aa,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x110022,
    emissiveMap: createBuildingTexture(), // Self illuminate windows
    emissiveIntensity: 1.5
});


const GEO_EXHAUST = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
const GEO_WHEEL_TANK = new THREE.CylinderGeometry(0.6, 0.6, 0.8, 16);
const GEO_SUV_WHEEL = new THREE.CylinderGeometry(0.55, 0.55, 0.7, 16);
const GEO_RIM = new THREE.TorusGeometry(0.3, 0.05, 8, 16);

const createRacingWheel = () => {
    const group = new THREE.Group();
    // Tire
    const t = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.35, 0.35, 0.4, 32]), MAT_TIRE);
    t.rotation.z = Math.PI / 2;
    // Rim
    const r = new THREE.Mesh(getCachedGeo(THREE.TorusGeometry, [0.22, 0.04, 16, 32]), MAT_CHROME);
    r.rotation.y = Math.PI / 2;
    // Spokes (6-spoke TE37 style)
    const sGeo = getCachedGeo(THREE.BoxGeometry, [0.04, 0.42, 0.02]);
    for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(sGeo, MAT_RIM_DARK);
        s.rotation.x = i * (Math.PI / 3);
        s.position.x = 0.05; // recessed
        group.add(s);
    }
    // Brake Disc
    const disc = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.3, 0.3, 0.05, 32]), MAT_DARK_METAL);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = -0.05;
    // Caliper
    const cal = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.15, 0.25, 0.15]), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    cal.position.set(-0.05, 0.2, 0.15);

    group.add(t, r, disc, cal);
    return group;
};

// --- ENVIRONMENT ASSETS ---
const createStreetLight = (side: number) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 8, 8]), MAT_DARK_METAL);
    pole.position.y = 4;
    const arm = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.5, 0.15, 0.15]), MAT_DARK_METAL);
    arm.position.set(side * -1.0, 7.8, 0);
    const head = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.8, 0.2, 0.4]), MAT_DARK_METAL);
    head.position.set(side * -2.0, 7.7, 0);
    const light = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.1, 0.3]), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    light.position.set(side * -2.0, 7.6, 0);

    group.add(pole, arm, head, light);
    return group;
};

// --- DETAILED JDM CARS ---

// 1. MINI COOPER S
const createMini = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Compact Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.5, 0.45, 3.2]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Contrast Roof (White)
    const roof = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.45, 0.05, 1.8]), new THREE.MeshPhongMaterial({ color: 0xffffff }));
    roof.position.set(0, 0.95, -0.2); group.add(roof);
    // Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.45, 1.6]), MAT_GLASS);
    cabin.position.set(0, 0.75, -0.2); group.add(cabin);
    // Round Headlights (NEON)
    const hlGeo = getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 0.05, 16]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.rotation.x = Math.PI / 2; hlL.position.set(-0.5, 0.5, 1.6);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.rotation.x = Math.PI / 2; hlR.position.set(0.5, 0.5, 1.6); group.add(hlL, hlR);
    // Grille (Hexagonal)
    const gr = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.2, 0.05]), MAT_DARK_METAL);
    gr.position.set(0, 0.35, 1.61); group.add(gr);
    // Hood Scoop
    const scoop = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.05, 0.2]), MAT_DARK_METAL);
    scoop.position.set(0, 0.73, 0.8); group.add(scoop);
    // Tail Lights (Vertical Oval) (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.3, 0.05]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.6, 0.6, -1.61);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.6, 0.6, -1.61); group.add(tlL, tlR);
    // Details
    addMirrors(group, bodyMat, 0.75, 0.65, 0.3);
    addWipers(group, 0.76, 0.5);
    addExhaust(group, 0.05, 0.2, -1.65, true); // Center dual
    // Wheels
    const wheels = [[-0.7, 0.3, -1.1], [0.7, 0.3, -1.1], [-0.7, 0.3, 1.2], [0.7, 0.3, 1.2]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 2. BMW M3 E46
const createBMW_M3 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Coupe Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.5, 4.4]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Power Dome Hood
    const dome = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.05, 1.2]), bodyMat);
    dome.position.set(0, 0.76, 1.0); group.add(dome);
    // Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.45, 1.8]), MAT_GLASS);
    cabin.position.set(0, 0.9, -0.3); group.add(cabin);
    // Kidney Grille
    const kGeo = getCachedGeo(THREE.BoxGeometry, [0.25, 0.15, 0.05]);
    const kL = new THREE.Mesh(kGeo, MAT_DARK_METAL); kL.position.set(-0.15, 0.5, 2.21);
    const kR = new THREE.Mesh(kGeo, MAT_DARK_METAL); kR.position.set(0.15, 0.5, 2.21); group.add(kL, kR);
    // Headlights (Double rounded bottom) (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.15, 0.05]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.6, 0.55, 2.21);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.6, 0.55, 2.21); group.add(hlL, hlR);
    // Side Vents (M3 Gills)
    const gill = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.1, 0.2]), MAT_DARK_METAL);
    const gL = gill.clone(); gL.position.set(-0.91, 0.6, 1.0);
    const gR = gill.clone(); gR.position.set(0.91, 0.6, 1.0); group.add(gL, gR);
    // Tail Lights (L-shape ish) (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.15, 0.05]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.6, 0.6, -2.21);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.6, 0.6, -2.21); group.add(tlL, tlR);
    // Rear Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.15, 0.1]), MAT_DARK_METAL);
    diff.position.set(0, 0.3, -2.2); group.add(diff);
    // Details
    addMirrors(group, bodyMat, 0.9, 0.7, 0.4);
    addWipers(group, 0.8, 0.5);
    [-0.2, -0.1, 0.1, 0.2].forEach(x => addExhaust(group, x, 0.25, -2.25, false));
    // Wheels
    const wheels = [[-0.9, 0.35, -1.4], [0.9, 0.35, -1.4], [-0.9, 0.35, 1.4], [0.9, 0.35, 1.4]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 3. HONDA CIVIC EK9 (Type R)
const createCivic = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Hatch Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.45, 4.0]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Side Skirts
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.75, 0.1, 2.6]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    // Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.45, 2.0]), MAT_GLASS);
    cabin.position.set(0, 0.9, -0.2); group.add(cabin);
    // Roof Spoiler (Type R)
    const spoiler = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.05, 0.4]), bodyMat);
    spoiler.position.set(0, 1.15, -1.2); spoiler.rotation.x = 0.2; group.add(spoiler);
    // Headlights (Big eyes) (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.2, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.6, 0.6, 2.0);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.6, 0.6, 2.0); group.add(hlL, hlR);
    // Type R Grille
    const gr = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.1, 0.05]), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    gr.position.set(0, 0.6, 2.01); group.add(gr);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.3, 0.2, 0.1]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.65, 0.6, -2.01);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.65, 0.6, -2.01); group.add(tlL, tlR);
    // Rear Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.15, 0.1]), MAT_DARK_METAL);
    diff.position.set(0, 0.3, -2.0); group.add(diff);
    // Details
    addMirrors(group, bodyMat, 0.85, 0.75, 0.5);
    addWipers(group, 0.9, 0.6);
    addExhaust(group, 0.6, 0.25, -2.05, false); // Single cannon
    // Wheels
    const wheels = [[-0.9, 0.35, -1.3], [0.9, 0.35, -1.3], [-0.9, 0.35, 1.3], [0.9, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 4. HONDA S2000
const createS2000 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Roadster Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.4, 4.0]), bodyMat);
    body.position.y = 0.45; group.add(body);
    // Side Skirts
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.75, 0.1, 2.4]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    // Open Top / Interior
    const intGeo = getCachedGeo(THREE.BoxGeometry, [1.5, 0.3, 1.5]);
    const interior = new THREE.Mesh(intGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    interior.position.set(0, 0.6, -0.2); group.add(interior);
    // Roll Hoops
    const hoopGeo = getCachedGeo(THREE.TorusGeometry, [0.15, 0.04, 8, 16, Math.PI]);
    // Mirrors
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.8, 0.65, 0.2);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.8, 0.65, 0.2); group.add(mirL, mirR);
    // Headlights (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.35, 0.15, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.6, 0.55, 1.95); hlL.rotation.y = 0.2;
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.6, 0.55, 1.95); hlR.rotation.y = -0.2; group.add(hlL, hlR);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.3, 0.15, 0.05]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.6, 0.6, -2.01);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.6, 0.6, -2.01); group.add(tlL, tlR);
    // Wheels
    const wheels = [[-0.85, 0.3, -1.3], [0.85, 0.3, -1.3], [-0.85, 0.3, 1.3], [0.85, 0.3, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 5. NISSAN SILVIA S15 (Spec-R)
const createSilviaS15 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.45, 4.4]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Side Skirts (Aero)
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.75, 0.15, 2.6]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    // Sleek Coupe Roof
    const cabin = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.7, 0.8, 2.2, 4]), MAT_GLASS);
    cabin.rotation.y = Math.PI / 4; cabin.scale.set(1.3, 0.5, 1.0); cabin.position.set(0, 0.85, -0.3); group.add(cabin);
    // Door Handles
    const handleGeo = getCachedGeo(THREE.BoxGeometry, [0.05, 0.05, 0.2]);
    const hL = new THREE.Mesh(handleGeo, bodyMat); hL.position.set(-0.86, 0.65, -0.2);
    const hR = new THREE.Mesh(handleGeo, bodyMat); hR.position.set(0.86, 0.65, -0.2); group.add(hL, hR);
    // Aggressive Headlights (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.45, 0.15, 0.2]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.6, 0.55, 2.15); hlL.rotation.y = 0.3;
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.6, 0.55, 2.15); hlR.rotation.y = -0.3; group.add(hlL, hlR);
    // Low Wing
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.05, 0.3]), bodyMat);
    wing.position.set(0, 0.8, -2.1);
    const wStands = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.2, 0.1]), bodyMat); wStands.position.set(0, 0.7, -2.1);
    group.add(wing, wStands);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [1.4, 0.15, 0.1]);
    const tl = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tl.position.set(0, 0.6, -2.21); group.add(tl);
    // Rear Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.2, 0.1]), MAT_DARK_METAL);
    diff.position.set(0, 0.3, -2.21); group.add(diff);
    // Massive Exhaust
    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.12, 0.12, 0.3, 8]), MAT_CHROME);
    ex.rotation.set(Math.PI / 2, 0, -0.2); ex.position.set(-0.6, 0.25, -2.15); group.add(ex);
    // Intercooler
    const inter = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.2, 0.1]), MAT_CHROME);
    inter.position.set(0, 0.3, 2.22); group.add(inter);
    // Mirrors
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.8, 0.65, 0.5);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.8, 0.65, 0.5); group.add(mirL, mirR);
    // Wipers
    addWipers(group, 0.75, 0.6);
    // Wheels
    const wheels = [[-0.85, 0.3, -1.3], [0.85, 0.3, -1.3], [-0.85, 0.3, 1.3], [0.85, 0.3, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 6. MITSUBISHI EVO VI
const createEvo = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Rally Sedan Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.75, 0.6, 4.3]), bodyMat);
    body.position.y = 0.55; group.add(body);
    // Side Skirts
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.8, 0.15, 2.4]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.5, 2.0]), MAT_GLASS);
    cabin.position.set(0, 1.0, -0.3); group.add(cabin);
    // Door Handles
    const handleGeo = getCachedGeo(THREE.BoxGeometry, [0.05, 0.05, 0.15]);
    const hL1 = new THREE.Mesh(handleGeo, bodyMat); hL1.position.set(-0.88, 0.8, 0.5);
    const hL2 = new THREE.Mesh(handleGeo, bodyMat); hL2.position.set(-0.88, 0.8, -0.5);
    const hR1 = new THREE.Mesh(handleGeo, bodyMat); hR1.position.set(0.88, 0.8, 0.5);
    const hR2 = new THREE.Mesh(handleGeo, bodyMat); hR2.position.set(0.88, 0.8, -0.5); group.add(hL1, hL2, hR1, hR2);
    // Hood Vents
    const ventGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.05, 0.2]);
    const ventL = new THREE.Mesh(ventGeo, MAT_DARK_METAL); ventL.position.set(-0.4, 0.86, 1.5);
    const ventR = new THREE.Mesh(ventGeo, MAT_DARK_METAL); ventR.position.set(0.4, 0.86, 1.5); group.add(ventL, ventR);
    // Huge Fog Lights (Improved) (NEON)
    const fogGeo = getCachedGeo(THREE.CylinderGeometry, [0.2, 0.2, 0.1, 16]);
    const fL = new THREE.Mesh(fogGeo, MAT_NEON_HEADLIGHT); fL.rotation.x = Math.PI / 2; fL.position.set(-0.5, 0.45, 2.16);
    const fR = new THREE.Mesh(fogGeo, MAT_NEON_HEADLIGHT); fR.rotation.x = Math.PI / 2; fR.position.set(0.5, 0.45, 2.16); group.add(fL, fR);
    // Main Headlights(Square) (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.35, 0.15, 0.05]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.6, 0.7, 2.16);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.6, 0.7, 2.16); group.add(hlL, hlR);
    // Intercooler Mesh
    const intGeo = getCachedGeo(THREE.BoxGeometry, [0.7, 0.3, 0.1]);
    const int = new THREE.Mesh(intGeo, MAT_DARK_METAL); int.position.set(0, 0.35, 2.16); group.add(int);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.2, 0.1]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.6, 0.7, -2.16);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.6, 0.7, -2.16); group.add(tlL, tlR);
    // Big Wing
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.1, 0.4]), bodyMat);
    wing.position.set(0, 1.25, -2.0);
    const wPillars = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.4, 0.1]), bodyMat);
    wPillars.position.set(0, 1.0, -2.0); group.add(wing, wPillars);
    // Roof Vortex Generator
    const vGeo = getCachedGeo(THREE.ConeGeometry, [0.05, 0.1, 4]);
    for (let i = -0.6; i <= 0.6; i += 0.3) {
        const v = new THREE.Mesh(vGeo, bodyMat);
        v.position.set(i, 1.26, -1.2); group.add(v);
    }
    // Details
    addMirrors(group, bodyMat, 0.9, 0.8, 0.6);
    addWipers(group, 0.85, 0.7);
    addExhaust(group, 0.6, 0.25, -2.15, false);
    // Wheels
    const wheels = [[-0.9, 0.35, -1.3], [0.9, 0.35, -1.3], [-0.9, 0.35, 1.3], [0.9, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 7. SUBARU IMPREZA 22B
const createImpreza = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Widebody Coupe
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.55, 4.3]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Side Skirts
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.85, 0.15, 2.4]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.5, 1.8]), MAT_GLASS);
    cabin.position.set(0, 0.9, -0.4); group.add(cabin);
    // Door Handles
    const handleGeo = getCachedGeo(THREE.BoxGeometry, [0.05, 0.05, 0.15]);
    const hL = new THREE.Mesh(handleGeo, MAT_DARK_METAL); hL.position.set(-0.91, 0.7, 0.0);
    const hR = new THREE.Mesh(handleGeo, MAT_DARK_METAL); hR.position.set(0.91, 0.7, 0.0); group.add(hL, hR);
    // Hood Scoop
    const scoop = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.15, 0.5]), bodyMat);
    scoop.position.set(0, 0.8, 0.8); group.add(scoop);
    // Hood Vents (Impreza style)
    const ventGeo = getCachedGeo(THREE.BoxGeometry, [0.2, 0.05, 0.3]);
    const vL = new THREE.Mesh(ventGeo, MAT_DARK_METAL); vL.position.set(-0.5, 0.78, 1.2);
    const vR = new THREE.Mesh(ventGeo, MAT_DARK_METAL); vR.position.set(0.5, 0.78, 1.2); group.add(vL, vR);
    // Fog Lights (Large Rally Style) (NEON)
    const fogGeo = getCachedGeo(THREE.CylinderGeometry, [0.25, 0.25, 0.1, 16]);
    const fL = new THREE.Mesh(fogGeo, MAT_NEON_HEADLIGHT); fL.rotation.x = Math.PI / 2; fL.position.set(-0.5, 0.45, 2.16);
    const fR = new THREE.Mesh(fogGeo, MAT_NEON_HEADLIGHT); fR.rotation.x = Math.PI / 2; fR.position.set(0.5, 0.45, 2.16); group.add(fL, fR);
    // Lower Grille
    const gr = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.8, 0.2, 0.1]), MAT_DARK_METAL);
    gr.position.set(0, 0.3, 2.16); group.add(gr);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.2, 0.1]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.6, 0.7, -2.16);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.6, 0.7, -2.16); group.add(tlL, tlR);
    // High Wing
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.1, 0.3]), bodyMat);
    wing.position.set(0, 1.2, -2.0); group.add(wing);
    const wStands = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.4, 0.1]), bodyMat);
    wStands.position.set(0, 1.0, -2.0); group.add(wStands);
    // Mirrors
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.85, 0.7, 0.3);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.85, 0.7, 0.3); group.add(mirL, mirR);
    // Exhaust
    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.1, 0.1, 0.2, 8]), MAT_CHROME);
    ex.rotation.set(Math.PI / 2, 0, -0.2); ex.position.set(0.6, 0.25, -2.15); group.add(ex);
    // Wipers
    addWipers(group, 0.75, 0.6);
    // Wheels
    const wheels = [[-0.95, 0.35, -1.3], [0.95, 0.35, -1.3], [-0.95, 0.35, 1.3], [0.95, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 8. NISSAN 350Z
const create350Z = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Curvy Coupe
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.55, 4.2]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Side Skirts
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.85, 0.1, 2.4]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    // Fastback roof
    const cabin = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [1.0, 1.2, 2.5, 4]), MAT_GLASS);
    cabin.rotation.y = Math.PI / 4; cabin.scale.set(0.9, 0.4, 1.0); cabin.position.set(0, 0.8, -0.5); group.add(cabin);
    // Vertical Headlights (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.25, 0.6, 0.2]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.rotation.set(-0.5, 0, 0.2); hlL.position.set(-0.7, 0.65, 1.8);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.rotation.set(-0.5, 0, -0.2); hlR.position.set(0.7, 0.65, 1.8); group.add(hlL, hlR);
    // Lower Grille
    const gr = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.2, 0.1]), MAT_DARK_METAL);
    gr.position.set(0, 0.35, 2.11); group.add(gr);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [0.2, 0.4, 0.1]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.position.set(-0.7, 0.7, -2.11);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.position.set(0.7, 0.7, -2.11); group.add(tlL, tlR);
    // Rear Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.2, 0.1]), MAT_DARK_METAL);
    diff.position.set(0, 0.3, -2.11); group.add(diff);
    // Vertical Door Handles
    const handle = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.2, 0.05]), MAT_CHROME);
    const hL = handle.clone(); hL.position.set(-0.91, 0.8, 0.2);
    const hR = handle.clone(); hR.position.set(0.91, 0.8, 0.2); group.add(hL, hR);
    // Mirrors
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.85, 0.7, 0.5);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.85, 0.7, 0.5); group.add(mirL, mirR);
    // Dual Exhausts
    const exGeo = getCachedGeo(THREE.CylinderGeometry, [0.1, 0.1, 0.2, 8]);
    const exL = new THREE.Mesh(exGeo, MAT_CHROME); exL.rotation.x = Math.PI / 2; exL.position.set(-0.6, 0.3, -2.1);
    const exR = new THREE.Mesh(exGeo, MAT_CHROME); exR.rotation.x = Math.PI / 2; exR.position.set(0.6, 0.3, -2.1); group.add(exL, exR);
    // Wipers
    addWipers(group, 0.85, 0.6);
    // Wheels
    const wheels = [[-0.95, 0.35, -1.3], [0.95, 0.35, -1.3], [-0.95, 0.35, 1.3], [0.95, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 9. MAZDA RX-7 FD
// 9. MAZDA RX-7 FD (Remastered Spirit R)
const createRX7 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();

    // 1. Fluid Body (Curvy Waist)
    // Main Hull
    const hull = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.4, 4.2]), bodyMat);
    hull.position.y = 0.5; group.add(hull);

    // Rounded Sides (Doors)
    const doorL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.85, 0.3, 2.0]), bodyMat); doorL.position.set(0, 0.5, 0);
    group.add(doorL);

    // 2. Double Bubble Roof
    const roofBase = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.5, 0.35, 1.8]), MAT_GLASS);
    roofBase.position.set(0, 0.85, -0.2); group.add(roofBase);

    // The "Bubbles"
    const bubbleGeo = getCachedGeo(THREE.SphereGeometry, [0.45, 16, 16]);
    const bL = new THREE.Mesh(bubbleGeo, MAT_GLASS); bL.scale.set(1, 0.3, 1.5); bL.position.set(-0.35, 1.05, -0.3);
    const bR = new THREE.Mesh(bubbleGeo, MAT_GLASS); bR.scale.set(1, 0.3, 1.5); bR.position.set(0.35, 1.05, -0.3);
    group.add(bL, bR);

    // 3. Pop-up Headlights (Sleek/Closed)
    const popGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.05, 0.6]);
    const popL = new THREE.Mesh(popGeo, bodyMat); popL.position.set(-0.6, 0.72, 1.6);
    const popR = new THREE.Mesh(popGeo, bodyMat); popR.position.set(0.6, 0.72, 1.6);
    // Panel lines
    const lineL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.45, 0.01, 0.55]), MAT_DARK_METAL); lineL.position.y = 0.03; popL.add(lineL);
    const lineR = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.45, 0.01, 0.55]), MAT_DARK_METAL); lineR.position.y = 0.03; popR.add(lineR);
    group.add(popL, popR);

    // Running Lights/Turn Signals (The slim ovals)
    const sigGeo = getCachedGeo(THREE.CylinderGeometry, [0.05, 0.05, 0.4, 8]);
    const sigL = new THREE.Mesh(sigGeo, MAT_NEON_HEADLIGHT); sigL.rotation.z = Math.PI / 2; sigL.position.set(-0.7, 0.45, 2.05);
    const sigR = new THREE.Mesh(sigGeo, MAT_NEON_HEADLIGHT); sigR.rotation.z = Math.PI / 2; sigR.position.set(0.7, 0.45, 2.05);
    group.add(sigL, sigR);

    // 4. Smiley Intake
    const smile = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.2, 0.1]), MAT_DARK_METAL);
    smile.position.set(0, 0.3, 2.15); group.add(smile);
    const lip = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.3]), bodyMat);
    lip.position.set(0, 0.2, 2.2); group.add(lip);

    // 5. Smoked Tail Light Bar (The full width iconic look)
    const tlBar = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.2, 0.1]), new THREE.MeshPhongMaterial({ color: 0x330000, shininess: 100 }));
    tlBar.position.set(0, 0.65, -2.12); group.add(tlBar);

    // Neon element inside
    const tlNeon = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.08, 0.05]), MAT_NEON_TAILLIGHT);
    tlNeon.position.set(0, 0.65, -2.13); group.add(tlNeon);

    // 6. Rear Diffuser & Exhaust
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.15, 0.2]), MAT_DARK_METAL);
    diff.position.set(0, 0.3, -2.1); group.add(diff);

    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.12, 0.12, 0.4, 16]), MAT_CHROME);
    ex.rotation.set(Math.PI / 2, 0, 0.3); ex.position.set(0.5, 0.25, -2.2); group.add(ex);

    // Mirrors
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.85, 0.65, 0.4);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.85, 0.65, 0.4); group.add(mirL, mirR);

    // Wheels
    const wheels = [[-0.9, 0.35, -1.3], [0.9, 0.35, -1.3], [-0.9, 0.35, 1.3], [0.9, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 10. HONDA NSX NA1
const createNSX = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Mid-engine profile
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.45, 4.5]), bodyMat);
    body.position.y = 0.45; group.add(body);
    // Side Skirts + Side Scoop
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.95, 0.1, 2.6]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.35, 0); group.add(skirt);
    const scoopGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.3, 0.6]);
    const scL = new THREE.Mesh(scoopGeo, MAT_DARK_METAL); scL.position.set(-0.95, 0.5, -0.5);
    const scR = new THREE.Mesh(scoopGeo, MAT_DARK_METAL); scR.position.set(0.95, 0.5, -0.5); group.add(scL, scR);
    // Jet fighter canopy look
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.45, 1.5]), MAT_GLASS);
    cabin.position.set(0, 0.85, 0.2); group.add(cabin);
    const trunk = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.5, 1.2]), bodyMat);
    trunk.position.set(0, 0.5, -1.2); group.add(trunk);
    // Pop-ups
    const popGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.05, 0.4]);
    const popL = new THREE.Mesh(popGeo, bodyMat); popL.position.set(-0.6, 0.68, 1.8);
    const popR = new THREE.Mesh(popGeo, bodyMat); popR.position.set(0.6, 0.68, 1.8); group.add(popL, popR);
    // Lower Grille & Fog Lights (NEON)
    const gr = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.15, 0.1]), MAT_DARK_METAL);
    gr.position.set(0, 0.35, 2.26); group.add(gr);
    const fogL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.05, 0.05]), MAT_NEON_HEADLIGHT);
    fogL.position.set(-0.5, 0.35, 2.32); group.add(fogL);
    const fogR = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.05, 0.05]), MAT_NEON_HEADLIGHT);
    fogR.position.set(0.5, 0.35, 2.32); group.add(fogR);
    // Tail Lights (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [1.8, 0.1, 0.1]);
    const tl = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT);
    tl.position.set(0, 0.6, -2.26); group.add(tl);
    // Integrated Wing
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.1, 0.4]), bodyMat);
    wing.position.set(0, 0.85, -1.8); group.add(wing);
    // Rear Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.15, 0.2]), MAT_DARK_METAL);
    diff.position.set(0, 0.3, -2.25); group.add(diff);
    // Mirrors
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.2, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.9, 0.65, 0.8);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.9, 0.65, 0.8); group.add(mirL, mirR);
    // Details
    addWipers(group, 0.8, 0.6);
    addExhaust(group, 0.7, 0.25, -2.3, true); // Wide Dual
    // Wheels
    const wheels = [[-0.95, 0.35, -1.5], [0.95, 0.35, -1.5], [-1.0, 0.35, 1.2], [1.0, 0.35, 1.2]]; // Staggered
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 11. NISSAN SKYLINE GT-R R34
// 11. NISSAN SKYLINE GT-R R34 (Z-Tune Remaster)
const createGTR_R34 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();

    // 1. Boxy Muscular Body
    const chassis = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.5, 4.6]), bodyMat);
    chassis.position.y = 0.5; group.add(chassis);

    // Wide Fenders (Bulging)
    const fenderGeo = getCachedGeo(THREE.BoxGeometry, [0.2, 0.4, 0.8]);
    const fFL = new THREE.Mesh(fenderGeo, bodyMat); fFL.position.set(-1.0, 0.5, 1.5);
    const fFR = new THREE.Mesh(fenderGeo, bodyMat); fFR.position.set(1.0, 0.5, 1.5);
    const fRL = new THREE.Mesh(fenderGeo, bodyMat); fRL.position.set(-1.0, 0.5, -1.5);
    const fRR = new THREE.Mesh(fenderGeo, bodyMat); fRR.position.set(1.0, 0.5, -1.5);
    group.add(fFL, fFR, fRL, fRR);

    // 2. Greenhouse (Cabin)
    const cabBase = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.45, 2.0]), MAT_GLASS);
    cabBase.position.set(0, 0.9, -0.3); group.add(cabBase);
    const roof = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.5, 0.05, 1.6]), bodyMat);
    roof.position.set(0, 1.15, -0.3); group.add(roof);

    // 3. Z-Tune Hood Vents
    const hood = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.1, 1.4]), bodyMat);
    hood.position.set(0, 0.76, 1.4); group.add(hood);
    const vent = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.05, 0.6]), MAT_DARK_METAL);
    vent.position.set(0, 0.77, 1.4); group.add(vent);

    // 4. Aggressive Front
    // Headlights (Angled blocks)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.2, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.65, 0.65, 2.31); hlL.rotation.z = 0.1;
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.65, 0.65, 2.31); hlR.rotation.z = -0.1;
    group.add(hlL, hlR);

    // Grille 
    const gr = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.8, 0.2, 0.1]), MAT_DARK_METAL);
    gr.position.set(0, 0.65, 2.31); group.add(gr);
    // Lower Intercooler
    const ic = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.3, 0.1]), new THREE.MeshLambertMaterial({ color: 0xcccccc })); // Silver intercooler
    ic.position.set(0, 0.35, 2.31); group.add(ic);

    // Splitter
    const spl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.05, 0.4]), MAT_DARK_METAL);
    spl.position.set(0, 0.2, 2.4); group.add(spl);

    // 5. The Wing (Tall Boxy)
    const wStems = getCachedGeo(THREE.BoxGeometry, [0.1, 0.5, 0.3]);
    const stL = new THREE.Mesh(wStems, bodyMat); stL.position.set(-0.6, 1.0, -2.1);
    const stR = new THREE.Mesh(wStems, bodyMat); stR.position.set(0.6, 1.0, -2.1);
    const wBlade = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.05, 0.4]), bodyMat);
    wBlade.position.set(0, 1.25, -2.15);
    group.add(stL, stR, wBlade);

    // 6. Iconic Tail Lights (Double Round Neon)
    const tlPanel = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.3, 0.1]), bodyMat);
    tlPanel.position.set(0, 0.65, -2.3); group.add(tlPanel);

    const ringBig = getCachedGeo(THREE.TorusGeometry, [0.12, 0.04, 8, 16]);
    const ringSmall = getCachedGeo(THREE.TorusGeometry, [0.08, 0.03, 8, 16]);

    // Left
    const rL1 = new THREE.Mesh(ringBig, MAT_NEON_TAILLIGHT); rL1.position.set(-0.5, 0.65, -2.36);
    const rL2 = new THREE.Mesh(ringSmall, MAT_NEON_TAILLIGHT); rL2.position.set(-0.8, 0.65, -2.36);
    // Right
    const rR1 = new THREE.Mesh(ringBig, MAT_NEON_TAILLIGHT); rR1.position.set(0.5, 0.65, -2.36);
    const rR2 = new THREE.Mesh(ringSmall, MAT_NEON_TAILLIGHT); rR2.position.set(0.8, 0.65, -2.36);
    group.add(rL1, rL2, rR1, rR2);

    // Titanium Exhaust
    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 0.5, 16]), new THREE.MeshStandardMaterial({ color: 0x88aaff, metalness: 1.0, roughness: 0.2 }));
    ex.rotation.set(Math.PI / 2, 0, -0.4); ex.position.set(0.7, 0.25, -2.4); group.add(ex);

    // Wheels
    const wheels = [[-0.95, 0.35, -1.4], [0.95, 0.35, -1.4], [-0.95, 0.35, 1.4], [0.95, 0.35, 1.4]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 12. TOYOTA SUPRA MK4 (Fixed 2.0)
// 12. TOYOTA SUPRA MK4 (Final Iconic Version)



// 13. FERRARI F40 (The Legend)
const createF40 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Low, Wide Wedge
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.45, 4.4]), bodyMat);
    body.position.y = 0.45; group.add(body);
    // Bubble Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.4, 1.8]), MAT_GLASS);
    cabin.position.set(0, 0.8, -0.2); group.add(cabin);
    // NACA Ducts (Side)
    const ductGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.2, 0.4]);
    const dL_side = new THREE.Mesh(ductGeo, MAT_DARK_METAL); dL_side.position.set(-1.0, 0.5, 0);
    const dR_side = new THREE.Mesh(ductGeo, MAT_DARK_METAL); dR_side.position.set(1.0, 0.5, 0); group.add(dL_side, dR_side);
    // Pop-ups (Closed)
    const popGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.05, 0.3]);
    const popL = new THREE.Mesh(popGeo, bodyMat); popL.position.set(-0.6, 0.68, 1.8);
    const popR = new THREE.Mesh(popGeo, bodyMat); popR.position.set(0.6, 0.68, 1.8); group.add(popL, popR);
    // Fog Lights (in grille) (NEON)
    const fogGeo = getCachedGeo(THREE.BoxGeometry, [0.3, 0.1, 0.05]);
    const fL = new THREE.Mesh(fogGeo, MAT_NEON_HEADLIGHT); fL.position.set(-0.65, 0.4, 2.2);
    const fR = new THREE.Mesh(fogGeo, MAT_NEON_HEADLIGHT); fR.position.set(0.65, 0.4, 2.2); group.add(fL, fR);
    // Front Splitter
    const spl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.05, 0.2]), MAT_DARK_METAL);
    spl.position.set(0, 0.25, 2.2); group.add(spl);
    // Massive Rectangular Wing
    const wSideGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.4, 0.8]);
    const wSL = new THREE.Mesh(wSideGeo, bodyMat); wSL.position.set(-0.95, 0.8, -2.1);
    const wSR = new THREE.Mesh(wSideGeo, bodyMat); wSR.position.set(0.95, 0.8, -2.1);
    const wTop = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.05, 0.4]), bodyMat); wTop.position.set(0, 1.0, -2.1);
    group.add(wSL, wSR, wTop);
    // Tail Lights (Round) (NEON)
    const tlGeo = getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 0.1, 16]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL.rotation.x = Math.PI / 2; tlL.position.set(-0.6, 0.5, -2.21);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR.rotation.x = Math.PI / 2; tlR.position.set(0.6, 0.5, -2.21);
    const tlL2 = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlL2.rotation.x = Math.PI / 2; tlL2.position.set(-0.9, 0.5, -2.21);
    const tlR2 = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tlR2.rotation.x = Math.PI / 2; tlR2.position.set(0.9, 0.5, -2.21);
    group.add(tlL, tlR, tlL2, tlR2);
    // NACA Ducts (Abstract)
    const duct = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.4, 0.1, 0.2]), MAT_DARK_METAL);
    const dL = duct.clone(); dL.position.set(-0.7, 0.5, 0.5); dL.rotation.y = 0.5;
    const dR = duct.clone(); dR.position.set(0.7, 0.5, 0.5); dR.rotation.y = -0.5; group.add(dL, dR);
    // Triple Exhaust
    const exGeo = getCachedGeo(THREE.CylinderGeometry, [0.08, 0.08, 0.2, 8]);
    for (let i = -1; i <= 1; i++) {
        const ex = new THREE.Mesh(exGeo, MAT_CHROME);
        ex.rotation.x = Math.PI / 2; ex.position.set(i * 0.15, 0.4, -2.25); group.add(ex);
    }
    // Deep Rear Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.5, 0.2, 0.2]), MAT_DARK_METAL);
    diff.position.set(0, 0.25, -2.2); group.add(diff);
    // Wipers
    addWipers(group, 0.85, 0.5);
    // Wheels (Star shape logic handled by generic wheel for now, but wide)
    const wheels = [[-0.95, 0.35, -1.4], [0.95, 0.35, -1.4], [-1.0, 0.35, 1.3], [1.0, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 14. LAMBORGHINI HURACAN
const createHuracan_OLD = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Extreme Wedge
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.42, 4.3]), bodyMat);
    body.position.y = 0.42; group.add(body);
    // Widebody/Skirts
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [2.1, 0.1, 2.8]);
    const skirt = new THREE.Mesh(skirtGeo, bodyMat); skirt.position.set(0, 0.25, 0); group.add(skirt);
    // Hexagonal Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.7, 1.4, 2.0, 6]), MAT_GLASS);
    cabin.rotation.y = Math.PI / 6; cabin.rotation.x = -0.1;
    cabin.scale.set(1.4, 0.4, 1.0); cabin.position.set(0, 0.75, -0.1); group.add(cabin);
    // Y-Intakes (Front)
    const inGeo = getCachedGeo(THREE.BoxGeometry, [0.6, 0.2, 0.1]);
    const inL = new THREE.Mesh(inGeo, MAT_DARK_METAL); inL.position.set(-0.6, 0.3, 2.14); inL.rotation.z = -0.2;
    const inR = new THREE.Mesh(inGeo, MAT_DARK_METAL); inR.position.set(0.6, 0.3, 2.14); inR.rotation.z = 0.2; group.add(inL, inR);
    // Headlights (Sharp) (NEON)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.35, 0.1, 0.2]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.7, 0.5, 1.8); hlL.rotation.y = 0.3;
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.7, 0.5, 1.8); hlR.rotation.y = -0.3; group.add(hlL, hlR);
    // Engine Cover Slats
    const slatGeo = getCachedGeo(THREE.BoxGeometry, [1.4, 0.02, 0.1]);
    for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(slatGeo, MAT_DARK_METAL);
        s.position.set(0, 0.6 + i * 0.05, -1.2 - i * 0.3); s.rotation.x = 0.1; group.add(s);
    }
    // Y-Shape Lights (Better Y) (NEON HEADLIGHT)
    const legGeo = getCachedGeo(THREE.BoxGeometry, [0.05, 0.3, 0.05]);
    const leg1L = new THREE.Mesh(legGeo, MAT_NEON_HEADLIGHT); leg1L.position.set(-0.7, 0.5, 2.15); leg1L.rotation.set(0, 0, -0.3); leg1L.rotation.x = Math.PI / 2;
    const leg2L = new THREE.Mesh(legGeo, MAT_NEON_HEADLIGHT); leg2L.position.set(-0.6, 0.5, 2.15); leg2L.rotation.set(0, 0, 0.3); leg2L.rotation.x = Math.PI / 2;
    const leg3L = new THREE.Mesh(legGeo, MAT_NEON_HEADLIGHT); leg3L.position.set(-0.75, 0.5, 2.05); leg3L.rotation.x = Math.PI / 2; // Base

    const leg1R = new THREE.Mesh(legGeo, MAT_NEON_HEADLIGHT); leg1R.position.set(0.7, 0.5, 2.15); leg1R.rotation.set(0, 0, 0.3); leg1R.rotation.x = Math.PI / 2;
    const leg2R = new THREE.Mesh(legGeo, MAT_NEON_HEADLIGHT); leg2R.position.set(0.6, 0.5, 2.15); leg2R.rotation.set(0, 0, -0.3); leg2R.rotation.x = Math.PI / 2;
    const leg3R = new THREE.Mesh(legGeo, MAT_NEON_HEADLIGHT); leg3R.position.set(0.75, 0.5, 2.05); leg3R.rotation.x = Math.PI / 2; // Base
    group.add(leg1L, leg2L, leg3L, leg1R, leg2R, leg3R);

    // Tail Lights (Thin Strip) (NEON)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.1]);
    const tl = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tl.position.set(0, 0.55, -2.16); group.add(tl);
    // Rear Diffuser (Aggressive)
    const diffGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.3, 0.4]);
    for (let i = -0.6; i <= 0.6; i += 0.3) {
        const fin = new THREE.Mesh(diffGeo, MAT_DARK_METAL); fin.position.set(i, 0.25, -2.1); group.add(fin);
    }
    // Details
    addMirrors(group, bodyMat, 0.95, 0.65, 0.5);
    addWipers(group, 0.75, 0.8);
    [-0.2, -0.1, 0.1, 0.2].forEach(x => addExhaust(group, x, 0.3, -2.2, false));
    // Wheels
    const wheels = [[-0.95, 0.35, -1.3], [0.95, 0.35, -1.3], [-0.95, 0.35, 1.3], [0.95, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 15. MCLAREN P1 (Fixed 2.0)
const createP1 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // 1. Low Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.45, 4.4]), bodyMat);
    body.position.y = 0.45; group.add(body);

    // 2. Cabin (Teardrop)
    const cabin = new THREE.Mesh(getCachedGeo(THREE.SphereGeometry, [0.9, 16, 16]), MAT_GLASS);
    cabin.scale.set(1.0, 0.5, 1.6); cabin.position.set(0, 0.8, -0.1); group.add(cabin);

    // 3. Side Smoops (Carved)
    const scoopL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.3, 1.2]), MAT_DARK_METAL); scoopL.position.set(-0.9, 0.5, 0); group.add(scoopL);
    const scoopR = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.3, 1.2]), MAT_DARK_METAL); scoopR.position.set(0.9, 0.5, 0); group.add(scoopR);

    // 4. Logo Headlights (Neon Crescent)
    const hlGeo = getCachedGeo(THREE.CylinderGeometry, [0.15, 0.35, 0.1, 4]); // Simple crescent approximation
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.7, 0.5, 2.0); hlL.rotation.set(Math.PI / 2, 0, 0.5);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.7, 0.5, 2.0); hlR.rotation.set(Math.PI / 2, 0, -0.5);
    group.add(hlL, hlR);

    // 5. Rear Wing (Active)
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.6]), bodyMat);
    wing.position.set(0, 1.0, -1.9);
    // Struts
    const st1 = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.4, 0.1]), MAT_DARK_METAL); st1.position.set(-0.3, 0.8, -1.9);
    const st2 = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.4, 0.1]), MAT_DARK_METAL); st2.position.set(0.3, 0.8, -1.9);
    group.add(wing, st1, st2);

    // 6. Tail (Wavy Neon)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.05]);
    const tl = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT); tl.position.set(0, 0.6, -2.15); group.add(tl);

    // Wheels
    const wheels = [[-0.95, 0.35, -1.3], [0.95, 0.35, -1.3], [-0.95, 0.35, 1.3], [0.95, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 16. MCLAREN F1
const createF1 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Compact Hypercar
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.45, 4.3]), bodyMat);
    body.position.y = 0.45; group.add(body);
    // Side Vents
    const ventGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.3, 0.8]);
    const vL = new THREE.Mesh(ventGeo, MAT_DARK_METAL); vL.position.set(-0.95, 0.5, 0.5);
    const vR = new THREE.Mesh(ventGeo, MAT_DARK_METAL); vR.position.set(0.95, 0.5, 0.5); group.add(vL, vR);
    // Central Canopy
    const cabin = new THREE.Mesh(getCachedGeo(THREE.SphereGeometry, [0.85, 16, 16]), MAT_GLASS);
    cabin.scale.set(1.0, 0.6, 1.4); cabin.position.set(0, 0.8, -0.2); group.add(cabin);
    // Roof Scoop
    const scoop = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.15, 0.6]), bodyMat);
    scoop.position.set(0, 1.1, -0.2); group.add(scoop);
    // Headlights (Better double round, inset)
    const hlGeo = getCachedGeo(THREE.CylinderGeometry, [0.12, 0.12, 0.05, 16]);
    const hlL1 = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL1.rotation.x = Math.PI / 2; hlL1.position.set(-0.5, 0.55, 2.05);
    const hlL2 = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL2.rotation.x = Math.PI / 2; hlL2.position.set(-0.75, 0.6, 1.95);
    const hlR1 = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR1.rotation.x = Math.PI / 2; hlR1.position.set(0.5, 0.55, 2.05);
    const hlR2 = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR2.rotation.x = Math.PI / 2; hlR2.position.set(0.75, 0.6, 1.95);
    group.add(hlL1, hlL2, hlR1, hlR2);
    // Tail Lights (Round) (NEON)
    const tlL = new THREE.Mesh(hlGeo, MAT_NEON_TAILLIGHT); tlL.rotation.x = Math.PI / 2; tlL.position.set(-0.6, 0.6, -2.16);
    const tlR = new THREE.Mesh(hlGeo, MAT_NEON_TAILLIGHT); tlR.rotation.x = Math.PI / 2; tlR.position.set(0.6, 0.6, -2.16);
    group.add(tlL, tlR);
    // Gold Engine Bay
    const gold = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.05, 1.0]), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    gold.position.set(0, 0.68, -1.2); group.add(gold);
    // Mirrors (High stalks)
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.2, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, bodyMat); mirL.position.set(-0.8, 0.9, 0.6);
    const mirR = new THREE.Mesh(mirGeo, bodyMat); mirR.position.set(0.8, 0.9, 0.6); group.add(mirL, mirR);
    // Details
    addWipers(group, 0.85, 0.6);
    [-0.15, 0.15].forEach(x => addExhaust(group, x, 0.7, -2.2, false)); // High quad/dual
    // Wheels
    const wheels = [[-0.95, 0.35, -1.3], [0.95, 0.35, -1.3], [-1.0, 0.35, 1.3], [1.0, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 17. FORMULA 1
const createFormula1 = (bodyMat: THREE.Material, emissiveMat: THREE.Material) => {
    const group = new THREE.Group();
    // group.rotation.y = Math.PI; // User requested inversion (back to default)
    // Narrow Fuselage (Nose to Tail)
    const fuse = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.4, 4.8]), bodyMat);
    fuse.position.y = 0.4; group.add(fuse);
    // Floor (Barge boards)
    const floor = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 3.5]), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    floor.position.set(0, 0.15, 0.5); group.add(floor);
    // Cockpit & Halo
    const cockpit = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.55, 0.3, 0.8]), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    cockpit.position.set(0, 0.5, 0.2); group.add(cockpit);
    const halo = new THREE.Mesh(getCachedGeo(THREE.TorusGeometry, [0.3, 0.04, 8, 12, Math.PI]), MAT_DARK_METAL);
    halo.rotation.y = Math.PI / 2; halo.position.set(0, 0.75, 0.3); group.add(halo);
    const pillar = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.04, 0.04, 0.4]), MAT_DARK_METAL);
    pillar.position.set(0, 0.6, -0.1); group.add(pillar); // center pillar
    // Front Wing (Wide, Low, Complex)
    const fwMain = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.4]), bodyMat);
    fwMain.position.set(0, 0.15, -2.4);
    const fwFlap = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.2]), bodyMat);
    fwFlap.position.set(0, 0.25, -2.35); fwFlap.rotation.x = -0.3;
    const fwEndL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.3, 0.6]), bodyMat);
    fwEndL.position.set(-0.9, 0.2, -2.4);
    const fwEndR = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.3, 0.6]), bodyMat);
    fwEndR.position.set(0.9, 0.2, -2.4);
    group.add(fwMain, fwFlap, fwEndL, fwEndR);
    // Rear Wing (High, Narrow, DRS)
    const rwMain = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.05, 0.4]), bodyMat);
    rwMain.position.set(0, 1.1, 1.8);
    // Rear Rain Light (NEON)
    const rainLight = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.1, 0.05]), MAT_NEON_TAILLIGHT);
    rainLight.position.set(0, 0.3, 2.4); group.add(rainLight);

    const rwPillar = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.6, 0.4]), bodyMat);
    rwPillar.position.set(0, 0.8, 1.8);
    const rwEndL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.4, 0.5]), bodyMat);
    rwEndL.position.set(-0.8, 1.0, 1.8);
    const rwEndR = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.4, 0.5]), bodyMat);
    rwEndR.position.set(0.8, 1.0, 1.8);
    group.add(rwMain, rwPillar, rwEndL, rwEndR);
    // Sidepods (Air Intakes)
    const spGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.4, 1.5]);
    const spL = new THREE.Mesh(spGeo, bodyMat); spL.position.set(-0.55, 0.4, 0.5);
    const spR = new THREE.Mesh(spGeo, bodyMat); spR.position.set(0.55, 0.4, 0.5);
    group.add(spL, spR);
    // Radiator inlets
    const inGeo = getCachedGeo(THREE.PlaneGeometry, [0.3, 0.3]);
    const inL = new THREE.Mesh(inGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    inL.position.set(-0.55, 0.4, -0.26); inL.rotation.y = Math.PI;
    const inR = new THREE.Mesh(inGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    inR.position.set(0.55, 0.4, -0.26); inR.rotation.y = Math.PI;
    group.add(inL, inR);
    // Engine Airbox (Top Intake)
    const airbox = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.3, 0.4, 0.6]), bodyMat);
    airbox.position.set(0, 0.8, 0.6); group.add(airbox);
    // Wheels (Open, wide stance)
    const wGeo = getCachedGeo(THREE.CylinderGeometry, [0.35, 0.35, 0.45, 32]);
    const fTirePos = [[-0.85, -1.6], [0.85, -1.6]]; // Front width, z
    const rTirePos = [[-0.85, 1.6], [0.85, 1.6]];   // Rear width, z

    fTirePos.forEach(p => {
        const w = createRacingWheel(); w.scale.set(1, 1, 1);
        w.position.set(p[0], 0.35, p[1]); group.add(w);
        // Suspension Arms
        const arm = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.5, 0.05, 0.05]), MAT_DARK_METAL);
        arm.position.set(p[0] * 0.6, 0.4, p[1]); group.add(arm);
    });
    rTirePos.forEach(p => {
        const w = createRacingWheel(); w.scale.set(1.2, 1.2, 1.2); // Rear tires bigger
        w.position.set(p[0], 0.42, p[1]); group.add(w);
        // Suspension Arms
        const arm = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.5, 0.05, 0.05]), MAT_DARK_METAL);
        arm.position.set(p[0] * 0.6, 0.4, p[1]); group.add(arm);
    });
    return group;
};

// --- FIGHTER JET (Bonus) ---
const createFighterJet = (bodyMat: THREE.Material, emissiveMat: THREE.Material) => {
    const group = new THREE.Group();

    // Fuselage
    const fuseGeo = getCachedGeo(THREE.ConeGeometry, [0.6, 5.0, 16]);
    const fuse = new THREE.Mesh(fuseGeo, bodyMat);
    fuse.rotation.x = Math.PI / 2;
    group.add(fuse);

    // Cockpit
    const cockGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.4, 1.5]);
    const cockpit = new THREE.Mesh(cockGeo, MAT_GLASS);
    cockpit.position.set(0, 0.4, 0.5);
    group.add(cockpit);

    // Wings
    const wingGeo = getCachedGeo(THREE.BoxGeometry, [4.0, 0.1, 1.5]);
    const wings = new THREE.Mesh(wingGeo, bodyMat);
    wings.position.set(0, 0, 0.5);

    // Wing tips (Missiles/Tanks)
    const tipGeo = getCachedGeo(THREE.CylinderGeometry, [0.1, 0.1, 1.5]);
    const tipL = new THREE.Mesh(tipGeo, MAT_DARK_METAL); tipL.rotation.x = Math.PI / 2; tipL.position.set(-2.0, 0, 0.5);
    const tipR = new THREE.Mesh(tipGeo, MAT_DARK_METAL); tipR.rotation.x = Math.PI / 2; tipR.position.set(2.0, 0, 0.5);
    wings.add(tipL, tipR);
    group.add(wings);

    // Tail fins
    const tailGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.8, 0.8]);
    const tailL = new THREE.Mesh(tailGeo, bodyMat); tailL.position.set(-0.5, 0.5, -1.8); tailL.rotation.z = Math.PI / 6;
    const tailR = new THREE.Mesh(tailGeo, bodyMat); tailR.position.set(0.5, 0.5, -1.8); tailR.rotation.z = -Math.PI / 6;
    group.add(tailL, tailR);

    // Thrusters (NEON)
    const thrustGeo = getCachedGeo(THREE.CylinderGeometry, [0.4, 0.3, 0.5, 8]);
    const thL = new THREE.Mesh(thrustGeo, emissiveMat); thL.rotation.x = Math.PI / 2; thL.position.set(-0.4, 0, -2.5);
    const thR = new THREE.Mesh(thrustGeo, emissiveMat); thR.rotation.x = Math.PI / 2; thR.position.set(0.4, 0, -2.5);
    group.add(thL, thR);

    // Shadow
    const shadow = new THREE.Mesh(getCachedGeo(THREE.PlaneGeometry, [3.0, 5.0]), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.0; // Lower shadow
    group.add(shadow);

    // Floating effect
    const floater = new THREE.Group();
    floater.add(fuse, cockpit, wings, tailL, tailR, thL, thR);
    floater.position.y = 1.5; // Hovering
    group.add(floater);

    return group;
}

// 18. AMBIENT SHIPS (Background)
const createShip = () => {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x334466 });
    const em = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    return group;
}



// --- UTILS FOR CAR DETAILS ---
const addMirrors = (group: THREE.Group, mat: THREE.Material, xPos: number, yPos: number, zPos: number) => {
    const mirGeo = getCachedGeo(THREE.BoxGeometry, [0.15, 0.1, 0.1]);
    const mirL = new THREE.Mesh(mirGeo, mat); mirL.position.set(-xPos, yPos, zPos);
    const mirR = new THREE.Mesh(mirGeo, mat); mirR.position.set(xPos, yPos, zPos);
    group.add(mirL, mirR);
}

const addExhaust = (group: THREE.Group, xOffset: number, yPos: number, zPos: number, dual: boolean) => {
    const exGeo = getCachedGeo(THREE.CylinderGeometry, [0.06, 0.06, 0.2, 8]);
    const mat = MAT_CHROME;
    if (dual) {
        const exL = new THREE.Mesh(exGeo, mat); exL.rotation.x = Math.PI / 2; exL.position.set(-xOffset, yPos, zPos);
        const exR = new THREE.Mesh(exGeo, mat); exR.rotation.x = Math.PI / 2; exR.position.set(xOffset, yPos, zPos);
        group.add(exL, exR);
    } else {
        const ex = new THREE.Mesh(exGeo, mat); ex.rotation.x = Math.PI / 2; ex.position.set(xOffset, yPos, zPos);
        group.add(ex);
    }
}

const addWipers = (group: THREE.Group, yPos: number, zPos: number) => {
    const wipGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.02, 0.02]);
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const w1 = new THREE.Mesh(wipGeo, mat); w1.position.set(-0.3, yPos, zPos); w1.rotation.z = -0.1;
    const w2 = new THREE.Mesh(wipGeo, mat); w2.position.set(0.3, yPos, zPos); w2.rotation.z = -0.1;
    group.add(w1, w2);
}

// 19. PORSCHE 911 GT3 RS (992)
const createPorscheGT3RS = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // 911 Silhouette
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.85, 0.5, 4.4]), bodyMat);
    body.position.y = 0.5; group.add(body);
    // Wide Fenders
    const rFender = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.95, 0.35, 1.2]), bodyMat); rFender.position.set(0, 0.4, -1.2);
    const fFender = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.3, 1.0]), bodyMat); fFender.position.set(0, 0.35, 1.5);
    group.add(rFender, fFender);
    // Cabin (Rounded)
    const cabin = new THREE.Mesh(getCachedGeo(THREE.SphereGeometry, [1.0, 16, 16]), MAT_GLASS);
    cabin.scale.set(0.9, 0.5, 1.4); cabin.position.set(0, 0.85, -0.4); group.add(cabin);
    // Swan Neck Wing
    const wingValance = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.05, 0.5]), bodyMat);
    wingValance.position.set(0, 1.35, -2.1);
    const wStands = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.5, 0.4]), MAT_DARK_METAL); // Swan necks
    wStands.position.set(0, 1.1, -1.8); wStands.rotation.x = 0.3; group.add(wingValance, wStands);
    // Front Vents (Hood)
    const ventGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.05, 0.3]);
    const ventL = new THREE.Mesh(ventGeo, MAT_DARK_METAL); ventL.position.set(-0.4, 0.76, 1.4);
    const ventR = new THREE.Mesh(ventGeo, MAT_DARK_METAL); ventR.position.set(0.4, 0.76, 1.4); group.add(ventL, ventR);
    // Fender Louvres
    const louvre = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.15, 0.02, 0.4]), MAT_DARK_METAL);
    const lL = louvre.clone(); lL.position.set(-0.9, 0.65, 1.5);
    const lR = louvre.clone(); lR.position.set(0.9, 0.65, 1.5); group.add(lL, lR);
    // Headlights (Frog Eye Oval - Rotated for 911 look)
    const hlGeo = getCachedGeo(THREE.CylinderGeometry, [0.22, 0.22, 0.1, 16]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.rotation.set(Math.PI / 3, 0, -0.2); hlL.position.set(-0.65, 0.65, 1.8);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.rotation.set(Math.PI / 3, 0, 0.2); hlR.position.set(0.65, 0.65, 1.8); group.add(hlL, hlR);
    // Tail Light Strip
    const tl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.08, 0.05]), MAT_NEON_TAILLIGHT);
    tl.position.set(0, 0.65, -2.2); group.add(tl);
    // Center Exhaust
    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.08, 0.08, 0.2, 8]), MAT_CHROME);
    ex.rotation.x = Math.PI / 2; ex.position.set(-0.1, 0.3, -2.2);
    const ex2 = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.08, 0.08, 0.2, 8]), MAT_CHROME);
    ex2.rotation.x = Math.PI / 2; ex2.position.set(0.1, 0.3, -2.2); group.add(ex, ex2);
    // Diffuser
    const diff = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.2, 0.2]), MAT_DARK_METAL);
    diff.position.set(0, 0.2, -2.15); group.add(diff);
    // Details
    addMirrors(group, bodyMat, 0.9, 0.7, 0.5);
    addWipers(group, 0.76, 0.6);
    // Wheels
    const wheels = [[-0.95, 0.35, -1.4], [0.95, 0.35, -1.4], [-0.95, 0.35, 1.4], [0.95, 0.35, 1.4]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 20. FERRARI 499P (Le Mans Hypercar)
const createFerrariLM = (bodyMat: THREE.Material, emissiveMat: THREE.Material) => {
    const group = new THREE.Group();
    // Central Monocoque
    const mono = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.5, 4.0]), bodyMat);
    mono.position.y = 0.5; group.add(mono);
    // Bubble Cockpit
    const cabin = new THREE.Mesh(getCachedGeo(THREE.SphereGeometry, [0.7, 16, 16]), MAT_GLASS);
    cabin.scale.set(0.9, 0.6, 1.2); cabin.position.set(0, 0.8, 0.2); group.add(cabin);
    // Wide Wheel Arches (Separated)
    const archGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.4, 1.2]);
    const fl = new THREE.Mesh(archGeo, bodyMat); fl.position.set(-0.75, 0.4, 1.6);
    const fr = new THREE.Mesh(archGeo, bodyMat); fr.position.set(0.75, 0.4, 1.6);
    const rl = new THREE.Mesh(archGeo, bodyMat); rl.position.set(-0.75, 0.45, -1.4);
    const rr = new THREE.Mesh(archGeo, bodyMat); rr.position.set(0.75, 0.45, -1.4);
    group.add(fl, fr, rl, rr);
    // Shark Fin
    const fin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.6, 2.0]), bodyMat);
    fin.position.set(0, 0.9, -1.0); group.add(fin);
    // Rear Wing (Massive)
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.05, 0.5]), bodyMat);
    wing.position.set(0, 1.1, -2.2);
    const wEndL = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.5, 0.8]), bodyMat); wEndL.position.set(-1.0, 0.8, -2.2);
    const wEndR = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.05, 0.5, 0.8]), bodyMat); wEndR.position.set(1.0, 0.8, -2.2);
    group.add(wing, wEndL, wEndR);
    // Front Splitter
    const spl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.05, 0.5]), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    spl.position.set(0, 0.2, 2.3); group.add(spl);
    // Headlights (Thin Slits)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.05, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.75, 0.4, 2.2);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.75, 0.4, 2.2); group.add(hlL, hlR);
    // Yellow Stripes (Emissive)
    const stripe = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.02, 1.0]), emissiveMat);
    stripe.position.set(0, 0.76, 1.6); group.add(stripe);
    // Tail Light Bar
    const tl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.05, 0.05]), MAT_NEON_TAILLIGHT);
    tl.position.set(0, 0.6, -2.0); group.add(tl);
    // Wheels
    const wheels = [[-0.85, 0.35, -1.4], [0.85, 0.35, -1.4], [-0.85, 0.35, 1.6], [0.85, 0.35, 1.6]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });

    return group;
};

// 21. PORSCHE GT3 TOURING (No Wing)
const createPorscheGT3Touring = (bodyMat: THREE.Material) => {
    const group = createPorscheGT3RS(bodyMat);
    // Remove the big wing (it's children indices 6 and 7 in original function roughly, but safer to just rebuild or modify)
    // Actually, easier to just accept the returned group and remove the last added children which are the wing parts
    // The GT3 RS function adds: body, fenders, cabin, wingValance, wStands...
    // Let's just create a fresh one to be clean.
    const cleanGroup = new THREE.Group();
    // Copy base parts from GT3 RS logic
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.85, 0.5, 4.4]), bodyMat);
    body.position.y = 0.5; cleanGroup.add(body);
    const rFender = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.95, 0.35, 1.2]), bodyMat); rFender.position.set(0, 0.4, -1.2);
    const fFender = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.3, 1.0]), bodyMat); fFender.position.set(0, 0.35, 1.5);
    cleanGroup.add(rFender, fFender);
    const cabin = new THREE.Mesh(getCachedGeo(THREE.SphereGeometry, [1.0, 16, 16]), MAT_GLASS);
    cabin.scale.set(0.9, 0.5, 1.4); cabin.position.set(0, 0.85, -0.4); cleanGroup.add(cabin);

    // Active Spoiler (Small) instead of Wing
    const spoil = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.05, 0.3]), bodyMat);
    spoil.position.set(0, 0.85, -2.1);
    const grill = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.0, 0.05, 0.4]), MAT_DARK_METAL);
    grill.position.set(0, 0.86, -1.6);
    cleanGroup.add(spoil, grill);

    // Vents
    const ventGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.05, 0.3]);
    const ventL = new THREE.Mesh(ventGeo, MAT_DARK_METAL); ventL.position.set(-0.4, 0.76, 1.4);
    const ventR = new THREE.Mesh(ventGeo, MAT_DARK_METAL); ventR.position.set(0.4, 0.76, 1.4); cleanGroup.add(ventL, ventR);

    // Lights
    const hlGeo = getCachedGeo(THREE.CylinderGeometry, [0.2, 0.2, 0.1, 16]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.rotation.x = Math.PI / 2; hlL.position.set(-0.6, 0.55, 2.15);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.rotation.x = Math.PI / 2; hlR.position.set(0.6, 0.55, 2.15); cleanGroup.add(hlL, hlR);
    const tl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.08, 0.05]), MAT_NEON_TAILLIGHT);
    tl.position.set(0, 0.65, -2.2); cleanGroup.add(tl);

    // Exhausts
    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.08, 0.08, 0.2, 8]), MAT_CHROME);
    ex.rotation.x = Math.PI / 2; ex.position.set(-0.1, 0.3, -2.2);
    const ex2 = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.08, 0.08, 0.2, 8]), MAT_CHROME);
    ex2.rotation.x = Math.PI / 2; ex2.position.set(0.1, 0.3, -2.2); cleanGroup.add(ex, ex2);

    addMirrors(cleanGroup, bodyMat, 0.9, 0.7, 0.5);
    const wheels = [[-0.95, 0.35, -1.4], [0.95, 0.35, -1.4], [-0.95, 0.35, 1.4], [0.95, 0.35, 1.4]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); cleanGroup.add(w); });

    return cleanGroup;
};

// 22. PORSCHE GT3 MR (Manthey Racing)
const createPorscheGT3MR = (bodyMat: THREE.Material) => {
    const group = createPorscheGT3RS(bodyMat);
    // Add Aero Discs to rear wheels
    // Add Canards
    const canardGeo = getCachedGeo(THREE.BoxGeometry, [0.3, 0.02, 0.1]);
    const cL = new THREE.Mesh(canardGeo, MAT_DARK_METAL); cL.position.set(-0.95, 0.4, 2.0); cL.rotation.z = 0.5; cL.rotation.y = -0.3;
    const cR = new THREE.Mesh(canardGeo, MAT_DARK_METAL); cR.position.set(0.95, 0.4, 2.0); cR.rotation.z = -0.5; cR.rotation.y = 0.3;
    group.add(cL, cR);
    // Bigger Wing Endplates
    const endGeo = getCachedGeo(THREE.BoxGeometry, [0.05, 0.8, 0.6]);
    const eL = new THREE.Mesh(endGeo, bodyMat); eL.position.set(-0.92, 1.4, -2.1);
    const eR = new THREE.Mesh(endGeo, bodyMat); eR.position.set(0.92, 1.4, -2.1);
    group.add(eL, eR);
    return group;
};

// 23. JEEP WRANGLER
const createJeep = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Boxy Body
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.8, 3.8]), bodyMat);
    body.position.y = 0.8; group.add(body);
    // Roll Cage / Open Top
    const cageGeo = getCachedGeo(THREE.BoxGeometry, [0.1, 0.8, 0.1]);
    const c1 = new THREE.Mesh(cageGeo, MAT_DARK_METAL); c1.position.set(-0.8, 1.6, -0.5);
    const c2 = new THREE.Mesh(cageGeo, MAT_DARK_METAL); c2.position.set(0.8, 1.6, -0.5);
    const c3 = new THREE.Mesh(cageGeo, MAT_DARK_METAL); c3.position.set(-0.8, 1.6, -1.8);
    const c4 = new THREE.Mesh(cageGeo, MAT_DARK_METAL); c4.position.set(0.8, 1.6, -1.8);
    // Top bars
    const barGeo = getCachedGeo(THREE.BoxGeometry, [1.7, 0.1, 0.1]);
    const b1 = new THREE.Mesh(barGeo, MAT_DARK_METAL); b1.position.set(0, 2.0, -0.5);
    const b2 = new THREE.Mesh(barGeo, MAT_DARK_METAL); b2.position.set(0, 2.0, -1.8);
    const lBar = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.1, 1.4]), MAT_DARK_METAL);
    const lb1 = lBar.clone(); lb1.position.set(-0.8, 2.0, -1.15);
    const lb2 = lBar.clone(); lb2.position.set(0.8, 2.0, -1.15);
    group.add(c1, c2, c3, c4, b1, b2, lb1, lb2);

    // Windshield (Flat)
    const wind = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.6, 0.1]), MAT_GLASS);
    wind.position.set(0, 1.5, 0.5); wind.rotation.x = -0.2; group.add(wind);

    // Fenders (Black Plastic)
    const fendGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.1, 1.0]);
    const fFL = new THREE.Mesh(fendGeo, MAT_DARK_METAL); fFL.position.set(-1.1, 0.8, 1.2);
    const fFR = new THREE.Mesh(fendGeo, MAT_DARK_METAL); fFR.position.set(1.1, 0.8, 1.2);
    const fRL = new THREE.Mesh(fendGeo, MAT_DARK_METAL); fRL.position.set(-1.1, 0.8, -1.2);
    const fRR = new THREE.Mesh(fendGeo, MAT_DARK_METAL); fRR.position.set(1.1, 0.8, -1.2);
    group.add(fFL, fFR, fRL, fRR);

    // Grille (7 Slots)
    const grill = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.6, 0.1]), bodyMat);
    grill.position.set(0, 1.0, 1.91); group.add(grill);
    const slotGeo = getCachedGeo(THREE.BoxGeometry, [0.08, 0.4, 0.05]);
    for (let i = -0.5; i <= 0.5; i += 0.15) {
        const slot = new THREE.Mesh(slotGeo, MAT_DARK_METAL); slot.position.set(i, 1.0, 1.93); group.add(slot);
    }

    // Headlights (Round)
    const hlGeo = getCachedGeo(THREE.CylinderGeometry, [0.2, 0.2, 0.1, 16]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.rotation.x = Math.PI / 2; hlL.position.set(-0.6, 1.0, 1.92);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.rotation.x = Math.PI / 2; hlR.position.set(0.6, 1.0, 1.92);
    group.add(hlL, hlR);

    // Spare Tire
    const spare = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.4, 0.4, 0.3, 16]), MAT_TIRE);
    spare.rotation.x = Math.PI / 2; spare.position.set(0, 1.0, -1.95); group.add(spare);

    // Wheels (Big Offroad)
    const wheels = [[-1.0, 0.45, -1.2], [1.0, 0.45, -1.2], [-1.0, 0.45, 1.2], [1.0, 0.45, 1.2]];
    wheels.forEach(pos => {
        const w = createRacingWheel();
        w.scale.set(1.4, 1.4, 1.4);
        w.position.set(pos[0], pos[1], pos[2]);
        group.add(w);
    });
    return group;
};

// 24. POLICE INTERCEPTOR
const createPoliceInterceptor = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Sedan Body (Black)
    const bMat = new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 80 });
    const wMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80 });

    // Main Chassis
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.6, 4.6]), bMat);
    body.position.y = 0.6; group.add(body);
    // White Doors
    const doors = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.92, 0.58, 2.0]), wMat);
    doors.position.set(0, 0.6, 0); group.add(doors);

    // Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.7, 0.5, 2.2]), MAT_GLASS);
    cabin.position.set(0, 1.1, -0.2); group.add(cabin);

    // Bullbar
    const bullBar = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.6, 0.1]), MAT_DARK_METAL);
    bullBar.position.set(0, 0.6, 2.35); group.add(bullBar);
    const bullBarUp = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.1, 0.4]), MAT_DARK_METAL);
    bullBarUp.position.set(0, 0.9, 2.5); group.add(bullBarUp);

    // Lightbar
    const lbBase = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 0.1, 0.3]), MAT_DARK_METAL);
    lbBase.position.set(0, 1.4, 0); group.add(lbBase);
    const lbRed = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.12, 0.2]), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    lbRed.position.set(-0.35, 1.4, 0);
    const lbBlue = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.6, 0.12, 0.2]), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    lbBlue.position.set(0.35, 1.4, 0);
    group.add(lbRed, lbBlue);

    // Headlights (Strobe effect in shader ideal, but for now static neon)
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.15, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.7, 0.7, 2.31);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.7, 0.7, 2.31); group.add(hlL, hlR);

    // Wheels
    const wheels = [[-0.9, 0.35, -1.5], [0.9, 0.35, -1.5], [-0.9, 0.35, 1.5], [0.9, 0.35, 1.5]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });

    return group;
};

// 25. AMERICAN TRUCK (Peterbilt)
const createPeterbilt = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Cab Body
    const cab = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.4, 1.8, 2.0]), bodyMat);
    cab.position.set(0, 1.5, -0.5); group.add(cab);
    // Long Nose
    const nose = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.4, 1.4, 2.5]), bodyMat);
    nose.position.set(0, 1.3, 1.7); group.add(nose);
    // Huge Chrome Grille
    const grill = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.45, 1.4, 0.1]), MAT_CHROME);
    grill.position.set(0, 1.3, 2.96); group.add(grill);
    // Stacks (Exhausts)
    const stackGeo = getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 3.5, 8]);
    const sL = new THREE.Mesh(stackGeo, MAT_CHROME); sL.position.set(-1.3, 2.5, -0.5);
    const sR = new THREE.Mesh(stackGeo, MAT_CHROME); sR.position.set(1.3, 2.5, -0.5);
    group.add(sL, sR);
    // Visor
    const visor = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.5, 0.1, 0.5]), MAT_CHROME);
    visor.position.set(0, 2.45, 0.6); visor.rotation.x = 0.2; group.add(visor);
    // Lights (Roof)
    for (let i = -0.8; i <= 0.8; i += 0.4) {
        const l = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.1, 0.1, 0.1]), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        l.position.set(i, 2.45, 0.4); group.add(l);
    }
    // Headlights
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.2, 0.2, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.9, 0.8, 2.9);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.9, 0.8, 2.9); group.add(hlL, hlR);

    // Wheels (Dualies logic mocked by wide wheels)
    const fL = createRacingWheel(); fL.scale.set(1.5, 1.5, 1.5); fL.position.set(-1.1, 0.5, 2.0);
    const fR = createRacingWheel(); fR.scale.set(1.5, 1.5, 1.5); fR.position.set(1.1, 0.5, 2.0);
    const rL1 = createRacingWheel(); rL1.scale.set(1.5, 1.5, 1.5); rL1.position.set(-1.1, 0.5, -1.0);
    const rR1 = createRacingWheel(); rR1.scale.set(1.5, 1.5, 1.5); rR1.position.set(1.1, 0.5, -1.0);
    const rL2 = createRacingWheel(); rL2.scale.set(1.5, 1.5, 1.5); rL2.position.set(-1.1, 0.5, -2.2);
    const rR2 = createRacingWheel(); rR2.scale.set(1.5, 1.5, 1.5); rR2.position.set(1.1, 0.5, -2.2);
    group.add(fL, fR, rL1, rR1, rL2, rR2);
    return group;
};

// 26. M1 ABRAMS TANK
const createTank = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Tracks / Chassis
    const chassis = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [3.2, 1.0, 5.5]), bodyMat);
    chassis.position.y = 0.5; group.add(chassis);
    // Turret
    const turret = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.0, 0.8, 3.0]), bodyMat);
    turret.position.set(0, 1.4, 0); group.add(turret);
    // Barrel
    const barrel = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 4.0, 8]), MAT_DARK_METAL);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.4, 3.0); group.add(barrel);

    // Treads (Black blocks)
    const treadGeo = getCachedGeo(THREE.BoxGeometry, [0.4, 0.8, 5.5]);
    const tL = new THREE.Mesh(treadGeo, new THREE.MeshPhongMaterial({ color: 0x111111 })); tL.position.set(-1.8, 0.4, 0);
    const tR = new THREE.Mesh(treadGeo, new THREE.MeshPhongMaterial({ color: 0x111111 })); tR.position.set(1.8, 0.4, 0);
    group.add(tL, tR);

    // Hatch / MG
    const hatch = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.3, 0.3, 0.1]), MAT_DARK_METAL);
    hatch.position.set(0.5, 1.85, 0); group.add(hatch);

    // Lights (Tactical)
    const hl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.2, 0.1, 0.1]), MAT_NEON_HEADLIGHT);
    hl.position.set(-1.0, 1.1, 2.7); group.add(hl);

    return group;
};

const createAE86 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // 1. Main Classic Geometry (Boxy but with character)
    const mainGeo = getCachedGeo(THREE.BoxGeometry, [1.6, 0.5, 4.0]);
    const body = new THREE.Mesh(mainGeo, bodyMat); // White top
    body.position.y = 0.55;
    group.add(body);

    // 2. Panda Paint Scheme (Black Bottom Skirt)
    const skirtGeo = getCachedGeo(THREE.BoxGeometry, [1.62, 0.25, 4.05]);
    const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    skirt.position.set(0, 0.25, 0);
    group.add(skirt);

    // 3. Greenhouse (Cabin)
    // Slightly tapered top
    const cabinGeo = getCachedGeo(THREE.BoxGeometry, [1.5, 0.45, 1.8]);
    const cabin = new THREE.Mesh(cabinGeo, MAT_GLASS);
    cabin.position.set(0, 0.95, -0.2);
    group.add(cabin);

    // Pillars (A, B, C) details (Visualized by slightly wider black box inside cabin? No, just keep it simple but clean)

    // 4. Pop-up Headlights (Retracted vs Up?) Let's make them UP for personality
    const popHousing = getCachedGeo(THREE.BoxGeometry, [0.4, 0.15, 0.3]);
    const pL = new THREE.Mesh(popHousing, bodyMat); pL.position.set(-0.5, 0.82, 1.85); pL.rotation.x = -0.1;
    const pR = new THREE.Mesh(popHousing, bodyMat); pR.position.set(0.5, 0.82, 1.85); pR.rotation.x = -0.1;
    group.add(pL, pR);

    const faceGeo = getCachedGeo(THREE.BoxGeometry, [0.35, 0.12, 0.05]);
    const fL = new THREE.Mesh(faceGeo, MAT_NEON_HEADLIGHT); fL.position.set(0, 0, 0.15); pL.add(fL);
    const fR = new THREE.Mesh(faceGeo, MAT_NEON_HEADLIGHT); fR.position.set(0, 0, 0.15); pR.add(fR);

    // 5. Grille (Trueno lettering implied)
    const grill = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.8, 0.1, 0.05]), MAT_DARK_METAL);
    grill.position.set(0, 0.65, 2.01);
    group.add(grill);

    // 6. Yellow Fog Lights (JDM Spec)
    const fogGeo = getCachedGeo(THREE.BoxGeometry, [0.25, 0.1, 0.05]);
    const fgL = new THREE.Mesh(fogGeo, new THREE.MeshBasicMaterial({ color: 0xffff00 })); fgL.position.set(-0.5, 0.5, 2.03);
    const fgR = new THREE.Mesh(fogGeo, new THREE.MeshBasicMaterial({ color: 0xffff00 })); fgR.position.set(0.5, 0.5, 2.03);
    group.add(fgL, fgR);

    // 7. Grid Tail Lights
    const tlBack = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.5, 0.2, 0.1]), new THREE.MeshBasicMaterial({ color: 0x330000 }));
    tlBack.position.set(0, 0.65, -2.0);
    group.add(tlBack);

    const tlGrid = getCachedGeo(THREE.BoxGeometry, [0.1, 0.15, 0.05]);
    for (let i = 0; i < 3; i++) {
        // Blocks of red/orange
        const t = new THREE.Mesh(tlGrid, MAT_NEON_TAILLIGHT);
        t.position.set(-0.6 + i * 0.15, 0.65, -2.06);
        group.add(t);
        const t2 = new THREE.Mesh(tlGrid, MAT_NEON_TAILLIGHT);
        t2.position.set(0.6 - i * 0.15, 0.65, -2.06);
        group.add(t2);
    }

    // 8. Single Exhaust (Small)
    const ex = new THREE.Mesh(getCachedGeo(THREE.CylinderGeometry, [0.06, 0.06, 0.3]), MAT_CHROME);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(0.6, 0.2, -2.0);
    group.add(ex);

    // 9. Wheels (Watanabe 8-spoke simulation - Gunmetal)
    const wheels = [[-0.85, 0.3, -1.2], [0.85, 0.3, -1.2], [-0.85, 0.3, 1.2], [0.85, 0.3, 1.2]];
    wheels.forEach(pos => {
        // Darker rim - handled by default for AE86 simplicity to avoid type error
        const w = createRacingWheel();
        w.scale.set(0.9, 0.9, 0.9);
        w.position.set(pos[0], pos[1], pos[2]);
        group.add(w);
    });

    return group;
};

const createR32 = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // Boxy Skyline
    const body = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.75, 0.55, 4.3]), bodyMat);
    body.position.y = 0.5; group.add(body);
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.45, 1.8]), MAT_GLASS);
    cabin.position.set(0, 0.9, -0.2); group.add(cabin);
    // Iconic Tail Lights (Double Round)
    const tlGeo = getCachedGeo(THREE.CylinderGeometry, [0.1, 0.1, 0.1, 16]);
    [-0.5, -0.25, 0.25, 0.5].forEach(x => {
        const t = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT);
        t.rotation.x = Math.PI / 2; t.position.set(x, 0.7, -2.16); group.add(t);
    });
    // Rectangle Headlights
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [0.3, 0.12, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlL.position.set(-0.6, 0.65, 2.16);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT); hlR.position.set(0.6, 0.65, 2.16); group.add(hlL, hlR);
    // Wing
    const wing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.6, 0.05, 0.3]), bodyMat);
    wing.position.set(0, 1.1, -1.9);
    const wSt = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.2, 0.3, 0.1]), bodyMat);
    wSt.position.set(0, 0.9, -1.9); group.add(wing, wSt);
    // Wheels
    const wheels = [[-0.9, 0.35, -1.3], [0.9, 0.35, -1.3], [-0.9, 0.35, 1.3], [0.9, 0.35, 1.3]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 27. DODGE VIPER GTS (Refined)
const createViper = (bodyMat: THREE.Material) => {
    const group = new THREE.Group();
    // 1. Long Hood Base
    const hood = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.9, 0.45, 2.5]), bodyMat);
    hood.position.set(0, 0.45, 1.2); group.add(hood);

    // 2. Cabin Base (Rear)
    const rearBody = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.95, 0.5, 2.0]), bodyMat);
    rearBody.position.set(0, 0.5, -1.0); group.add(rearBody);

    // 3. Double Bubble Roof (Sculpted Boxes)
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.5, 0.35, 1.2]), MAT_GLASS);
    cabin.position.set(0, 0.85, -0.8); group.add(cabin);

    // Bubbles
    const bubGeo = getCachedGeo(THREE.BoxGeometry, [0.6, 0.1, 1.0]);
    const bL = new THREE.Mesh(bubGeo, bodyMat); bL.position.set(-0.35, 1.05, -0.8);
    const bR = new THREE.Mesh(bubGeo, bodyMat); bR.position.set(0.35, 1.05, -0.8);
    group.add(bL, bR);

    // 4. Side Pipes (Cylinders)
    const pipeGeo = getCachedGeo(THREE.CylinderGeometry, [0.15, 0.15, 2.0]);
    const pL = new THREE.Mesh(pipeGeo, MAT_CHROME); pL.rotation.x = Math.PI / 2; pL.position.set(-0.95, 0.25, -0.5);
    const pR = new THREE.Mesh(pipeGeo, MAT_CHROME); pR.rotation.x = Math.PI / 2; pR.position.set(0.95, 0.25, -0.5);
    group.add(pL, pR);

    // 5. Spoiler (Ducktail)
    const spoil = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [1.8, 0.2, 0.4]), bodyMat);
    spoil.position.set(0, 0.8, -1.9); spoil.rotation.x = 0.2; group.add(spoil);

    // 6. Stripes
    const s1 = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.25, 0.05, 4.2]), new THREE.MeshBasicMaterial({ color: 0xffffff })); s1.position.set(-0.3, 0.71, 0.2);
    const s2 = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.25, 0.05, 4.2]), new THREE.MeshBasicMaterial({ color: 0xffffff })); s2.position.set(0.3, 0.71, 0.2);
    group.add(s1, s2);

    // Wheels
    const wheels = [[-0.95, 0.35, -1.4], [0.95, 0.35, -1.4], [-0.95, 0.35, 1.4], [0.95, 0.35, 1.4]];
    wheels.forEach(pos => { const w = createRacingWheel(); w.position.set(pos[0], pos[1], pos[2]); group.add(w); });
    return group;
};

// 16. CORVETTE C8_OLD - REMOVED





// 14. LAMBORGHINI HURACAN (Refined)
// 14. LAMBORGHINI HURACAN (Ultra-Detailed)


// 16. CORVETTE C8 (Refined)
// 16. CORVETTE C8 (Ultra-Detailed)


// --- FACTORY ---
const createPlayerMesh = (config: CarConfig) => {
    const bodyMat = new THREE.MeshPhongMaterial({ color: config.color, shininess: 80 });
    const emissiveMat = new THREE.MeshBasicMaterial({ color: config.color });

    // Helper to wrap cars with extra details
    const wrap = (mesh: THREE.Group) => {
        // Add license plate
        const plateGeo = getCachedGeo(THREE.PlaneGeometry, [0.4, 0.15]);
        const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(0, 0.3, -2.12); plate.rotation.y = Math.PI;
        // Only add plate if it doesn't intersect too much (simple check: most cars have rear bumper at ~ -2.1)

        // Add subtle shadow blob
        const shadGeo = getCachedGeo(THREE.PlaneGeometry, [2.2, 4.8]);
        const shadMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
        const shadow = new THREE.Mesh(shadGeo, shadMat);
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05;
        mesh.add(shadow);

        return mesh;
    };

    if (config.id === 'c_fighter_jet') return createFighterJet(bodyMat, emissiveMat); // No wrap for jet
    if (config.id === 'c_formula1') return createFormula1(bodyMat, emissiveMat);

    let car;
    switch (config.id) {
        // JDM
        case 'c_mini': car = createMini(bodyMat); break;
        case 'c_bmw_m3': car = createBMW_M3(bodyMat); break;
        case 'c_civic': car = createCivic(bodyMat); break;
        case 'c_s2000': car = createS2000(bodyMat); break;
        case 'c_silvia': car = createSilviaS15(bodyMat); break;
        case 'c_evo': car = createEvo(bodyMat); break;
        case 'c_impreza': car = createImpreza(bodyMat); break;
        case 'c_350z': car = create350Z(bodyMat); break;
        case 'c_rx7': car = createRX7(bodyMat); break;
        case 'c_nsx': car = createNSX(bodyMat); break;
        case 'c_gtr_r34': car = createGTR_R34(bodyMat); break;

        // Supercars
        case 'c_f40': car = createF40(bodyMat); break;

        case 'c_p1': car = createP1(bodyMat); break;
        case 'c_f1': car = createF1(bodyMat); break;
        // New Additions
        case 'c_porsche_gt3_rs': car = createPorscheGT3RS(bodyMat); break;
        case 'c_porsche_gt3_cup': car = createPorscheGT3RS(bodyMat); break;
        case 'c_porsche_gt3_touring': car = createPorscheGT3Touring(bodyMat); break;
        case 'c_porsche_gt3_mr': car = createPorscheGT3MR(bodyMat); break;
        case 'c_ae86': car = createAE86(bodyMat); break;
        case 'c_r32': car = createR32(bodyMat); break;
        case 'c_viper': car = createViper(bodyMat); break;

        case 'c_ferrari_499p': return createFerrariLM(bodyMat, emissiveMat);
        // Special
        case 'c_jeep_wrangler': car = createJeep(bodyMat); break;
        case 'c_police_interceptor': car = createPoliceInterceptor(bodyMat); break;
        case 'c_peterbilt': car = createPeterbilt(bodyMat); break;
        case 'c_m1_abrams': car = createTank(bodyMat); break;

        default: car = createMini(bodyMat);
    }
    return wrap(car);
};

// --- TRUCK ENEMY ---
const createTruck = () => {
    const group = new THREE.Group();
    // Cabin
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.5, 2.5, 2.0]), MAT_ENEMY_BODY);
    cabin.position.set(0, 1.25, -3); group.add(cabin);
    // Trailer
    const trailer = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [2.6, 3.5, 8.0]), new THREE.MeshPhongMaterial({ color: 0xcccccc }));
    trailer.position.set(0, 1.75, 2.0); group.add(trailer);
    // Wheels (6)
    const wGeo = getCachedGeo(THREE.CylinderGeometry, [0.4, 0.4, 0.4, 16]);
    const wMat = MAT_TIRE;
    const wheels = [[-1.4, 0.4, -3], [1.4, 0.4, -3], [-1.4, 0.4, 0], [1.4, 0.4, 0], [-1.4, 0.4, 4], [1.4, 0.4, 4]];
    wheels.forEach(pos => {
        const w = new THREE.Mesh(wGeo, wMat); w.rotation.z = Math.PI / 2; w.position.set(pos[0], pos[1], pos[2]); group.add(w);
    });
    // Lights.
    const hl = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [0.4, 0.2, 0.1]), MAT_NEON_HEADLIGHT);
    const hlL = hl.clone(); hlL.position.set(-0.8, 1.0, -4.01);
    const hlR = hl.clone(); hlR.position.set(0.8, 1.0, -4.01); group.add(hlL, hlR);

    // Set Data
    group.userData = { width: 8.0, length: 12.0, type: 'TRUCK' };
    return group;
};

// --- OPTIMIZED SPAWNERS USING SHARED MATERIALS ---
const createEnemyMesh = () => {
    const group = new THREE.Group();
    const width = GAME_CONFIG.enemyWidth;
    const length = GAME_CONFIG.enemyDepth;

    // 1. Chassis (Low & Sleek)
    const chassis = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [width, 0.5, length]), MAT_ENEMY_BODY);
    chassis.position.y = 0.5; group.add(chassis);

    // 2. Cabin (Dark Glass)
    const cabin = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [width * 0.85, 0.4, length * 0.6]), MAT_GLASS);
    cabin.position.set(0, 0.95, -0.2); group.add(cabin);

    // 3. Headlights (Bright White/Yellow Neon) - Front (+Z)
    // Creating separate housings for detail
    const hlGeo = getCachedGeo(THREE.BoxGeometry, [width * 0.25, 0.15, 0.1]);
    const hlL = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT);
    hlL.position.set(-width * 0.25, 0.6, length / 2);
    const hlR = new THREE.Mesh(hlGeo, MAT_NEON_HEADLIGHT);
    hlR.position.set(width * 0.25, 0.6, length / 2);
    group.add(hlL, hlR);

    // 4. Taillights (Red Neon) - Rear (-Z)
    const tlGeo = getCachedGeo(THREE.BoxGeometry, [width * 0.25, 0.15, 0.1]);
    const tlL = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT);
    tlL.position.set(-width * 0.25, 0.6, -length / 2);
    const tlR = new THREE.Mesh(tlGeo, MAT_NEON_TAILLIGHT);
    tlR.position.set(width * 0.25, 0.6, -length / 2);
    group.add(tlL, tlR);

    // 5. Aggressive Grille
    const grill = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [width * 0.5, 0.25, 0.05]), MAT_ENEMY_EMISSIVE);
    grill.position.set(0, 0.4, length / 2 + 0.03);
    group.add(grill);

    // 6. Spoiler (New Addition) - Sporty Wing
    const spoilerStands = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [width * 0.8, 0.3, 0.1]), MAT_ENEMY_BODY);
    spoilerStands.position.set(0, 0.8, -length / 2 + 0.2);
    const spoilerWing = new THREE.Mesh(getCachedGeo(THREE.BoxGeometry, [width + 0.2, 0.1, 0.4]), MAT_ENEMY_BODY);
    spoilerWing.position.set(0, 1.0, -length / 2 + 0.1);
    group.add(spoilerStands, spoilerWing);

    // 7. Underglow (Neon Plane)
    const glowGeo = getCachedGeo(THREE.PlaneGeometry, [width * 1.2, length * 1.2]);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    group.add(glow);

    // 8. Wheels (Simple Dark Cylinders)
    const wheelGeo = getCachedGeo(THREE.CylinderGeometry, [0.35, 0.35, 0.3, 16]);
    const wX = width * 0.45;
    const wY = 0.35;
    const wZ = length * 0.35;

    const wFL = new THREE.Mesh(wheelGeo, MAT_DARK_METAL); wFL.rotation.z = Math.PI / 2; wFL.position.set(-wX, wY, wZ);
    const wFR = new THREE.Mesh(wheelGeo, MAT_DARK_METAL); wFR.rotation.z = Math.PI / 2; wFR.position.set(wX, wY, wZ);
    const wRL = new THREE.Mesh(wheelGeo, MAT_DARK_METAL); wRL.rotation.z = Math.PI / 2; wRL.position.set(-wX, wY, -wZ);
    const wRR = new THREE.Mesh(wheelGeo, MAT_DARK_METAL); wRR.rotation.z = Math.PI / 2; wRR.position.set(wX, wY, -wZ);
    group.add(wFL, wFR, wRL, wRR);

    return group;
};

const createCoinMesh = () => {
    const geo = getCachedGeo(THREE.CylinderGeometry, [0.4, 0.4, 0.1, 16]);
    const mesh = new THREE.Mesh(geo, MAT_COIN);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
};

const createGemMesh = () => {
    const geo = getCachedGeo(THREE.OctahedronGeometry, [0.35, 0]);
    const mesh = new THREE.Mesh(geo, MAT_GEM);
    return mesh;
};

const createPowerUpMesh = (type: PowerUpType) => {
    const group = new THREE.Group();
    const coreGeo = getCachedGeo(THREE.BoxGeometry, [0.5, 0.5, 0.5]);
    const ringGeo = getCachedGeo(THREE.TorusGeometry, [0.4, 0.05, 8, 16]);

    let core, ring;
    if (type === PowerUpType.SHIELD) {
        core = new THREE.Mesh(coreGeo, MAT_SHIELD_CORE);
        ring = new THREE.Mesh(ringGeo, MAT_SHIELD_RING);
    } else {
        core = new THREE.Mesh(coreGeo, MAT_MAGNET_CORE);
        ring = new THREE.Mesh(ringGeo, MAT_MAGNET_RING);
    }
    group.add(core, ring);
    return group;
};

const createNeonRoadTexture = () => {
    const width = 1024; const height = 1024;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#02020a'); gradient.addColorStop(1, '#050510');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#1a1a3a'; ctx.lineWidth = 2;
        const gridSize = 128;
        for (let x = 0; x <= width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
        for (let y = 0; y <= height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
        const laneW = width / GAME_CONFIG.laneCount;
        ctx.shadowBlur = 30; ctx.shadowColor = '#d946ef'; ctx.fillStyle = '#d946ef';
        ctx.fillRect(0, 0, 16, height); ctx.fillRect(width - 16, 0, 16, height);
        ctx.shadowBlur = 15; ctx.shadowColor = '#06b6d4'; ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 6;
        for (let i = 1; i < GAME_CONFIG.laneCount; i++) {
            const x = i * laneW; ctx.beginPath(); ctx.setLineDash([120, 180]);
            ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 16;
    return texture;
};

const createRetroSun = () => {
    const geometry = new THREE.CircleGeometry(80, 32);
    const material = new THREE.ShaderMaterial({
        uniforms: { color1: { value: new THREE.Color(0xffaa00) }, color2: { value: new THREE.Color(0xff0080) } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 color1; uniform vec3 color2; varying vec2 vUv; void main() { float gradient = vUv.y; vec3 finalColor = mix(color2, color1, gradient); if (vUv.y < 0.55) { float stripe = mod(vUv.y * 20.0, 1.0); if (stripe > 0.6) discard; } if (distance(vUv, vec2(0.5)) > 0.5) discard; gl_FragColor = vec4(finalColor, 1.0); }`,
        transparent: true
    });
    return new THREE.Mesh(geometry, material);
};

const createStarField = () => {
    const geometry = new THREE.BufferGeometry();
    const count = 3000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 800;
        positions[i * 3 + 1] = Math.random() * 400 + 50;
        positions[i * 3 + 2] = (Math.random() * 800) - 500;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.8, sizeAttenuation: true });
    return new THREE.Points(geometry, material);
};

const createSpeedLines = () => {
    const geometry = new THREE.BufferGeometry();
    const count = 300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 120; positions[i * 3 + 1] = Math.random() * 50; positions[i * 3 + 2] = -Math.random() * 400;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xccffff, size: 0.3, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    return new THREE.Points(geometry, material);
};

// Object Pooling
const PARTICLE_POOL_SIZE = 200;
const createParticlePool = () => {
    const pool = [];
    const geo = getCachedGeo(THREE.OctahedronGeometry, [0.3, 0]);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.visible = false;
        pool.push(mesh);
    }
    return pool;
};

interface GameCanvasProps {
    gameState: GameState;
    setGameState: (state: GameState) => void;
    setScore: (score: number) => void;
    gameSpeedRef: React.MutableRefObject<number>;
    selectedCarIndex: number;
    onCoinCollect: (amount: number) => void;
    onGemCollect: () => void;
    onPowerUpsUpdate: (powerups: Record<string, number>) => void;
    setMultiplier: (multiplier: number) => void;
    setCurrentSpeed: (speed: number) => void;
    powerUpLevels: PowerUpLevels;
    activeCarConfig: CarConfig;
    menuState: 'HOME' | 'GARAGE' | 'UPGRADES' | 'SETTINGS' | 'SHOP';
    isRevivingRef: React.MutableRefObject<boolean>;
    resetKey: number;
}

const TRAIL_LENGTH = 30;

const GameCanvas: React.FC<GameCanvasProps> = (props) => {
    const {
        gameState, setGameState, setScore, gameSpeedRef, selectedCarIndex,
        onCoinCollect, onGemCollect, onPowerUpsUpdate, setMultiplier, setCurrentSpeed,
        powerUpLevels, activeCarConfig, menuState, isRevivingRef, resetKey
    } = props;
    const containerRef = useRef<HTMLDivElement>(null);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const composerRef = useRef<any | null>(null);

    const playerMeshRef = useRef<THREE.Group | null>(null);
    const shieldMeshRef = useRef<THREE.Mesh | null>(null);

    const enemiesGroupRef = useRef<THREE.Group | null>(null);
    const coinsGroupRef = useRef<THREE.Group | null>(null);
    const gemsGroupRef = useRef<THREE.Group | null>(null);
    const powerUpsGroupRef = useRef<THREE.Group | null>(null);
    const buildingsGroupRef = useRef<THREE.Group | null>(null);
    const streetLightsGroupRef = useRef<THREE.Group | null>(null);
    const particlesGroupRef = useRef<THREE.Group | null>(null);
    const shipsGroupRef = useRef<THREE.Group | null>(null);

    const pools = useRef({
        enemies: [] as THREE.Group[],
        trucks: [] as THREE.Group[],
        coins: [] as THREE.Mesh[],
        gems: [] as THREE.Mesh[],
        powerups: [] as THREE.Group[],
        particles: [] as THREE.Mesh[],
        ships: [] as THREE.Group[]
    });

    const roadMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
    const speedLinesRef = useRef<THREE.Points | null>(null);
    const starMeshRef = useRef<THREE.Points | null>(null);
    const trailMeshRef = useRef<THREE.Mesh | null>(null);
    const trailPositionsRef = useRef<{ x: number, z: number }[]>([]);

    const scoreRef = useRef(0);
    const distanceRef = useRef(0);
    const frameCountRef = useRef(0);
    const requestRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const activePowerUpsRef = useRef<Record<string, number>>({});
    const lastMultiplierRef = useRef(1);
    const isCrashingRef = useRef(false);
    const currentLaneRef = useRef(1);
    const playerState = useRef({ currentX: 0, tilt: 0, bankTilt: 0 });
    const shakeIntensityRef = useRef(0);
    const touchStartXRef = useRef<number | null>(null);
    const dragRef = useRef({ active: false, lastX: 0 });
    const gameStateRef = useRef(gameState);
    const activeCarConfigRef = useRef(activeCarConfig);
    const menuStateRef = useRef(menuState);

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { activeCarConfigRef.current = activeCarConfig; }, [activeCarConfig]);
    useEffect(() => { menuStateRef.current = menuState; }, [menuState]);

    // --- SPAWN / DESPAWN HELPERS (POOLING) ---
    const spawnEnemy = (x: number) => {
        if (!enemiesGroupRef.current) return;
        let enemy = pools.current.enemies.pop();
        if (!enemy) { enemy = createEnemyMesh(); enemy.userData.width = GAME_CONFIG.enemyWidth; }
        enemy.position.set(x, 0, GAME_CONFIG.spawnDistance);
        enemy.visible = true;
        enemiesGroupRef.current.add(enemy);
    };

    const spawnTruck = (lanePairIndex: number) => { // 0 for Lane 0-1, 1 for Lane 1-2
        if (!enemiesGroupRef.current) return;
        let truck = pools.current.trucks.pop();
        if (!truck) truck = createTruck();
        // Lane 0 Center: -6. Lane 1 Center: 0. Mid: -3.
        // Lane 1 Center: 0. Lane 2 Center: 6. Mid: 3.
        const midX = lanePairIndex === 0 ? -3.0 : 3.0;
        truck.position.set(midX, 0, GAME_CONFIG.spawnDistance);
        truck.visible = true;
        enemiesGroupRef.current.add(truck);
    };

    const spawnCoin = (x: number) => {
        if (!coinsGroupRef.current) return;
        let coin = pools.current.coins.pop();
        if (!coin) coin = createCoinMesh();
        coin.position.set(x, 1.0, GAME_CONFIG.spawnDistance);
        coin.visible = true;
        coinsGroupRef.current.add(coin);
    };

    const spawnGem = (x: number) => {
        if (!gemsGroupRef.current) return;
        let gem = pools.current.gems.pop();
        if (!gem) gem = createGemMesh();
        gem.position.set(x, 1.0, GAME_CONFIG.spawnDistance);
        gem.visible = true;
        gemsGroupRef.current.add(gem);
    };

    const spawnPowerUp = (x: number) => {
        if (!powerUpsGroupRef.current) return;
        const type = Math.random() > 0.5 ? PowerUpType.MAGNET : PowerUpType.SHIELD;
        const pu = createPowerUpMesh(type);
        pu.position.set(x, 1.5, GAME_CONFIG.spawnDistance);
        pu.userData = { type };
        powerUpsGroupRef.current.add(pu);
    };

    const spawnShip = () => {
        if (!shipsGroupRef.current) return;
        let ship = pools.current.ships.pop();
        if (!ship) ship = createShip();
        const x = (Math.random() - 0.5) * 400;
        const y = 30 + Math.random() * 50;
        const z = -600;
        ship.position.set(x, y, z);
        ship.userData = { speed: 1.0 + Math.random() * 2.0 };
        ship.visible = true;
        shipsGroupRef.current.add(ship);
    }


    const spawnExhaust = (pos: THREE.Vector3, isMythic: boolean) => {
        if (!particlesGroupRef.current) return;
        const p = pools.current.particles.pop() || new THREE.Mesh(getCachedGeo(THREE.OctahedronGeometry, [0.2, 0]), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
        p.position.copy(pos);
        p.visible = true;
        // Flame color: Default Orange/Red. Mythic: Blue/Purple
        const color = isMythic ? (Math.random() > 0.5 ? 0x00ffff : 0xff00ff) : (Math.random() > 0.5 ? 0xff4400 : 0xffaa00);
        (p.material as THREE.MeshBasicMaterial).color.setHex(color);
        p.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random()) * 0.5, (Math.random()) * 0.5 + 0.5); // Push back
        p.userData.life = 0.3 + Math.random() * 0.2;
        p.userData.rotationSpeed = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        particlesGroupRef.current.add(p);
    };

    const spawnExplosion = (pos: THREE.Vector3, color: string | number, count: number = 20, isCoinOrGem: boolean = false) => {
        if (!particlesGroupRef.current) return;
        for (let i = 0; i < count; i++) {
            const p = pools.current.particles.pop() || new THREE.Mesh(getCachedGeo(THREE.OctahedronGeometry, [isCoinOrGem ? 0.3 : 0.5, 0]), new THREE.MeshBasicMaterial({ color: color }));
            p.position.copy(pos);
            p.visible = true;
            (p.material as THREE.MeshBasicMaterial).color.set(color);

            const speed = isCoinOrGem ? 0.5 : 1.0;
            p.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            );
            p.userData.life = 1.0;
            p.userData.rotationSpeed = new THREE.Vector3(Math.random() * 0.2, Math.random() * 0.2, Math.random() * 0.2);
            particlesGroupRef.current.add(p);
        }
    };
    const spawnPlayerCar = useCallback(() => {
        if (!sceneRef.current) return;
        if (playerMeshRef.current) sceneRef.current.remove(playerMeshRef.current);
        const newPlayerCar = createPlayerMesh(activeCarConfig);
        const shieldGeo = new THREE.SphereGeometry(2.5, 16, 16);
        const shieldMat = new THREE.MeshBasicMaterial({ color: COLORS.shield, transparent: true, opacity: 0.3, wireframe: true, blending: THREE.AdditiveBlending });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        shieldMesh.visible = false;
        newPlayerCar.add(shieldMesh);
        shieldMeshRef.current = shieldMesh;
        newPlayerCar.position.x = playerState.current.currentX; newPlayerCar.position.y = 0;
        sceneRef.current.add(newPlayerCar); playerMeshRef.current = newPlayerCar;
        if (trailMeshRef.current) {
            let trailColor = activeCarConfig.color;
            if (activeCarConfig.rarity === 'LEGENDARY') trailColor = '#ffaa00'; // Gold Trail
            if (activeCarConfig.rarity === 'MYTHIC') trailColor = '#ffffff'; // Rainbow base (handled in update)
            (trailMeshRef.current.material as THREE.MeshBasicMaterial).color.set(trailColor);
        }
    }, [activeCarConfig]);

    useEffect(() => { spawnPlayerCar(); }, [spawnPlayerCar]);

    const feverModeRef = useRef(false);
    const feverTimerRef = useRef(0);
    const bloomPassRef = useRef<any>(null);
    const gridHelperRef = useRef<THREE.GridHelper | null>(null);

    // Touch handling refs
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    const initThree = () => {
        if (!containerRef.current) return;
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0a0514, 0.003);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 8, 16); camera.lookAt(0, 0, -10);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x0a0514);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.toneMapping = THREE.ReinhardToneMapping;
        containerRef.current.innerHTML = ''; containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const renderScene = new RenderPass(scene, camera);
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 1.0, 0.4, 0.85);
        bloomPass.threshold = 0.1; bloomPass.strength = 0.6; bloomPass.radius = 0.6;
        bloomPassRef.current = bloomPass;
        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene); composer.addPass(bloomPass);
        composerRef.current = composer;

        const ambientLight = new THREE.AmbientLight(0x403050, 0.8); scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xaaddff, 0.8); dirLight.position.set(20, 50, -20); scene.add(dirLight);
        const playerLight = new THREE.PointLight(COLORS.player, 2.0, 25); playerLight.position.set(0, 4, -2); scene.add(playerLight);

        const totalRoadWidth = GAME_CONFIG.laneCount * GAME_CONFIG.laneWidth;
        const roadTexture = createNeonRoadTexture(); roadTexture.repeat.set(1, 40);
        const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, color: 0xffffff, roughness: 0.2, metalness: 0.5, emissive: 0x000000 });
        roadMaterialRef.current = roadMat;
        const road = new THREE.Mesh(new THREE.PlaneGeometry(totalRoadWidth, 1200), roadMat);
        road.rotation.x = -Math.PI / 2; road.position.z = -400; scene.add(road);

        const gridHelper = new THREE.GridHelper(600, 60, 0x8800ff, 0x220055); gridHelper.position.y = -2; gridHelper.position.z = -200; scene.add(gridHelper);
        gridHelperRef.current = gridHelper;
        const sun = createRetroSun(); sun.position.set(0, 60, -500); scene.add(sun);
        const stars = createStarField(); scene.add(stars); starMeshRef.current = stars;
        const speedLines = createSpeedLines(); speedLines.position.z = 10; scene.add(speedLines); speedLinesRef.current = speedLines;

        // --- OPTIMIZED ENV GENERATION ---
        const buildingsGroup = new THREE.Group();
        // Reduced count to 30 for optimization
        for (let i = 0; i < 30; i++) {
            const h = 5 + Math.random() * 25; const w = 4 + Math.random() * 6; const d = 5 + Math.random() * 10;
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, MAT_BUILDING);
            const side = Math.random() > 0.5 ? 1 : -1;
            mesh.position.set(side * (15 + Math.random() * 30), h / 2, -600 + Math.random() * 700);
            const edges = new THREE.EdgesGeometry(geo); const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff00ff }));
            mesh.add(line); buildingsGroup.add(mesh);
        }
        buildingsGroupRef.current = buildingsGroup; scene.add(buildingsGroup);

        const streetLightsGroup = new THREE.Group();
        // Reduced count to 24 and increased spacing
        for (let i = 0; i < 24; i++) {
            const side = i % 2 === 0 ? 1 : -1; const sl = createStreetLight(side);
            // Add random Z offset to avoid perfect grid look
            const zOffset = Math.random() * 20;
            sl.position.z = -i * 40 - zOffset;
            sl.position.x = side * 10;
            streetLightsGroup.add(sl);
        }
        streetLightsGroupRef.current = streetLightsGroup; scene.add(streetLightsGroup);

        spawnPlayerCar();

        const enemiesGroup = new THREE.Group(); scene.add(enemiesGroup); enemiesGroupRef.current = enemiesGroup;
        const coinsGroup = new THREE.Group(); scene.add(coinsGroup); coinsGroupRef.current = coinsGroup;
        const gemsGroup = new THREE.Group(); scene.add(gemsGroup); gemsGroupRef.current = gemsGroup;
        const powerUpsGroup = new THREE.Group(); scene.add(powerUpsGroup); powerUpsGroupRef.current = powerUpsGroup;
        const particlesGroup = new THREE.Group(); scene.add(particlesGroup); particlesGroupRef.current = particlesGroup;
        const shipsGroup = new THREE.Group(); scene.add(shipsGroup); shipsGroupRef.current = shipsGroup;

        pools.current.particles = createParticlePool();

        const trailGeo = new THREE.PlaneGeometry(1, 1, 1, TRAIL_LENGTH);
        const trailMat = new THREE.MeshBasicMaterial({ color: activeCarConfig.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
        const trailMesh = new THREE.Mesh(trailGeo, trailMat); trailMesh.frustumCulled = false; scene.add(trailMesh); trailMeshRef.current = trailMesh;

        return () => { renderer.dispose(); composer.dispose(); };
    };

    const resetGame = () => {
        if (!playerMeshRef.current || !enemiesGroupRef.current) return;
        gameSpeedRef.current = SCALING_CONFIG.startSpeed;
        scoreRef.current = 0; setScore(0);
        frameCountRef.current = 0; distanceRef.current = 0;
        activePowerUpsRef.current = {}; onPowerUpsUpdate({});
        if (shieldMeshRef.current) shieldMeshRef.current.visible = false;
        lastMultiplierRef.current = 1; setMultiplier(1); setCurrentSpeed(SCALING_CONFIG.startSpeed);
        isCrashingRef.current = false; shakeIntensityRef.current = 0;
        spawnPlayerCar();
        currentLaneRef.current = Math.floor(GAME_CONFIG.laneCount / 2);
        playerState.current = { currentX: 0, tilt: 0, bankTilt: 0 };
        playerMeshRef.current.position.set(0, 0, 0); playerMeshRef.current.rotation.set(0, 0, 0);
        trailPositionsRef.current = []; if (trailMeshRef.current) trailMeshRef.current.visible = false;

        const clearGroup = (ref: React.MutableRefObject<THREE.Group | null>, pool: any[]) => {
            if (ref.current) {
                while (ref.current.children.length > 0) {
                    const item = ref.current.children[0];
                    ref.current.remove(item);
                    item.visible = false;
                    pool.push(item);
                }
            }
        }
        clearGroup(enemiesGroupRef, pools.current.enemies);
        clearGroup(coinsGroupRef, pools.current.coins);
        clearGroup(gemsGroupRef, pools.current.gems);
        clearGroup(particlesGroupRef, pools.current.particles);
        clearGroup(shipsGroupRef, pools.current.ships);
        if (powerUpsGroupRef.current) { while (powerUpsGroupRef.current.children.length > 0) powerUpsGroupRef.current.remove(powerUpsGroupRef.current.children[0]); }
    };

    const update = useCallback((time: number) => {
        const gameState = gameStateRef.current;
        const activeCarConfig = activeCarConfigRef.current;
        const menuState = menuStateRef.current;
        requestRef.current = requestAnimationFrame(update);
        const frameRate = 60; const interval = 1000 / frameRate;
        const deltaTime = time - lastTimeRef.current;
        if (deltaTime < interval) return;
        lastTimeRef.current = time - (deltaTime % interval);



        if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !playerMeshRef.current || !composerRef.current) return;

        // CRITICAL FIX: Handle Revive Signal
        if (isRevivingRef.current) {
            isRevivingRef.current = false;
            isCrashingRef.current = false; // Reset crash state

            // Clear immediate threats
            if (enemiesGroupRef.current) {
                enemiesGroupRef.current.children.forEach(e => {
                    if (e.position.z > -100 && e.position.z < 50) e.position.z = -1000;
                });
            }
            // Grant temporary invulnerability
            activePowerUpsRef.current[PowerUpType.SHIELD] = 180;

            // Reset Camera Shake
            shakeIntensityRef.current = 0;
        }

        if (gameState === GameState.START) {
            if (playerMeshRef.current) {
                // Interactive "Idle" animation
                // Auto rotate if not dragging
                if (!dragRef.current.active) {
                    // Slight auto-rotation
                    // playerMeshRef.current.rotation.y += 0.005; // User requested no rotation

                    // Mouse look effect (if available) -> We can use a ref for mouse pos if we tracked it generally
                    // For now, simpler bobbing
                    playerMeshRef.current.position.y = Math.sin(Date.now() * 0.0015) * 0.05;
                } else {
                    playerMeshRef.current.rotation.x = 0;
                    playerMeshRef.current.rotation.z = 0;
                }
            }
        }

        // Animate Background elements slowly for "Live" feel
        if (speedLinesRef.current) {
            const positions = speedLinesRef.current.geometry.attributes.position.array as Float32Array;
            const count = positions.length / 3;
            (speedLinesRef.current.material as THREE.PointsMaterial).opacity = 0.3;
            for (let i = 0; i < count; i++) {
                positions[i * 3 + 2] += 0.5; // Slow drift
                if (positions[i * 3 + 2] > 20) positions[i * 3 + 2] = -300;
            }
            speedLinesRef.current.geometry.attributes.position.needsUpdate = true;
        }
        if (starMeshRef.current) {
            const positions = starMeshRef.current.geometry.attributes.position.array as Float32Array;
            const count = positions.length / 3;
            for (let i = 0; i < count; i++) {
                positions[i * 3 + 2] += 0.2; // Very slow star drift
                if (positions[i * 3 + 2] > 200) positions[i * 3 + 2] = -600;
            }
            starMeshRef.current.geometry.attributes.position.needsUpdate = true;
        }


        const isGarage = menuState === 'GARAGE' || menuState === 'UPGRADES';

        // Adjust zoom based on screen width for mobile responsiveness
        const isMobile = window.innerWidth < 768;
        const garageZoom = isMobile ? 5.5 : 3.5; // Farther out on mobile

        const targetPos = isGarage ? new THREE.Vector3(2.5, 1.2, garageZoom) : new THREE.Vector3(3, 2, 6);
        const lookTarget = isGarage ? new THREE.Vector3(0, 0.5, 0) : new THREE.Vector3(0, 0.5, 0);
        cameraRef.current.position.lerp(targetPos, 0.05);
        cameraRef.current.lookAt(lookTarget);

        if (shipsGroupRef.current && frameCountRef.current % 100 === 0) spawnShip();
        if (shipsGroupRef.current) {
            for (let i = shipsGroupRef.current.children.length - 1; i >= 0; i--) {
                const s = shipsGroupRef.current.children[i];
                s.position.z += s.userData.speed + 0.5;
                if (s.position.z > 200) { shipsGroupRef.current.remove(s); s.visible = false; pools.current.ships.push(s as THREE.Group); }
            }
        }



        if (gameState === GameState.PLAYING && !isCrashingRef.current) {
            console.log("DEBUG: In Playing Loop. Speed:", gameSpeedRef.current);
            const accelMod = 1 + ((activeCarConfig.stats.speed - 1) * 0.2);
            const effectiveAcceleration = SCALING_CONFIG.acceleration * accelMod;
            const speedCapMod = 1 + ((activeCarConfig.stats.speed - 1) * 0.1);
            const effectiveMaxSpeed = SCALING_CONFIG.maxSpeed * speedCapMod;
            gameSpeedRef.current = Math.min(effectiveMaxSpeed, gameSpeedRef.current + effectiveAcceleration);
            setCurrentSpeed(gameSpeedRef.current);

            distanceRef.current += gameSpeedRef.current;
            // Multiplier: +1 every 3000m (was 1000), Max 20x. Rarity Bonus applied to denominator.
            const multBonus = RARITY_BONUS[activeCarConfig.rarity]?.multSpeed || 1.0;
            const currentMult = Math.min(20, Math.floor(distanceRef.current / (3000 / multBonus)) + 1);
            if (currentMult !== lastMultiplierRef.current) { lastMultiplierRef.current = currentMult; setMultiplier(currentMult); }
            scoreRef.current += gameSpeedRef.current * 10; setScore(Math.floor(scoreRef.current));
            frameCountRef.current++;

            // --- FEVER MODE LOGIC ---
            if (lastMultiplierRef.current >= 20) {
                if (!feverModeRef.current) {
                    feverModeRef.current = true;
                    feverTimerRef.current = 600; // 10 seconds at 60fps
                    audioManager.play('powerup'); // Or a special sound if available
                }
            }

            if (feverModeRef.current) {
                feverTimerRef.current--;
                if (feverTimerRef.current <= 0) {
                    feverModeRef.current = false;
                    // Reset Multiplier? Or keep it high? User said "when ... for 10 seconds". 
                    // Let's keep it 20 but visuals fade.
                }

                // Visuals: GOLDEN WORLD
                if (sceneRef.current && sceneRef.current.fog) {
                    // Transition Fog to Gold
                    const fog = sceneRef.current.fog as THREE.FogExp2;
                    fog.color.lerp(new THREE.Color(0xffaa00), 0.05);
                }
                if (gridHelperRef.current) {
                    // Transition Grid to Bright Orange/Gold
                    // GridHelper colors are attributes, harder to lerp cheaply. 
                    // We can just pulse opacity or material color if feasible.
                    // Simpler: Just rely on Fog and Bloom.
                }
                if (bloomPassRef.current) {
                    bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, 2.5, 0.05); // INTENSE BLOOM
                    bloomPassRef.current.radius = THREE.MathUtils.lerp(bloomPassRef.current.radius, 1.2, 0.05);
                }
                if (roadMaterialRef.current) {
                    roadMaterialRef.current.emissive.lerp(new THREE.Color(0xaa5500), 0.05);
                }
            } else {
                // Revert Visuals
                if (sceneRef.current && sceneRef.current.fog) {
                    (sceneRef.current.fog as THREE.FogExp2).color.lerp(new THREE.Color(0x0a0514), 0.02);
                }
                if (bloomPassRef.current) {
                    bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, 0.6, 0.02);
                    bloomPassRef.current.radius = THREE.MathUtils.lerp(bloomPassRef.current.radius, 0.6, 0.02);
                }
                if (roadMaterialRef.current) {
                    roadMaterialRef.current.emissive.lerp(new THREE.Color(0x000000), 0.02);
                }
            }

            const laneOffset = currentLaneRef.current - Math.floor(GAME_CONFIG.laneCount / 2);
            const targetX = laneOffset * GAME_CONFIG.laneWidth;
            const handlingMod = (activeCarConfig.stats.handling - 1) * 0.02;
            const lerpSpeed = 0.15 + handlingMod;
            const xDiff = targetX - playerState.current.currentX;
            playerState.current.currentX += xDiff * lerpSpeed;
            const bankFactor = -xDiff * 0.15;
            playerState.current.bankTilt += (bankFactor - playerState.current.bankTilt) * 0.1;

            playerMeshRef.current.position.x = playerState.current.currentX;
            // FIX: Rotation Y + Math.PI to face away from camera (forward)
            playerMeshRef.current.rotation.z = playerState.current.bankTilt + (Math.sin(frameCountRef.current * 0.1) * 0.02);
            playerMeshRef.current.rotation.y = Math.PI + (-playerState.current.bankTilt * 0.5);
            playerMeshRef.current.position.y = Math.sin(frameCountRef.current * 0.5) * 0.02;

            // --- LEGENDARY / MYTHIC FX ---
            if (activeCarConfig.rarity === 'LEGENDARY' || activeCarConfig.rarity === 'MYTHIC') {
                // Exhaust Flames
                if (frameCountRef.current % 3 === 0) {
                    const exhaustPos = playerMeshRef.current.position.clone();
                    exhaustPos.z -= 1.8; // Behind car roughly
                    exhaustPos.y += 0.3;
                    exhaustPos.x -= 0.4; spawnExhaust(exhaustPos, activeCarConfig.rarity === 'MYTHIC');
                    exhaustPos.x += 0.8; spawnExhaust(exhaustPos, activeCarConfig.rarity === 'MYTHIC');
                }
            }
            if (activeCarConfig.rarity === 'MYTHIC' && trailMeshRef.current && frameCountRef.current % 5 === 0) {
                // Rainbow Trail Pulse
                const hue = (frameCountRef.current % 360) / 360;
                (trailMeshRef.current.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.5);
            }

            if (isRevivingRef.current) {
                isRevivingRef.current = false;
                if (enemiesGroupRef.current) {
                    for (let i = enemiesGroupRef.current.children.length - 1; i >= 0; i--) {
                        const e = enemiesGroupRef.current.children[i];
                        if (e.position.z > -100 && e.position.z < 50) { e.position.z = -1000; }
                    }
                }
                activePowerUpsRef.current[PowerUpType.SHIELD] = 180 * (RARITY_BONUS[activeCarConfig.rarity as keyof typeof RARITY_BONUS]?.shieldMult || 1.0);
            }

            let hasActiveShield = false; let hasActiveMagnet = false;
            const currentPowerUps = activePowerUpsRef.current;
            Object.keys(currentPowerUps).forEach(key => {
                if (currentPowerUps[key] > 0) {
                    currentPowerUps[key]--;
                    if (key === PowerUpType.SHIELD) hasActiveShield = true;
                    if (key === PowerUpType.MAGNET) hasActiveMagnet = true;
                } else { delete currentPowerUps[key]; }
            });

            // FEVER INVINCIBILITY
            if (feverModeRef.current) hasActiveShield = true;
            if (shieldMeshRef.current) {
                shieldMeshRef.current.visible = hasActiveShield;
                if (hasActiveShield) shieldMeshRef.current.rotation.y += 0.1;
            }
            if (frameCountRef.current % 30 === 0) onPowerUpsUpdate({ ...currentPowerUps });

            if (trailMeshRef.current) {
                trailMeshRef.current.visible = true;
                const positions = trailPositionsRef.current;
                for (let i = 0; i < positions.length; i++) positions[i].z += gameSpeedRef.current;
                positions.unshift({ x: playerState.current.currentX, z: 2.5 });
                if (positions.length > TRAIL_LENGTH) positions.pop();
                const geo = trailMeshRef.current.geometry as THREE.PlaneGeometry;
                const posAttribute = geo.attributes.position;
                const trailWidth = 1.2;
                for (let i = 0; i < positions.length; i++) {
                    const point = positions[i];
                    const leftIdx = i * 2; const rightIdx = i * 2 + 1;
                    const progress = i / positions.length;
                    const currentWidth = trailWidth * (1 - progress * 0.8);
                    if (leftIdx < posAttribute.count) posAttribute.setXYZ(leftIdx, point.x - currentWidth / 2, 0.1, point.z);
                    if (rightIdx < posAttribute.count) posAttribute.setXYZ(rightIdx, point.x + currentWidth / 2, 0.1, point.z);
                }
                posAttribute.needsUpdate = true;
            }

            const targetFOV = 60 + (gameSpeedRef.current * 3);
            cameraRef.current.fov += (targetFOV - cameraRef.current.fov) * 0.05;
            cameraRef.current.updateProjectionMatrix();
            if (shakeIntensityRef.current > 0) shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - 0.05);
            let shakeX = 0; let shakeY = 0;
            if (gameSpeedRef.current > 4.0) {
                const speedShake = (gameSpeedRef.current - 4.0) * 0.02;
                shakeX += (Math.random() - 0.5) * speedShake; shakeY += (Math.random() - 0.5) * speedShake;
            }
            if (shakeIntensityRef.current > 0) {
                shakeX += (Math.random() - 0.5) * shakeIntensityRef.current; shakeY += (Math.random() - 0.5) * shakeIntensityRef.current;
            }
            const camTargetX = playerState.current.currentX * 0.7;
            cameraRef.current.position.x += (camTargetX - cameraRef.current.position.x) * 0.1 + shakeX;
            cameraRef.current.position.y = 8 + shakeY; cameraRef.current.position.z = 16;
            const lookAtX = playerState.current.currentX * 0.3;
            cameraRef.current.rotation.z = -playerState.current.bankTilt * 0.2;
            cameraRef.current.lookAt(lookAtX, 2 + shakeY, -20);

            if (roadMaterialRef.current && roadMaterialRef.current.map) roadMaterialRef.current.map.offset.y += (gameSpeedRef.current * 0.02);

            if (buildingsGroupRef.current) {
                buildingsGroupRef.current.children.forEach(b => {
                    b.position.z += gameSpeedRef.current;
                    if (b.position.z > 20) { b.position.z = -600; b.scale.y = 0.5 + Math.random(); }
                });
            }
            if (streetLightsGroupRef.current) {
                streetLightsGroupRef.current.children.forEach(sl => {
                    sl.position.z += gameSpeedRef.current;
                    if (sl.position.z > 20) sl.position.z = -900; // Reset further back
                });
            }

            if (speedLinesRef.current) {
                const positions = speedLinesRef.current.geometry.attributes.position.array as Float32Array;
                const count = positions.length / 3;
                (speedLinesRef.current.material as THREE.PointsMaterial).opacity = Math.min(1.0, (gameSpeedRef.current - 2.0) / 8.0) * 0.5;
                for (let i = 0; i < count; i++) {
                    positions[i * 3 + 2] += gameSpeedRef.current * 1.5;
                    if (positions[i * 3 + 2] > 20) positions[i * 3 + 2] = -300;
                }
                speedLinesRef.current.geometry.attributes.position.needsUpdate = true;
            }
            if (starMeshRef.current) {
                const positions = starMeshRef.current.geometry.attributes.position.array as Float32Array;
                const count = positions.length / 3;
                for (let i = 0; i < count; i++) {
                    positions[i * 3 + 2] += gameSpeedRef.current * 0.5;
                    if (positions[i * 3 + 2] > 200) positions[i * 3 + 2] = -600;
                }
                starMeshRef.current.geometry.attributes.position.needsUpdate = true;
            }

            if (frameCountRef.current % 120 === 0) spawnShip();
            if (shipsGroupRef.current) {
                for (let i = shipsGroupRef.current.children.length - 1; i >= 0; i--) {
                    const s = shipsGroupRef.current.children[i];
                    s.position.z += s.userData.speed + gameSpeedRef.current * 0.5;
                    if (s.position.z > 200) { shipsGroupRef.current.remove(s); s.visible = false; pools.current.ships.push(s as THREE.Group); }
                }
            }

            const spawnRate = Math.max(10, Math.floor(GAME_CONFIG.spawnRateInitial / (gameSpeedRef.current * 0.5)));
            if (frameCountRef.current % spawnRate === 0) {
                // Safe Spawn Logic: Prevent 3-lane walls
                const laneIndex = Math.floor(Math.random() * GAME_CONFIG.laneCount);
                const spawnX = (laneIndex - Math.floor(GAME_CONFIG.laneCount / 2)) * GAME_CONFIG.laneWidth;
                const rnd = Math.random();

                const gemChanceBonus = RARITY_BONUS[activeCarConfig.rarity]?.gemChance || 0;
                if (rnd > 0.96) spawnPowerUp(spawnX);
                else if (rnd > 0.92 - gemChanceBonus) spawnGem(spawnX);
                else if (rnd > 0.25) {
                    // Check if spawning an enemy here would block the last free lane
                    let canSpawnEnemy = true;
                    if (enemiesGroupRef.current) {
                        // Check enemies near spawn area (Z < -260, assuming spawn is -300)
                        const nearbyEnemies = enemiesGroupRef.current.children.filter(e => e.position.z < GAME_CONFIG.spawnDistance + 40);
                        const occupiedLanes = new Set<number>();
                        nearbyEnemies.forEach(e => {
                            const l = Math.round((e.position.x / GAME_CONFIG.laneWidth) + Math.floor(GAME_CONFIG.laneCount / 2));
                            occupiedLanes.add(l);
                        });
                        // If this lane is not occupied, but adding it would make occupied count == total lanes
                        // Wait, if occupiedLanes has 2 lanes, and we add 1 unique lane -> 3 lanes blocked. BAD.
                        // So if occupiedLanes.size >= GAME_CONFIG.laneCount - 1 && !occupiedLanes.has(laneIndex)
                        if (occupiedLanes.size >= GAME_CONFIG.laneCount - 1 && !occupiedLanes.has(laneIndex)) {
                            canSpawnEnemy = false;
                        }
                    }

                    if (canSpawnEnemy) {
                        if (Math.random() < 0.15) { // 15% Chance for Truck
                            const pair = Math.random() > 0.5 ? 0 : 1;
                            spawnTruck(pair);
                        } else { spawnEnemy(spawnX); }
                    } else {
                        spawnCoin(spawnX);
                    }
                } else {
                    spawnCoin(spawnX);
                }
            }

            if (enemiesGroupRef.current) {
                for (let i = enemiesGroupRef.current.children.length - 1; i >= 0; i--) {
                    const enemy = enemiesGroupRef.current.children[i] as THREE.Group;
                    if (enemy.userData.type === 'TRUCK') enemy.position.z += (gameSpeedRef.current * 0.9); // Trucks slower
                    else enemy.position.z += gameSpeedRef.current;

                    const p = playerMeshRef.current.position; const e = enemy.position;
                    const width = (enemy.userData.width || 2) / 2 + 1.25; // Half width + player half width (approx 1.25)
                    const length = (enemy.userData.length || 3.5);

                    if (Math.abs(p.x - e.x) < width && Math.abs(p.z - e.z) < length + gameSpeedRef.current) {
                        if (hasActiveShield) {
                            spawnExplosion(e, COLORS.enemy, 30, false);
                            shakeIntensityRef.current = 0.5;
                            enemiesGroupRef.current.remove(enemy);
                            enemy.visible = false;
                            if (enemy.userData.type === 'TRUCK') pools.current.trucks.push(enemy);
                            else pools.current.enemies.push(enemy);
                        } else if (!isCrashingRef.current) {
                            isCrashingRef.current = true;
                            audioManager.play('crash');
                            audioManager.playGameOver();
                            spawnExplosion(p, activeCarConfig.color, 80, false);
                            spawnExplosion(e, COLORS.enemy, 60, false);
                            shakeIntensityRef.current = 2.0;
                            setTimeout(() => { setGameState(GameState.GAME_OVER); }, 1500);
                        }
                    } else if (enemy.position.z > GAME_CONFIG.despawnZ) {
                        enemiesGroupRef.current.remove(enemy);
                        enemy.visible = false;
                        if (enemy.userData.type === 'TRUCK') pools.current.trucks.push(enemy);
                        else pools.current.enemies.push(enemy);
                    }
                }
            }
            if (coinsGroupRef.current) {
                for (let i = coinsGroupRef.current.children.length - 1; i >= 0; i--) {
                    const coin = coinsGroupRef.current.children[i] as THREE.Mesh;
                    if (hasActiveMagnet && playerMeshRef.current.position.distanceTo(coin.position) < 60) {
                        coin.position.lerp(playerMeshRef.current.position, 0.15);
                    } else { coin.position.z += gameSpeedRef.current; }
                    coin.rotation.y += 0.05; coin.rotation.z += 0.02;
                    const p = playerMeshRef.current.position; const c = coin.position;
                    if (Math.abs(p.x - c.x) < 2.5 && Math.abs(p.z - c.z) < 2.5 + gameSpeedRef.current) {
                        spawnExplosion(c, COLORS.coin, 10, true);
                        const coinBonus = RARITY_BONUS[activeCarConfig.rarity]?.coinMult || 1.0;
                        onCoinCollect(GAME_CONFIG.coinValue * lastMultiplierRef.current * coinBonus);
                        coinsGroupRef.current.remove(coin);
                        coin.visible = false; pools.current.coins.push(coin);
                        audioManager.play('coin');
                    } else if (coin.position.z > GAME_CONFIG.despawnZ) {
                        coinsGroupRef.current.remove(coin);
                        coin.visible = false; pools.current.coins.push(coin);
                    }
                }
            }
            if (gemsGroupRef.current) {
                for (let i = gemsGroupRef.current.children.length - 1; i >= 0; i--) {
                    const gem = gemsGroupRef.current.children[i] as THREE.Mesh;
                    gem.position.z += gameSpeedRef.current; gem.rotation.y += 0.05;
                    const p = playerMeshRef.current.position; const g = gem.position;
                    if (Math.abs(p.x - g.x) < 2.5 && Math.abs(p.z - g.z) < 2.5 + gameSpeedRef.current) {
                        spawnExplosion(g, COLORS.gem, 15, true);
                        onGemCollect();
                        gemsGroupRef.current.remove(gem);
                        gem.visible = false; pools.current.gems.push(gem);
                        audioManager.play('coin');
                    } else if (gem.position.z > GAME_CONFIG.despawnZ) {
                        gemsGroupRef.current.remove(gem);
                        gem.visible = false; pools.current.gems.push(gem);
                    }
                }
            }
            if (powerUpsGroupRef.current) {
                for (let i = powerUpsGroupRef.current.children.length - 1; i >= 0; i--) {
                    const pu = powerUpsGroupRef.current.children[i];
                    pu.position.z += gameSpeedRef.current; pu.rotation.y += 0.03; pu.rotation.x += 0.02;
                    const p = playerMeshRef.current.position; const c = pu.position;
                    if (Math.abs(p.x - c.x) < 3.0 && Math.abs(p.z - c.z) < 3.0 + gameSpeedRef.current) {
                        const type = pu.userData.type as PowerUpType;
                        const color = type === PowerUpType.MAGNET ? COLORS.magnet : COLORS.shield;
                        spawnExplosion(c, color, 30, true);
                        const level = type === PowerUpType.MAGNET ? powerUpLevels.MAGNET : powerUpLevels.SHIELD;
                        const duration = GAME_CONFIG.magnetDuration + ((level - 1) * 200);
                        const shieldBonus = type === PowerUpType.SHIELD ? (RARITY_BONUS[activeCarConfig.rarity]?.shieldMult || 1.0) : 1.0;
                        activePowerUpsRef.current[type] = duration * shieldBonus;
                        onPowerUpsUpdate({ ...activePowerUpsRef.current });
                        powerUpsGroupRef.current.remove(pu);
                        audioManager.play('powerup');
                    } else if (pu.position.z > GAME_CONFIG.despawnZ) powerUpsGroupRef.current.remove(pu);
                }
            }
        } else if (isCrashingRef.current && playerMeshRef.current) {
            playerMeshRef.current.position.x += (Math.random() - 0.5) * 0.25;
            playerMeshRef.current.position.y = (Math.random()) * 0.2;
            playerMeshRef.current.rotation.z += (Math.random() - 0.5) * 0.15;
            if (Math.random() > 0.4) spawnExplosion(playerMeshRef.current.position, '#ffaa00', 3, false);
            if (shakeIntensityRef.current > 0) {
                shakeIntensityRef.current = Math.max(0, shakeIntensityRef.current - 0.05);
                cameraRef.current.position.x += (Math.random() - 0.5) * shakeIntensityRef.current;
                cameraRef.current.position.y += (Math.random() - 0.5) * shakeIntensityRef.current;
            }
        }

        if (particlesGroupRef.current) {
            for (let i = particlesGroupRef.current.children.length - 1; i >= 0; i--) {
                const p = particlesGroupRef.current.children[i] as THREE.Mesh;
                p.position.add(p.userData.velocity); p.rotation.x += p.userData.rotationSpeed.x;
                p.userData.velocity.y -= 0.02; p.userData.life -= 0.02; p.scale.setScalar(p.userData.life);
                if (p.userData.life <= 0) {
                    particlesGroupRef.current.remove(p);
                    p.visible = false; pools.current.particles.push(p);
                }
            }
        }
        composerRef.current.render();
    }, []);

    useEffect(() => {
        const cleanup = initThree();
        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current || !composerRef.current) return;
            const w = window.innerWidth; const h = window.innerHeight;
            cameraRef.current.aspect = w / h; cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
            composerRef.current.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); if (cleanup) cleanup(); if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, []);

    useEffect(() => {
        if (gameState === GameState.START) resetGame();
        requestRef.current = requestAnimationFrame(update);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }
    }, [gameState, update]);

    // Garage Interaction (Rotation)
    useEffect(() => {
        const handleStart = (clientX: number) => {
            if (gameState !== GameState.START) return;
            // Allow rotation on HOME and GARAGE/UPGRADES
            // const isGarage = menuState === 'GARAGE' || menuState === 'UPGRADES';
            // Always active in START
            dragRef.current.active = true;
            dragRef.current.lastX = clientX;
        };

        const handleMove = (clientX: number) => {
            if (dragRef.current.active && playerMeshRef.current) {
                const diff = clientX - dragRef.current.lastX;
                // playerMeshRef.current.rotation.y += diff * 0.01; // DISABLED MANUEL ROTATION
                dragRef.current.lastX = clientX;
            }
        };

        const handleEnd = () => { dragRef.current.active = false; };

        const onMouseDown = (e: MouseEvent) => handleStart(e.clientX);
        const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
        const onMouseUp = () => handleEnd();

        const onTouchStart = (e: TouchEvent) => {
            if (gameState === GameState.START) {
                handleStart(e.touches[0].clientX);
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            if (dragRef.current.active) handleMove(e.touches[0].clientX);
        };
        const onTouchEnd = () => handleEnd();

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // SWIPE CONTROLS (GameState.PLAYING)
        const handleSwipeStart = (e: TouchEvent) => {
            // If Playing, track start for swipe. If Start, handled by rotation logic above (but carefully)
            if (gameState === GameState.PLAYING) {
                touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (gameState === GameState.START) {
                handleStart(e.touches[0].clientX);
            }
        };

        const handleSwipeEnd = (e: TouchEvent) => {
            if (gameState === GameState.PLAYING && touchStartRef.current) {
                const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
                const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
                if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
                    if (dx > 0) {
                        currentLaneRef.current = Math.min(GAME_CONFIG.laneCount - 1, currentLaneRef.current + 1);
                        audioManager.play('click');
                    } else {
                        currentLaneRef.current = Math.max(0, currentLaneRef.current - 1);
                        audioManager.play('click');
                    }
                }
                touchStartRef.current = null;
            } else if (gameState === GameState.START) {
                handleEnd();
            }
        };

        window.addEventListener('touchstart', handleSwipeStart, { passive: false });
        window.addEventListener('touchend', handleSwipeEnd, { passive: false });

        // Note: Touch events might conflict with Game Input if not careful, but Game Input is guarded by GameState.PLAYING
        window.addEventListener('touchstart', onTouchStart);
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);

        return () => {
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchstart', handleSwipeStart);
            window.removeEventListener('touchend', handleSwipeEnd);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
        };
    }, [gameState, menuState]);

    // Input Handling (Game)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== GameState.PLAYING || isCrashingRef.current) return;
            if (e.key === 'ArrowLeft' || e.key === 'a') {
                currentLaneRef.current = Math.max(0, currentLaneRef.current - 1);
                audioManager.play('click');
            }
            else if (e.key === 'ArrowRight' || e.key === 'd') {
                currentLaneRef.current = Math.min(GAME_CONFIG.laneCount - 1, currentLaneRef.current + 1);
                audioManager.play('click');
            }
        };
        const handleTouchStart = (e: TouchEvent) => { touchStartXRef.current = e.touches[0].clientX; };
        const handleTouchEnd = (e: TouchEvent) => {
            if (gameState !== GameState.PLAYING || isCrashingRef.current || touchStartXRef.current === null) return;
            const touchEndX = e.changedTouches[0].clientX; const diffX = touchEndX - touchStartXRef.current;
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) currentLaneRef.current = Math.min(GAME_CONFIG.laneCount - 1, currentLaneRef.current + 1);
                else currentLaneRef.current = Math.max(0, currentLaneRef.current - 1);
                audioManager.play('click');
            }
            touchStartXRef.current = null;
        };
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('touchstart', handleTouchStart); window.addEventListener('touchend', handleTouchEnd);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('touchstart', handleTouchStart); window.removeEventListener('touchend', handleTouchEnd); };
    }, [gameState]);

    useEffect(() => {
        if (gameState === GameState.START) {
            resetGame();
            if (playerMeshRef.current) {
                playerMeshRef.current.position.set(0, 0, 0);
                playerMeshRef.current.rotation.set(0, 0, 0);
            }
        }
    }, [gameState]);

    // Force Reset based on Key Change
    useEffect(() => {
        if (resetKey > 0) {
            resetGame();
        }
    }, [resetKey]);

    return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};






export default GameCanvas;