// ===== ROBBY'S JUNGLE ADVENTURE - 3D ANIMAL CATCHING GAME =====
// Made by Robby! 🐍🌴🦊

// ===== JUNGLE ANIMALS =====
const ANIMALS = [
    // Snakes
    { name: 'Python', emoji: '🐍', color: 0x8b7355, speed: 0.05, type: 'snake' },
    { name: 'Cobra', emoji: '🐍', color: 0x2d2d2d, speed: 0.08, type: 'snake' },
    { name: 'Viper', emoji: '🐍', color: 0x228b22, speed: 0.1, type: 'snake' },
    // Mammals
    { name: 'Fox', emoji: '🦊', color: 0xff6b35, speed: 0.09, type: 'mammal' },
    { name: 'Wolf', emoji: '🐺', color: 0x708090, speed: 0.1, type: 'mammal' },
    { name: 'Bear', emoji: '🐻', color: 0x654321, speed: 0.06, type: 'mammal' },
    { name: 'Squirrel', emoji: '🐿️', color: 0xd2691e, speed: 0.15, type: 'mammal' },
    { name: 'Jaguar', emoji: '🐆', color: 0xdaa520, speed: 0.12, type: 'mammal' },
    { name: 'Monkey', emoji: '🐒', color: 0x8b4513, speed: 0.14, type: 'mammal' },
    { name: 'Parrot', emoji: '🦜', color: 0xff1493, speed: 0.08, type: 'bird' },
    { name: 'Toucan', emoji: '🦅', color: 0x000000, speed: 0.07, type: 'bird' },
    { name: 'Frog', emoji: '🐸', color: 0x32cd32, speed: 0.11, type: 'amphibian' },
    { name: 'Gorilla', emoji: '🦍', color: 0x2f2f2f, speed: 0.05, type: 'mammal' },
    { name: 'Tiger', emoji: '🐅', color: 0xff8c00, speed: 0.11, type: 'mammal' },
];

// ===== GAME STATE =====
let scene, camera, renderer;
let player = { x: 0, y: 1.6, z: 0 };
let velocity = { x: 0, z: 0 };
let yaw = 0, pitch = 0;
let keys = {};
let animals = [];
let trees = [];
let caughtAnimals = [];
let gameRunning = false;
let startTime = 0;
let mouseX = 0, mouseY = 0;
let isPointerLocked = false;

// Planet settings
const PLANET_RADIUS = 50;
let playerTheta = 0; // angle around Y axis (longitude)
let playerPhi = Math.PI / 2; // angle from top (latitude, PI/2 = equator)

// Net state
let net = null;
let netSwinging = false;
let netSwingTime = 0;
const NET_SWING_DURATION = 300; // milliseconds
const NET_CATCH_RANGE = 4; // how far the net reaches

// ===== THREE.JS SETUP =====
function initThree() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5dade2); // Tropical blue sky
    // No fog for spherical world - you can see far
    
    // Camera (first person)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Position camera on the planet surface at the "equator"
    const startPos = getPositionOnPlanet(playerTheta, playerPhi, 1.6);
    camera.position.copy(startPos);
    scene.add(camera); // Add camera to scene so attached objects (like net) are visible
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('game-canvas'),
        antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    scene.add(sunLight);
    
    // Ground
    createGround();
    
    // Jungle trees and vines
    createJungle();
    
    // Snakes
    createAnimals();
    
    // Sky
    createSky();
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        // Swing net with spacebar
        if (e.code === 'Space' && gameRunning && isPointerLocked) {
            e.preventDefault(); // Prevent page scroll
            swingNet();
        }
    });
    document.addEventListener('keyup', (e) => keys[e.code] = false);
    
    // Pointer lock for mouse look
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', () => {
        if (gameRunning) {
            if (!isPointerLocked) {
                canvas.requestPointerLock();
            } else {
                // Swing net when clicking (and pointer is locked)
                swingNet();
            }
        }
    });
    
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === canvas;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isPointerLocked && gameRunning) {
            yaw -= e.movementX * 0.002;
            pitch -= e.movementY * 0.002;
            pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, pitch));
        }
    });
    
    // Create the net
    createNet();
}

function createNet() {
    net = new THREE.Group();
    
    // Net handle (wooden pole)
    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.04, 1.5, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -0.75;
    net.add(handle);
    
    // Net ring (hoop)
    const ringGeometry = new THREE.TorusGeometry(0.4, 0.02, 8, 24);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.z = -1.5;
    ring.rotation.x = Math.PI / 2;
    net.add(ring);
    
    // Net mesh (the catching part)
    const netMeshGeometry = new THREE.ConeGeometry(0.38, 0.6, 12, 1, true);
    const netMeshMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        wireframe: true
    });
    const netMesh = new THREE.Mesh(netMeshGeometry, netMeshMaterial);
    netMesh.position.z = -1.5;
    netMesh.position.y = -0.3;
    netMesh.rotation.x = Math.PI;
    net.add(netMesh);
    
    // Position net in front of camera (will be updated each frame)
    camera.add(net);
    net.position.set(0.4, -0.3, -0.5); // Right side, slightly down, in front
    net.rotation.set(0.3, 0.2, 0); // Slight tilt
}

function swingNet() {
    if (netSwinging) return; // Already swinging
    
    netSwinging = true;
    netSwingTime = Date.now();
    
    // Check if any animal is in range
    checkNetCatch();
}

function checkNetCatch() {
    // Net catch range in angular distance (radians)
    const netRangeAngular = NET_CATCH_RANGE / PLANET_RADIUS; // ~0.08 radians for range 4 on r=50
    
    animals.forEach(animal => {
        if (animal.caught) return;
        
        // Check angular distance from animal to player
        const distToPlayer = angularDistance(animal.theta, animal.phi, playerTheta, playerPhi);
        
        // Animal must be within range
        if (distToPlayer > netRangeAngular * 1.5) return;
        
        // Check if animal is roughly in front of player
        // Calculate angle from player to animal in player's local coordinate system
        const dTheta = animal.theta - playerTheta;
        const dPhi = animal.phi - playerPhi;
        
        // When yaw=0, player faces direction of increasing phi (south)
        // atan2(x, y) where x is theta direction, y is phi direction
        const angleToAnimal = Math.atan2(-dTheta, dPhi);
        let angleDiff = angleToAnimal - yaw;
        
        // Normalize angle difference
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        if (Math.abs(angleDiff) < Math.PI / 3) { // Within 60 degree cone
            catchAnimal(animal);
        }
    });
}

function updateNet() {
    if (!net) return;
    
    if (netSwinging) {
        const elapsed = Date.now() - netSwingTime;
        const progress = elapsed / NET_SWING_DURATION;
        
        if (progress >= 1) {
            // Swing complete, reset
            netSwinging = false;
            net.rotation.set(0.3, 0.2, 0);
            net.position.set(0.4, -0.3, -0.5);
        } else {
            // Animate swing - arc from right to center
            const swingAngle = Math.sin(progress * Math.PI) * 1.5;
            net.rotation.z = -swingAngle;
            net.rotation.y = 0.2 - swingAngle * 0.5;
            net.position.x = 0.4 - swingAngle * 0.3;
            net.position.z = -0.5 - Math.sin(progress * Math.PI) * 0.3;
        }
    }
}

function createGround() {
    // Create a spherical planet
    const planetGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 64, 64);
    const planetMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2e8b57, // Darker jungle green
        roughness: 0.9
    });
    
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.receiveShadow = true;
    scene.add(planet);
    
    // Add jungle plants and ferns on the sphere surface
    for (let i = 0; i < 800; i++) {
        const plantType = Math.random();
        let plant;
        
        if (plantType < 0.5) {
            // Fern-like plants
            const fernGeometry = new THREE.ConeGeometry(0.15, 0.4, 6);
            const fernMaterial = new THREE.MeshStandardMaterial({ 
                color: Math.random() > 0.5 ? 0x228b22 : 0x006400 
            });
            plant = new THREE.Mesh(fernGeometry, fernMaterial);
        } else {
            // Tropical flowers
            const flowerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const flowerColors = [0xff69b4, 0xff4500, 0xffd700, 0xff1493, 0x9932cc];
            const flowerMaterial = new THREE.MeshStandardMaterial({ 
                color: flowerColors[Math.floor(Math.random() * flowerColors.length)]
            });
            plant = new THREE.Mesh(flowerGeometry, flowerMaterial);
        }
        
        // Random position on sphere using spherical coordinates
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1); // Uniform distribution on sphere
        const pos = sphericalToCartesian(theta, phi, PLANET_RADIUS + 0.2);
        plant.position.copy(pos);
        
        // Orient plant to point outward from planet center
        plant.lookAt(0, 0, 0);
        plant.rotateX(Math.PI / 2);
        
        plant.castShadow = true;
        scene.add(plant);
    }
}

// Convert spherical coordinates to cartesian (x, y, z)
function sphericalToCartesian(theta, phi, radius) {
    return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

// Get position on planet surface
function getPositionOnPlanet(theta, phi, height) {
    return sphericalToCartesian(theta, phi, PLANET_RADIUS + height);
}

function createJungle() {
    // Create palm trees and jungle trees distributed on sphere
    for (let i = 0; i < 120; i++) {
        // Random spherical coordinates - uniform distribution on sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        // Don't place trees too close to player's starting position (equator, theta=0)
        const dTheta = Math.abs(theta);
        const dPhi = Math.abs(phi - Math.PI / 2);
        if (dTheta > 0.2 || dPhi > 0.2) {
            if (Math.random() > 0.5) {
                createPalmTreeOnSphere(theta, phi);
            } else {
                createJungleTreeOnSphere(theta, phi);
            }
        }
    }
    
    // Add some standalone vines hanging from nothing (atmosphere)
    for (let i = 0; i < 30; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
        const vineLength = 4 + Math.random() * 6;
        const vineGeometry = new THREE.CylinderGeometry(0.04, 0.02, vineLength, 4);
        const vine = new THREE.Mesh(vineGeometry, vineMaterial);
        
        // Position vine on sphere and orient outward
        const pos = getPositionOnPlanet(theta, phi, 8);
        vine.position.copy(pos);
        
        // Orient vine to point outward (hanging down from surface)
        vine.lookAt(0, 0, 0);
        vine.rotateX(Math.PI / 2);
        
        scene.add(vine);
    }
}

// Create palm tree positioned on sphere surface
function createPalmTreeOnSphere(theta, phi) {
    const tree = new THREE.Group();
    
    // Curved trunk (palm tree style)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
    const trunkSegments = 8;
    let lastY = 0;
    let curveX = 0;
    
    for (let i = 0; i < trunkSegments; i++) {
        const segGeometry = new THREE.CylinderGeometry(0.25 - i * 0.02, 0.3 - i * 0.02, 1, 8);
        const segment = new THREE.Mesh(segGeometry, trunkMaterial);
        curveX += (Math.random() - 0.5) * 0.15;
        segment.position.set(curveX, lastY + 0.5, 0);
        segment.castShadow = true;
        tree.add(segment);
        lastY += 0.9;
    }
    
    // Palm fronds (big leaves)
    const frondMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const frond = new THREE.Group();
        
        // Main frond shape
        const frondGeo = new THREE.ConeGeometry(0.3, 3, 4);
        const frondMesh = new THREE.Mesh(frondGeo, frondMaterial);
        frondMesh.rotation.x = Math.PI / 2;
        frondMesh.position.z = 1.5;
        frond.add(frondMesh);
        
        frond.position.set(curveX, lastY, 0);
        frond.rotation.y = angle;
        frond.rotation.x = 0.5 + Math.random() * 0.3;
        tree.add(frond);
    }
    
    // Coconuts!
    const coconutMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    for (let i = 0; i < 3; i++) {
        const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), coconutMat);
        coconut.position.set(curveX + (Math.random() - 0.5) * 0.3, lastY - 0.5, (Math.random() - 0.5) * 0.3);
        tree.add(coconut);
    }
    
    // Position on sphere and orient to point outward
    const pos = getPositionOnPlanet(theta, phi, 0);
    tree.position.copy(pos);
    
    // Orient tree to point away from planet center
    tree.lookAt(0, 0, 0);
    tree.rotateX(Math.PI); // Flip so tree points outward
    
    // Random scale variation
    const scale = 0.8 + Math.random() * 0.4;
    tree.scale.set(scale, scale, scale);
    
    scene.add(tree);
    trees.push({ mesh: tree, theta: theta, phi: phi, radius: 1 });
}

// Create jungle tree positioned on sphere surface
function createJungleTreeOnSphere(theta, phi) {
    const tree = new THREE.Group();
    
    // Thick trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.6, 6, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 3;
    trunk.castShadow = true;
    tree.add(trunk);
    
    // Dense canopy (multiple spheres)
    const leafColors = [0x006400, 0x228b22, 0x2e8b57];
    for (let i = 0; i < 6; i++) {
        const canopyGeometry = new THREE.SphereGeometry(2 + Math.random(), 8, 8);
        const canopyMaterial = new THREE.MeshStandardMaterial({ 
            color: leafColors[Math.floor(Math.random() * leafColors.length)] 
        });
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.set(
            (Math.random() - 0.5) * 2,
            6 + Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        canopy.castShadow = true;
        tree.add(canopy);
    }
    
    // Hanging vines
    const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    for (let i = 0; i < 4; i++) {
        const vineLength = 3 + Math.random() * 4;
        const vineGeometry = new THREE.CylinderGeometry(0.03, 0.03, vineLength, 4);
        const vine = new THREE.Mesh(vineGeometry, vineMaterial);
        vine.position.set(
            (Math.random() - 0.5) * 2,
            6 - vineLength / 2,
            (Math.random() - 0.5) * 2
        );
        tree.add(vine);
    }
    
    // Position on sphere and orient to point outward
    const pos = getPositionOnPlanet(theta, phi, 0);
    tree.position.copy(pos);
    
    // Orient tree to point away from planet center
    tree.lookAt(0, 0, 0);
    tree.rotateX(Math.PI); // Flip so tree points outward
    
    const scale = 0.7 + Math.random() * 0.5;
    tree.scale.set(scale, scale, scale);
    
    scene.add(tree);
    trees.push({ mesh: tree, theta: theta, phi: phi, radius: 1 });
}

function createAnimal(type, x, z) {
    const animal = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: type.color });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    let legs = null; // Will store leg references for animation
    
    // Different animal shapes based on type
    switch(type.name) {
        // Snakes (no legs)
        case 'Python':
            createPython(animal, bodyMaterial, darkMaterial);
            break;
        case 'Cobra':
            createCobra(animal, bodyMaterial, darkMaterial, whiteMaterial);
            break;
        case 'Viper':
            createViper(animal, bodyMaterial, darkMaterial);
            break;
        // Mammals (with legs - we'll add animation)
        case 'Fox':
            legs = createFox(animal, bodyMaterial, whiteMaterial, darkMaterial, noseMaterial);
            break;
        case 'Wolf':
            legs = createWolf(animal, bodyMaterial, whiteMaterial, darkMaterial, noseMaterial);
            break;
        case 'Bear':
            legs = createBear(animal, bodyMaterial, darkMaterial, noseMaterial);
            break;
        case 'Squirrel':
            legs = createSquirrel(animal, bodyMaterial, whiteMaterial, darkMaterial, noseMaterial);
            break;
        case 'Jaguar':
            legs = createJaguar(animal, bodyMaterial, darkMaterial, noseMaterial);
            break;
        case 'Monkey':
            legs = createMonkey(animal, bodyMaterial, darkMaterial);
            break;
        case 'Parrot':
            createParrot(animal, bodyMaterial, darkMaterial);
            break;
        case 'Toucan':
            createToucan(animal, bodyMaterial, darkMaterial);
            break;
        case 'Frog':
            createFrog(animal, bodyMaterial, darkMaterial);
            break;
        case 'Gorilla':
            legs = createGorilla(animal, bodyMaterial, darkMaterial);
            break;
        case 'Tiger':
            legs = createTiger(animal, bodyMaterial, darkMaterial, whiteMaterial);
            break;
        default:
            legs = createGenericAnimal(animal, bodyMaterial, darkMaterial);
    }
    
    animal.position.set(x, 0, z);
    scene.add(animal);
    
    return {
        mesh: animal,
        type: type,
        x: x,
        z: z,
        targetX: x,
        targetZ: z,
        caught: false,
        moveTimer: 0,
        legs: legs // Store legs for animation
    };
}

// ===== REALISTIC SNAKE MODELS =====

// Helper to create snake body segments in a curved shape
function createSnakeBody(animal, mat, segments, thickness, length, waveAmount) {
    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const segmentGeo = new THREE.SphereGeometry(thickness * (1 - t * 0.5), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, mat);
        
        // Create S-curve
        const x = Math.sin(t * Math.PI * waveAmount) * 0.3;
        const z = -t * length;
        const y = thickness * 0.8;
        
        segment.position.set(x, y, z);
        segment.scale.set(1, 0.8, 1.2);
        segment.castShadow = true;
        animal.add(segment);
    }
}

function createPython(animal, bodyMat, darkMat) {
    // Big thick python - largest snake!
    const thickness = 0.2;
    
    // Body segments in S-curve
    for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const segmentGeo = new THREE.SphereGeometry(thickness * (1 - t * 0.4), 10, 10);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 2) * 0.5;
        const z = -t * 2.5;
        segment.position.set(x, thickness * 0.9, z);
        segment.scale.set(1, 0.7, 1.3);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Head - triangular
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bodyMat);
    head.scale.set(1.2, 0.6, 1.4);
    head.position.set(0, 0.15, 0.25);
    head.castShadow = true;
    animal.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.1, 0.2, 0.35);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.1, 0.2, 0.35);
    animal.add(rightEye);
    
    // Pattern spots
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    for (let i = 0; i < 8; i++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), spotMat);
        const t = (i + 1) / 10;
        spot.position.set(
            Math.sin(t * Math.PI * 2) * 0.5 + (Math.random() - 0.5) * 0.1,
            0.25,
            -t * 2.5
        );
        spot.scale.set(1.5, 0.3, 1);
        animal.add(spot);
    }
}

function createCobra(animal, bodyMat, darkMat, whiteMat) {
    // Cobra with hood!
    
    // Coiled body
    for (let i = 0; i < 15; i++) {
        const t = i / 15;
        const angle = t * Math.PI * 3;
        const radius = 0.4 - t * 0.2;
        const segmentGeo = new THREE.SphereGeometry(0.1 * (1 - t * 0.3), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        segment.position.set(
            Math.cos(angle) * radius,
            0.1 + t * 0.1,
            Math.sin(angle) * radius - 0.5
        );
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Raised body (the part that stands up)
    for (let i = 0; i < 8; i++) {
        const segmentGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        segment.position.set(0, 0.2 + i * 0.12, 0.1 - i * 0.02);
        segment.scale.set(1, 0.8, 1);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Hood (expanded neck)
    const hoodGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.scale.set(1.5, 0.3, 1);
    hood.position.set(0, 1.1, 0);
    hood.castShadow = true;
    animal.add(hood);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), bodyMat);
    head.scale.set(1, 0.7, 1.2);
    head.position.set(0, 1.2, 0.1);
    animal.add(head);
    
    // Eyes (menacing)
    const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.06, 1.22, 0.18);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.06, 1.22, 0.18);
    animal.add(rightEye);
    
    // Hood pattern (spectacle marking)
    const patternMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const marking = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), patternMat);
    marking.position.set(0, 1.1, -0.07);
    marking.rotation.y = Math.PI / 2;
    animal.add(marking);
}

function createViper(animal, bodyMat, darkMat) {
    // Triangular head, thick body viper
    
    // Coiled body
    for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const segmentGeo = new THREE.SphereGeometry(0.12 * (1 - t * 0.4), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 2.5) * 0.4;
        const z = -t * 1.8;
        segment.position.set(x, 0.1, z);
        segment.scale.set(1, 0.6, 1.2);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Triangular head (distinctive viper look)
    const headGeo = new THREE.ConeGeometry(0.12, 0.2, 3);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.rotation.x = -Math.PI / 2;
    head.rotation.z = Math.PI;
    head.position.set(0, 0.12, 0.15);
    animal.add(head);
    
    // Eyes on sides
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.08, 0.14, 0.1);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.08, 0.14, 0.1);
    animal.add(rightEye);
    
    // Scale pattern (diamond shapes suggested by color)
    const patternMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a });
    for (let i = 0; i < 6; i++) {
        const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), patternMat);
        const t = (i + 1) / 8;
        diamond.position.set(
            Math.sin(t * Math.PI * 2.5) * 0.4,
            0.18,
            -t * 1.8
        );
        diamond.scale.set(1, 0.3, 1);
        animal.add(diamond);
    }
}

function createAnaconda(animal, bodyMat, darkMat) {
    // HUGE thick anaconda
    const thickness = 0.25;
    
    // Massive body
    for (let i = 0; i < 25; i++) {
        const t = i / 25;
        const segmentGeo = new THREE.SphereGeometry(thickness * (1 - t * 0.3), 10, 10);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 1.5) * 0.6;
        const z = -t * 3;
        segment.position.set(x, thickness * 0.8, z);
        segment.scale.set(1, 0.7, 1.4);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Big head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), bodyMat);
    head.scale.set(1.1, 0.6, 1.3);
    head.position.set(0, 0.18, 0.3);
    animal.add(head);
    
    // Small eyes on top of head
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.08, 0.25, 0.35);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.08, 0.25, 0.35);
    animal.add(rightEye);
    
    // Spots
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x2d3a2d });
    for (let i = 0; i < 10; i++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), spotMat);
        const t = (i + 1) / 12;
        spot.position.set(
            Math.sin(t * Math.PI * 1.5) * 0.6,
            0.3,
            -t * 3
        );
        spot.scale.set(1, 0.2, 1);
        animal.add(spot);
    }
}

function createCoralSnake(animal, redMat, blackMat, whiteMat) {
    // Bright red, black, yellow/white bands - WARNING colors!
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    
    const mats = [redMat, blackMat, yellowMat, blackMat]; // Pattern repeats
    
    // Slender body with bands
    for (let i = 0; i < 24; i++) {
        const t = i / 24;
        const mat = mats[i % 4];
        const segmentGeo = new THREE.SphereGeometry(0.06 * (1 - t * 0.3), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, mat);
        
        const x = Math.sin(t * Math.PI * 3) * 0.3;
        const z = -t * 1.5;
        segment.position.set(x, 0.06, z);
        segment.scale.set(1, 0.8, 1.5);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Black head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), blackMat);
    head.scale.set(1, 0.7, 1.2);
    head.position.set(0, 0.07, 0.1);
    animal.add(head);
    
    // Tiny eyes
    const eyeGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, whiteMaterial);
    leftEye.position.set(-0.04, 0.08, 0.15);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, whiteMaterial);
    rightEye.position.set(0.04, 0.08, 0.15);
    animal.add(rightEye);
}

function createRattlesnake(animal, bodyMat, darkMat) {
    // Desert colored with rattle!
    
    // Coiled body
    for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const segmentGeo = new THREE.SphereGeometry(0.1 * (1 - t * 0.3), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 2) * 0.35;
        const z = -t * 1.6;
        segment.position.set(x, 0.08, z);
        segment.scale.set(1, 0.6, 1.3);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Diamond pattern
    const patternMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
    for (let i = 0; i < 5; i++) {
        const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), patternMat);
        const t = (i + 1) / 7;
        diamond.position.set(
            Math.sin(t * Math.PI * 2) * 0.35,
            0.15,
            -t * 1.6
        );
        diamond.scale.set(1.2, 0.3, 1.2);
        animal.add(diamond);
    }
    
    // Triangular head
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 3), bodyMat);
    head.rotation.x = -Math.PI / 2;
    head.rotation.z = Math.PI;
    head.position.set(0, 0.1, 0.12);
    animal.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.06, 0.12, 0.08);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.06, 0.12, 0.08);
    animal.add(rightEye);
    
    // RATTLE! (the important part!)
    const rattleMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a });
    for (let i = 0; i < 5; i++) {
        const rattleSegment = new THREE.Mesh(
            new THREE.SphereGeometry(0.03 - i * 0.004, 6, 6),
            rattleMat
        );
        rattleSegment.position.set(
            Math.sin(16/16 * Math.PI * 2) * 0.35,
            0.05,
            -1.6 - i * 0.05
        );
        rattleSegment.scale.set(1.3, 0.8, 1);
        animal.add(rattleSegment);
    }
}

function createBoa(animal, bodyMat, darkMat) {
    // Beautiful patterned boa constrictor
    
    // Thick body
    for (let i = 0; i < 22; i++) {
        const t = i / 22;
        const segmentGeo = new THREE.SphereGeometry(0.15 * (1 - t * 0.4), 10, 10);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 2) * 0.45;
        const z = -t * 2.2;
        segment.position.set(x, 0.12, z);
        segment.scale.set(1, 0.7, 1.3);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Saddle pattern
    const saddleMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
    for (let i = 0; i < 7; i++) {
        const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), saddleMat);
        const t = (i + 1) / 9;
        saddle.position.set(
            Math.sin(t * Math.PI * 2) * 0.45,
            0.2,
            -t * 2.2
        );
        saddle.scale.set(1.5, 0.25, 1.2);
        animal.add(saddle);
    }
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), bodyMat);
    head.scale.set(1, 0.6, 1.3);
    head.position.set(0, 0.12, 0.2);
    animal.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.07, 0.15, 0.28);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.07, 0.15, 0.28);
    animal.add(rightEye);
}

function createMamba(animal, bodyMat, darkMat) {
    // Sleek, fast green/black mamba
    
    // Long slender body
    for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const segmentGeo = new THREE.SphereGeometry(0.07 * (1 - t * 0.4), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 3) * 0.25;
        const z = -t * 2;
        segment.position.set(x, 0.06, z);
        segment.scale.set(1, 0.7, 1.4);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Coffin-shaped head (distinctive mamba feature)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), bodyMat);
    head.position.set(0, 0.06, 0.12);
    animal.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.05, 0.08, 0.15);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.05, 0.08, 0.15);
    animal.add(rightEye);
    
    // Inside of mouth is black (hence "black mamba")
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.1), mouthMat);
    mouth.position.set(0, 0.03, 0.2);
    animal.add(mouth);
}

function createKingSnake(animal, bodyMat, whiteMat, darkMat) {
    // Black and white banded king snake
    
    const mats = [bodyMat, whiteMat]; // Alternating bands
    
    for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const mat = mats[i % 2];
        const segmentGeo = new THREE.SphereGeometry(0.08 * (1 - t * 0.35), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, mat);
        
        const x = Math.sin(t * Math.PI * 2.5) * 0.35;
        const z = -t * 1.8;
        segment.position.set(x, 0.07, z);
        segment.scale.set(1, 0.75, 1.3);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Smooth head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), bodyMat);
    head.scale.set(1, 0.65, 1.2);
    head.position.set(0, 0.08, 0.12);
    animal.add(head);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.05, 0.1, 0.18);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.05, 0.1, 0.18);
    animal.add(rightEye);
}

function createTreeSnake(animal, bodyMat, darkMat) {
    // Thin, bright green tree snake
    
    // Very slender body
    for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const segmentGeo = new THREE.SphereGeometry(0.05 * (1 - t * 0.4), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 2) * 0.3;
        const z = -t * 1.5;
        // Tree snakes often have raised posture
        const y = 0.05 + Math.sin(t * Math.PI) * 0.15;
        segment.position.set(x, y, z);
        segment.scale.set(1, 0.8, 1.5);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    // Pointed snout
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 8), bodyMat);
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0.08, 0.15);
    animal.add(head);
    
    // Big eyes (tree snakes have excellent vision)
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.035, 0.1, 0.1);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.035, 0.1, 0.1);
    animal.add(rightEye);
}

function createGenericSnake(animal, bodyMat, darkMat) {
    // Default snake
    for (let i = 0; i < 15; i++) {
        const t = i / 15;
        const segmentGeo = new THREE.SphereGeometry(0.1 * (1 - t * 0.4), 8, 8);
        const segment = new THREE.Mesh(segmentGeo, bodyMat);
        
        const x = Math.sin(t * Math.PI * 2) * 0.3;
        const z = -t * 1.5;
        segment.position.set(x, 0.08, z);
        segment.scale.set(1, 0.7, 1.2);
        segment.castShadow = true;
        animal.add(segment);
    }
    
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), bodyMat);
    head.scale.set(1, 0.6, 1.2);
    head.position.set(0, 0.1, 0.15);
    animal.add(head);
    
    const eyeGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, darkMat);
    leftEye.position.set(-0.05, 0.12, 0.2);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, darkMat);
    rightEye.position.set(0.05, 0.12, 0.2);
    animal.add(rightEye);
}

// ===== JUNGLE MAMMAL MODELS =====

function createFox(animal, bodyMat, whiteMat, darkMat, noseMat) {
    // Sleek body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), bodyMat);
    body.scale.set(1, 0.7, 1.4);
    body.position.set(0, 0.4, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Chest (white)
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), whiteMat);
    chest.position.set(0, 0.35, 0.35);
    animal.add(chest);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
    head.scale.set(1, 0.9, 1.1);
    head.position.set(0, 0.55, 0.5);
    animal.add(head);
    
    // Snout
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), bodyMat);
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, 0.5, 0.75);
    animal.add(snout);
    
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), noseMat);
    nose.position.set(0, 0.5, 0.9);
    animal.add(nose);
    
    // Big triangular ears
    const earGeo = new THREE.ConeGeometry(0.12, 0.25, 4);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.12, 0.8, 0.4);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.12, 0.8, 0.4);
    animal.add(rightEar);
    
    // Eyes
    addEyes(animal, darkMat, 0.04, 0.58, 0.65, 0.08);
    
    // Legs
    const legs = addLegs(animal, bodyMat, 0.05, 0.35, 0.2, 0.25);
    
    // Fluffy tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), bodyMat);
    tail.scale.set(0.6, 0.6, 1.2);
    tail.position.set(0, 0.4, -0.55);
    animal.add(tail);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), whiteMat);
    tailTip.position.set(0, 0.35, -0.8);
    animal.add(tailTip);
    return legs;
}

function createWolf(animal, bodyMat, whiteMat, darkMat, noseMat) {
    // Lean body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), bodyMat);
    body.scale.set(0.9, 0.75, 1.4);
    body.position.set(0, 0.5, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Chest
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), whiteMat);
    chest.position.set(0, 0.4, 0.35);
    animal.add(chest);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), bodyMat);
    head.scale.set(1, 0.9, 1.2);
    head.position.set(0, 0.65, 0.5);
    animal.add(head);
    
    // Long snout
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), bodyMat);
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, 0.6, 0.75);
    animal.add(snout);
    
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), noseMat);
    nose.position.set(0, 0.6, 0.9);
    animal.add(nose);
    
    // Pointy ears
    const earGeo = new THREE.ConeGeometry(0.08, 0.2, 4);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.12, 0.88, 0.4);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.12, 0.88, 0.4);
    animal.add(rightEar);
    
    // Yellow eyes
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    addEyes(animal, yellowMat, 0.04, 0.68, 0.65, 0.08);
    
    // Legs
    const legs = addLegs(animal, bodyMat, 0.06, 0.4, 0.22, 0.3);
    
    // Bushy tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), bodyMat);
    tail.scale.set(0.5, 0.5, 1.2);
    tail.position.set(0, 0.45, -0.55);
    animal.add(tail);
    return legs;
}

function createBear(animal, bodyMat, darkMat, noseMat) {
    // Big round body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), bodyMat);
    body.scale.set(1, 0.85, 1.1);
    body.position.set(0, 0.55, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Big round head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), bodyMat);
    head.position.set(0, 0.85, 0.45);
    animal.add(head);
    
    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bodyMat);
    muzzle.scale.set(1, 0.8, 1);
    muzzle.position.set(0, 0.78, 0.75);
    animal.add(muzzle);
    
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), noseMat);
    nose.position.set(0, 0.8, 0.92);
    animal.add(nose);
    
    // Small round ears
    const earGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.25, 1.1, 0.35);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.25, 1.1, 0.35);
    animal.add(rightEar);
    
    // Eyes
    addEyes(animal, darkMat, 0.04, 0.9, 0.7, 0.12);
    
    // Chunky legs
    return addLegs(animal, bodyMat, 0.12, 0.4, 0.3, 0.35);
}

function createSquirrel(animal, bodyMat, whiteMat, darkMat, noseMat) {
    // Small round body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), bodyMat);
    body.scale.set(1, 0.9, 1.1);
    body.position.set(0, 0.25, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Round head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), bodyMat);
    head.position.set(0, 0.4, 0.15);
    animal.add(head);
    
    // Tiny snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), bodyMat);
    snout.position.set(0, 0.38, 0.28);
    animal.add(snout);
    
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), noseMat);
    nose.position.set(0, 0.38, 0.34);
    animal.add(nose);
    
    // Round ears
    const earGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.1, 0.52, 0.1);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.1, 0.52, 0.1);
    animal.add(rightEar);
    
    // Big eyes
    addEyes(animal, darkMat, 0.035, 0.43, 0.25, 0.06);
    
    // Tiny legs
    const legs = addLegs(animal, bodyMat, 0.03, 0.15, 0.1, 0.1);
    
    // HUGE fluffy tail
    const tailBase = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), bodyMat);
    tailBase.scale.set(0.7, 1, 1);
    tailBase.position.set(0, 0.35, -0.2);
    animal.add(tailBase);
    const tailMid = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bodyMat);
    tailMid.scale.set(0.6, 1.2, 0.8);
    tailMid.position.set(0, 0.55, -0.25);
    animal.add(tailMid);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bodyMat);
    tailTip.position.set(0, 0.75, -0.2);
    animal.add(tailTip);
    return legs;
}

function createJaguar(animal, bodyMat, darkMat, noseMat) {
    // Sleek powerful body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), bodyMat);
    body.scale.set(0.9, 0.7, 1.5);
    body.position.set(0, 0.5, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
    head.scale.set(1.1, 0.9, 1);
    head.position.set(0, 0.6, 0.55);
    animal.add(head);
    
    // Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bodyMat);
    snout.scale.set(1, 0.7, 1);
    snout.position.set(0, 0.55, 0.75);
    animal.add(snout);
    
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), noseMat);
    nose.position.set(0, 0.55, 0.87);
    animal.add(nose);
    
    // Round ears
    const earGeo = new THREE.SphereGeometry(0.08, 10, 10);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.18, 0.82, 0.45);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.18, 0.82, 0.45);
    animal.add(rightEar);
    
    // Spots
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
    for (let i = 0; i < 15; i++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), spotMat);
        spot.position.set(
            (Math.random() - 0.5) * 0.6,
            0.4 + Math.random() * 0.3,
            (Math.random() - 0.5) * 0.8
        );
        spot.scale.set(1, 0.3, 1);
        animal.add(spot);
    }
    
    // Eyes
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x90ee90 });
    addEyes(animal, greenMat, 0.04, 0.63, 0.7, 0.1);
    
    // Strong legs
    const legs = addLegs(animal, bodyMat, 0.07, 0.4, 0.25, 0.35);
    
    // Long tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.8, 8), bodyMat);
    tail.rotation.x = Math.PI / 3;
    tail.position.set(0, 0.4, -0.7);
    animal.add(tail);
    return legs;
}

function createMonkey(animal, bodyMat, darkMat) {
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), bodyMat);
    body.scale.set(1, 1.1, 0.9);
    body.position.set(0, 0.4, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), bodyMat);
    head.position.set(0, 0.7, 0.15);
    animal.add(head);
    
    // Face (lighter color)
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), faceMat);
    face.scale.set(1, 0.9, 0.5);
    face.position.set(0, 0.68, 0.25);
    animal.add(face);
    
    // Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), faceMat);
    snout.position.set(0, 0.62, 0.32);
    animal.add(snout);
    
    // Big ears
    const earGeo = new THREE.SphereGeometry(0.1, 10, 10);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.22, 0.75, 0.1);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.22, 0.75, 0.1);
    animal.add(rightEar);
    
    // Eyes
    addEyes(animal, darkMat, 0.04, 0.72, 0.3, 0.08);
    
    // Arms
    const armGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.4, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.25, 0.35, 0.1);
    leftArm.rotation.z = 0.5;
    animal.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.25, 0.35, 0.1);
    rightArm.rotation.z = -0.5;
    animal.add(rightArm);
    
    // Legs
    const legs = addLegs(animal, bodyMat, 0.05, 0.25, 0.12, 0.1);
    
    // Curly tail
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16, Math.PI * 1.5), bodyMat);
    tail.position.set(0, 0.3, -0.25);
    tail.rotation.y = Math.PI / 2;
    animal.add(tail);
    return legs;
}

function createParrot(animal, bodyMat, darkMat) {
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
    body.scale.set(1, 1.2, 0.8);
    body.position.set(0, 0.35, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), bodyMat);
    head.position.set(0, 0.6, 0.1);
    animal.add(head);
    
    // Beak
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 8), beakMat);
    beak.rotation.x = -Math.PI / 2 - 0.3;
    beak.position.set(0, 0.55, 0.28);
    animal.add(beak);
    
    // Eyes
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    addEyes(animal, whiteMat, 0.04, 0.63, 0.2, 0.1);
    addEyes(animal, darkMat, 0.02, 0.63, 0.23, 0.1);
    
    // Colorful wings
    const wingColors = [0x00ff00, 0x0000ff, 0xffff00];
    const wingGeo = new THREE.SphereGeometry(0.15, 10, 10);
    for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        for (let j = 0; j < 3; j++) {
            const wingMat = new THREE.MeshStandardMaterial({ color: wingColors[j] });
            const wing = new THREE.Mesh(wingGeo, wingMat);
            wing.scale.set(0.3, 0.8, 0.5);
            wing.position.set(side * 0.2, 0.35 - j * 0.1, -0.05 - j * 0.05);
            animal.add(wing);
        }
    }
    
    // Tail feathers
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    for (let i = 0; i < 3; i++) {
        const feather = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.4, 6), tailMat);
        feather.position.set((i - 1) * 0.05, 0.15, -0.25);
        feather.rotation.x = 0.5;
        animal.add(feather);
    }
    
    // Feet
    const feetMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const leftFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), feetMat);
    leftFoot.position.set(-0.08, 0.05, 0.05);
    animal.add(leftFoot);
    const rightFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), feetMat);
    rightFoot.position.set(0.08, 0.05, 0.05);
    animal.add(rightFoot);
}

function createToucan(animal, bodyMat, darkMat) {
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
    body.scale.set(1, 1.1, 0.9);
    body.position.set(0, 0.35, 0);
    body.castShadow = true;
    animal.add(body);
    
    // White chest
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), whiteMat);
    chest.position.set(0, 0.32, 0.12);
    animal.add(chest);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), bodyMat);
    head.position.set(0, 0.55, 0.1);
    animal.add(head);
    
    // HUGE colorful beak!
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xff8c00 });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 8), beakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.5, 0.35);
    animal.add(beak);
    
    // Beak stripe
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.2), greenMat);
    stripe.position.set(0, 0.48, 0.35);
    animal.add(stripe);
    
    // Eyes
    addEyes(animal, darkMat, 0.03, 0.58, 0.18, 0.08);
    
    // Wings
    const wingGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const leftWing = new THREE.Mesh(wingGeo, bodyMat);
    leftWing.scale.set(0.3, 0.8, 0.6);
    leftWing.position.set(-0.2, 0.35, -0.05);
    animal.add(leftWing);
    const rightWing = new THREE.Mesh(wingGeo, bodyMat);
    rightWing.scale.set(0.3, 0.8, 0.6);
    rightWing.position.set(0.2, 0.35, -0.05);
    animal.add(rightWing);
    
    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.05), bodyMat);
    tail.position.set(0, 0.2, -0.2);
    tail.rotation.x = 0.3;
    animal.add(tail);
    
    // Feet
    const feetMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const leftFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), feetMat);
    leftFoot.position.set(-0.08, 0.05, 0.05);
    animal.add(leftFoot);
    const rightFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), feetMat);
    rightFoot.position.set(0.08, 0.05, 0.05);
    animal.add(rightFoot);
}

function createFrog(animal, bodyMat, darkMat) {
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
    body.scale.set(1.2, 0.7, 1);
    body.position.set(0, 0.2, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Head (merged with body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), bodyMat);
    head.scale.set(1.1, 0.8, 1);
    head.position.set(0, 0.25, 0.2);
    animal.add(head);
    
    // BIG bulging eyes!
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEyeBulge = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), eyeWhiteMat);
    leftEyeBulge.position.set(-0.12, 0.4, 0.2);
    animal.add(leftEyeBulge);
    const rightEyeBulge = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), eyeWhiteMat);
    rightEyeBulge.position.set(0.12, 0.4, 0.2);
    animal.add(rightEyeBulge);
    
    // Pupils
    addEyes(animal, darkMat, 0.04, 0.42, 0.28, 0.12);
    
    // Wide mouth
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x006400 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.1), mouthMat);
    mouth.position.set(0, 0.18, 0.32);
    animal.add(mouth);
    
    // Back legs (bent)
    const legMat = bodyMat;
    const thighGeo = new THREE.SphereGeometry(0.1, 10, 10);
    const leftThigh = new THREE.Mesh(thighGeo, legMat);
    leftThigh.scale.set(0.8, 1.2, 1);
    leftThigh.position.set(-0.22, 0.15, -0.1);
    animal.add(leftThigh);
    const rightThigh = new THREE.Mesh(thighGeo, legMat);
    rightThigh.scale.set(0.8, 1.2, 1);
    rightThigh.position.set(0.22, 0.15, -0.1);
    animal.add(rightThigh);
    
    // Front legs
    const frontLegGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.15, 8);
    const leftFront = new THREE.Mesh(frontLegGeo, legMat);
    leftFront.position.set(-0.15, 0.08, 0.15);
    leftFront.rotation.z = 0.3;
    animal.add(leftFront);
    const rightFront = new THREE.Mesh(frontLegGeo, legMat);
    rightFront.position.set(0.15, 0.08, 0.15);
    rightFront.rotation.z = -0.3;
    animal.add(rightFront);
}

function createGorilla(animal, bodyMat, darkMat) {
    // Massive body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), bodyMat);
    body.scale.set(1.2, 1, 0.9);
    body.position.set(0, 0.55, 0);
    body.castShadow = true;
    animal.add(body);
    
    // Big head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), bodyMat);
    head.scale.set(1, 0.9, 1);
    head.position.set(0, 0.95, 0.2);
    animal.add(head);
    
    // Face
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), faceMat);
    face.scale.set(1, 0.8, 0.5);
    face.position.set(0, 0.9, 0.35);
    animal.add(face);
    
    // Nose/mouth area
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), faceMat);
    snout.position.set(0, 0.85, 0.42);
    animal.add(snout);
    
    // Nostrils
    const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftNostril = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), nostrilMat);
    leftNostril.position.set(-0.04, 0.85, 0.53);
    animal.add(leftNostril);
    const rightNostril = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), nostrilMat);
    rightNostril.position.set(0.04, 0.85, 0.53);
    animal.add(rightNostril);
    
    // Small eyes
    addEyes(animal, darkMat, 0.03, 0.95, 0.42, 0.1);
    
    // Huge arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.6, 10);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.45, 0.4, 0.1);
    leftArm.rotation.z = 0.8;
    animal.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.45, 0.4, 0.1);
    rightArm.rotation.z = -0.8;
    animal.add(rightArm);
    
    // Legs
    return addLegs(animal, bodyMat, 0.1, 0.35, 0.25, 0.15);
}

function createTiger(animal, bodyMat, darkMat, whiteMat) {
    // Powerful body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), bodyMat);
    body.scale.set(0.9, 0.75, 1.4);
    body.position.set(0, 0.5, 0);
    body.castShadow = true;
    animal.add(body);
    
    // White belly
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), whiteMat);
    belly.position.set(0, 0.4, 0.1);
    animal.add(belly);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), bodyMat);
    head.scale.set(1.1, 0.95, 1);
    head.position.set(0, 0.65, 0.55);
    animal.add(head);
    
    // White muzzle
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), whiteMat);
    muzzle.scale.set(1, 0.7, 0.8);
    muzzle.position.set(0, 0.58, 0.75);
    animal.add(muzzle);
    
    // Nose
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xff9999 });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), noseMat);
    nose.position.set(0, 0.6, 0.88);
    animal.add(nose);
    
    // Round ears
    const earGeo = new THREE.SphereGeometry(0.08, 10, 10);
    const leftEar = new THREE.Mesh(earGeo, bodyMat);
    leftEar.position.set(-0.2, 0.9, 0.45);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, bodyMat);
    rightEar.position.set(0.2, 0.9, 0.45);
    animal.add(rightEar);
    
    // Black stripes!
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    for (let i = 0; i < 8; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.08), stripeMat);
        stripe.position.set(0, 0.55 + (Math.random() - 0.5) * 0.2, (i - 4) * 0.15);
        stripe.rotation.y = (Math.random() - 0.5) * 0.3;
        animal.add(stripe);
    }
    
    // Eyes
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    addEyes(animal, yellowMat, 0.04, 0.68, 0.7, 0.12);
    
    // Strong legs
    const legs = addLegs(animal, bodyMat, 0.08, 0.4, 0.25, 0.35);
    
    // Long tail with stripes
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.7, 8), bodyMat);
    tail.rotation.x = Math.PI / 4;
    tail.position.set(0, 0.45, -0.65);
    animal.add(tail);
    return legs;
}

function createGenericAnimal(animal, bodyMat, darkMat) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), bodyMat);
    body.position.set(0, 0.4, 0);
    body.castShadow = true;
    animal.add(body);
    
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), bodyMat);
    head.position.set(0, 0.6, 0.35);
    animal.add(head);
    
    addEyes(animal, darkMat, 0.04, 0.65, 0.5, 0.1);
    return addLegs(animal, bodyMat, 0.06, 0.3, 0.2, 0.2);
}

// Helper functions
function addEyes(animal, mat, size, y, z, spacing) {
    const eyeGeo = new THREE.SphereGeometry(size, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, mat);
    leftEye.position.set(-spacing, y, z);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, mat);
    rightEye.position.set(spacing, y, z);
    animal.add(rightEye);
}

// Returns array of leg pivots for animation
function addLegs(animal, mat, radius, height, xSpread, zSpread) {
    const legGeo = new THREE.CylinderGeometry(radius, radius, height, 8);
    const legs = [];
    const positions = [
        { pos: [-xSpread, 0, zSpread], isFront: true, isLeft: true },
        { pos: [xSpread, 0, zSpread], isFront: true, isLeft: false },
        { pos: [-xSpread, 0, -zSpread], isFront: false, isLeft: true },
        { pos: [xSpread, 0, -zSpread], isFront: false, isLeft: false }
    ];
    positions.forEach(legData => {
        // Create pivot at ground level for rotation
        const legPivot = new THREE.Group();
        legPivot.position.set(legData.pos[0], legData.pos[1], legData.pos[2]);
        
        const leg = new THREE.Mesh(legGeo, mat);
        leg.position.set(0, height/2, 0);
        legPivot.add(leg);
        
        animal.add(legPivot);
        legs.push({ pivot: legPivot, isFront: legData.isFront, isLeft: legData.isLeft });
    });
    return legs;
}
function createAnimals() {
    animals = [];
    
    // Create 10 random animals distributed on the sphere
    for (let i = 0; i < 10; i++) {
        const type = ANIMALS[i % ANIMALS.length];
        // Random spherical position (avoid player starting area)
        let theta, phi;
        do {
            theta = Math.random() * Math.PI * 2;
            phi = Math.acos(2 * Math.random() - 1);
        } while (angularDistance(theta, phi, playerTheta, playerPhi) < 0.3);
        
        animals.push(createAnimalOnSphere(type, theta, phi));
    }
}

// Create animal positioned on sphere
function createAnimalOnSphere(type, theta, phi) {
    const animal = createAnimal(type, 0, 0); // Create at origin first
    
    // Store spherical coordinates
    animal.theta = theta;
    animal.phi = phi;
    animal.targetTheta = theta;
    animal.targetPhi = phi;
    
    // Position on sphere
    updateAnimalPositionOnSphere(animal);
    
    return animal;
}

// Update animal mesh position on sphere
function updateAnimalPositionOnSphere(animal) {
    const pos = getPositionOnPlanet(animal.theta, animal.phi, 0.15);
    animal.mesh.position.copy(pos);
    
    // Orient animal to stand on sphere surface
    animal.mesh.up = pos.clone().normalize();
    
    // Calculate forward direction for facing movement
    const tangentTheta = new THREE.Vector3(
        Math.sin(animal.phi) * (-Math.sin(animal.theta)),
        0,
        Math.sin(animal.phi) * Math.cos(animal.theta)
    ).normalize();
    
    const tangentPhi = new THREE.Vector3(
        Math.cos(animal.phi) * Math.cos(animal.theta),
        -Math.sin(animal.phi),
        Math.cos(animal.phi) * Math.sin(animal.theta)
    ).normalize();
    
    // Face movement direction based on target
    const dTheta = animal.targetTheta - animal.theta;
    const dPhi = animal.targetPhi - animal.phi;
    if (Math.abs(dTheta) > 0.001 || Math.abs(dPhi) > 0.001) {
        const faceDir = tangentTheta.clone().multiplyScalar(dTheta)
            .add(tangentPhi.clone().multiplyScalar(dPhi)).normalize();
        const lookTarget = pos.clone().add(faceDir);
        animal.mesh.lookAt(lookTarget);
    }
}

function createSky() {
    // Sun - positioned far from planet
    const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(200, 300, 200);
    scene.add(sun);
    
    // Clouds - scattered around above the planet
    for (let i = 0; i < 30; i++) {
        const cloudGroup = new THREE.Group();
        
        for (let j = 0; j < 5; j++) {
            const cloudGeometry = new THREE.SphereGeometry(2 + Math.random() * 3, 16, 16);
            const cloudMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.9
            });
            const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloudPart.position.set(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 4
            );
            cloudGroup.add(cloudPart);
        }
        
        // Position clouds around the planet at various heights
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const cloudRadius = PLANET_RADIUS + 15 + Math.random() * 20;
        const cloudPos = sphericalToCartesian(theta, phi, cloudRadius);
        cloudGroup.position.copy(cloudPos);
        
        // Orient clouds outward
        cloudGroup.lookAt(0, 0, 0);
        
        scene.add(cloudGroup);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== GAME LOGIC =====
function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    initThree();
    gameRunning = true;
    startTime = Date.now();
    caughtAnimals = [];
    
    // Request pointer lock
    document.getElementById('game-canvas').requestPointerLock();
    
    animate();
}

function updatePlayer() {
    if (!gameRunning) return;
    
    const baseSpeed = keys['ShiftLeft'] || keys['ShiftRight'] ? 0.008 : 0.004;
    
    // Movement on sphere - change theta (longitude) and phi (latitude)
    let dTheta = 0, dPhi = 0;
    
    // W/S moves forward/backward in the direction we're facing
    // A/D strafes left/right
    // yaw = 0 means facing "south" (increasing phi)
    // yaw = PI/2 means facing "east" (increasing theta on equator)
    if (keys['KeyW'] || keys['ArrowUp']) {
        dTheta += Math.sin(yaw) * baseSpeed;
        dPhi += Math.cos(yaw) * baseSpeed;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        dTheta -= Math.sin(yaw) * baseSpeed;
        dPhi -= Math.cos(yaw) * baseSpeed;
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
        dTheta -= Math.cos(yaw) * baseSpeed;
        dPhi += Math.sin(yaw) * baseSpeed;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        dTheta += Math.cos(yaw) * baseSpeed;
        dPhi -= Math.sin(yaw) * baseSpeed;
    }
    
    // Apply movement (theta wraps around, phi is clamped to avoid poles)
    const newTheta = playerTheta + dTheta;
    const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, playerPhi + dPhi));
    
    // Check tree collisions using angular distance
    let canMove = true;
    trees.forEach(tree => {
        const angDist = angularDistance(newTheta, newPhi, tree.theta, tree.phi);
        if (angDist < 0.05) { // Collision radius in radians
            canMove = false;
        }
    });
    
    if (canMove) {
        playerTheta = newTheta;
        playerPhi = newPhi;
        
        // Keep theta in [0, 2*PI] range
        while (playerTheta < 0) playerTheta += Math.PI * 2;
        while (playerTheta >= Math.PI * 2) playerTheta -= Math.PI * 2;
    }
    
    // Update camera position on sphere
    const playerPos = getPositionOnPlanet(playerTheta, playerPhi, 1.6);
    camera.position.copy(playerPos);
    
    // Camera orientation: up vector points away from planet center
    const upVector = playerPos.clone().normalize();
    
    // Calculate forward direction (tangent to sphere)
    // tangentTheta goes around the "equator" at this latitude
    // tangentPhi goes towards/away from the poles
    const tangentTheta = new THREE.Vector3(
        -Math.sin(playerTheta),
        0,
        Math.cos(playerTheta)
    ).normalize();
    
    // tangentPhi points "south" (towards increasing phi / south pole)
    const tangentPhi = new THREE.Vector3(
        -Math.cos(playerPhi) * Math.cos(playerTheta),
        Math.sin(playerPhi),
        -Math.cos(playerPhi) * Math.sin(playerTheta)
    ).normalize();
    
    // Combine tangents based on yaw to get look direction
    // yaw = 0 means looking in -Z direction on flat world, which is "south" on sphere
    const forward = tangentTheta.clone().multiplyScalar(-Math.sin(yaw))
        .add(tangentPhi.clone().multiplyScalar(-Math.cos(yaw)));
    
    // Apply pitch - positive pitch looks up
    const lookDir = forward.clone()
        .add(upVector.clone().multiplyScalar(Math.sin(pitch)));
    
    const lookTarget = playerPos.clone().add(lookDir);
    camera.up.copy(upVector);
    camera.lookAt(lookTarget);
    
    // Store player position for animal collision detection
    player.theta = playerTheta;
    player.phi = playerPhi;
}

// Calculate angular distance between two points on sphere
function angularDistance(theta1, phi1, theta2, phi2) {
    // Great circle distance
    const sinPhi1 = Math.sin(phi1);
    const cosPhi1 = Math.cos(phi1);
    const sinPhi2 = Math.sin(phi2);
    const cosPhi2 = Math.cos(phi2);
    const dTheta = theta2 - theta1;
    
    return Math.acos(
        cosPhi1 * cosPhi2 + 
        sinPhi1 * sinPhi2 * Math.cos(dTheta)
    );
}

function updateAnimals() {
    const time = Date.now();
    
    animals.forEach(animal => {
        if (animal.caught) return;
        
        // Check if player is nearby using angular distance
        const distToPlayer = angularDistance(animal.theta, animal.phi, playerTheta, playerPhi);
        
        // Run away if player is close (angular distance < 0.3 radians ~= 15 units on r=50 sphere)
        if (distToPlayer < 0.3) {
            // Move away from player - increase angle difference
            const dTheta = animal.theta - playerTheta;
            const dPhi = animal.phi - playerPhi;
            const len = Math.sqrt(dTheta * dTheta + dPhi * dPhi);
            if (len > 0.01) {
                animal.targetTheta = animal.theta + (dTheta / len) * 0.5;
                animal.targetPhi = animal.phi + (dPhi / len) * 0.5;
            }
        } else {
            // Wander randomly
            animal.moveTimer--;
            if (animal.moveTimer <= 0) {
                animal.targetTheta = animal.theta + (Math.random() - 0.5) * 0.5;
                animal.targetPhi = animal.phi + (Math.random() - 0.5) * 0.3;
                animal.moveTimer = 60 + Math.random() * 120;
            }
        }
        
        // Keep phi in valid range (avoid poles)
        animal.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, animal.targetPhi));
        
        // Move towards target
        const toTargetTheta = animal.targetTheta - animal.theta;
        const toTargetPhi = animal.targetPhi - animal.phi;
        const distToTarget = Math.sqrt(toTargetTheta * toTargetTheta + toTargetPhi * toTargetPhi);
        
        const isMoving = distToTarget > 0.01;
        
        if (isMoving) {
            const speed = distToPlayer < 0.3 ? animal.type.speed * 0.03 : animal.type.speed * 0.015;
            animal.theta += (toTargetTheta / distToTarget) * speed;
            animal.phi += (toTargetPhi / distToTarget) * speed;
            
            // Keep theta in valid range
            while (animal.theta < 0) animal.theta += Math.PI * 2;
            while (animal.theta >= Math.PI * 2) animal.theta -= Math.PI * 2;
            
            // Check tree collisions
            trees.forEach(tree => {
                const treeDist = angularDistance(animal.theta, animal.phi, tree.theta, tree.phi);
                if (treeDist < 0.05) {
                    // Push away from tree
                    const dTheta = animal.theta - tree.theta;
                    const dPhi = animal.phi - tree.phi;
                    const len = Math.sqrt(dTheta * dTheta + dPhi * dPhi);
                    if (len > 0.001) {
                        animal.theta = tree.theta + (dTheta / len) * 0.06;
                        animal.phi = tree.phi + (dPhi / len) * 0.06;
                    }
                    animal.targetTheta = animal.theta + (Math.random() - 0.5) * 0.2;
                    animal.targetPhi = animal.phi + (Math.random() - 0.5) * 0.2;
                }
            });
        }
        
        // Update position on sphere with small bobbing animation
        const bobHeight = 0.15 + Math.sin(time * 0.005) * 0.05;
        const pos = getPositionOnPlanet(animal.theta, animal.phi, bobHeight);
        animal.mesh.position.copy(pos);
        
        // Orient animal to stand on sphere surface
        animal.mesh.up = pos.clone().normalize();
        
        // Face movement direction using quaternion-based orientation
        if (isMoving && distToTarget > 0.01) {
            const tangentTheta = new THREE.Vector3(
                Math.sin(animal.phi) * (-Math.sin(animal.theta)),
                0,
                Math.sin(animal.phi) * Math.cos(animal.theta)
            ).normalize();
            
            const tangentPhi = new THREE.Vector3(
                Math.cos(animal.phi) * Math.cos(animal.theta),
                -Math.sin(animal.phi),
                Math.cos(animal.phi) * Math.sin(animal.theta)
            ).normalize();
            
            const faceDir = tangentTheta.clone().multiplyScalar(toTargetTheta)
                .add(tangentPhi.clone().multiplyScalar(toTargetPhi)).normalize();
            const lookTarget = pos.clone().add(faceDir);
            animal.mesh.lookAt(lookTarget);
        }
        
        // Animate legs if animal has them
        if (animal.legs && isMoving) {
            const legSpeed = 10 * animal.type.speed;
            animal.legs.forEach(leg => {
                // Alternate front/back legs, opposite for left/right
                const phase = leg.isFront ? 0 : Math.PI;
                const sidePhase = leg.isLeft ? 0 : Math.PI;
                const swingAngle = Math.sin(time * legSpeed + phase + sidePhase) * 0.5;
                leg.pivot.rotation.x = swingAngle;
            });
        } else if (animal.legs) {
            // Reset legs when standing still
            animal.legs.forEach(leg => {
                leg.pivot.rotation.x = 0;
            });
        }
    });
}

function catchAnimal(animal) {
    animal.caught = true;
    scene.remove(animal.mesh);
    caughtAnimals.push(animal.type);
    
    showMessage(`🎉 Caught a ${animal.type.emoji} ${animal.type.name}!`);
    updateUI();
    
    // Check win condition
    if (caughtAnimals.length >= 10) {
        winGame();
    }
}

function updateUI() {
    document.getElementById('animals-caught').textContent = `🎯 Caught: ${caughtAnimals.length}/10`;
    
    // Update timer
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('timer').textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Show caught animals
    document.getElementById('caught-display').textContent = caughtAnimals.map(a => a.emoji).join(' ');
}

let messageTimeout = null;
function showMessage(text) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.classList.add('show');
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => msg.classList.remove('show'), 2500);
}

function winGame() {
    gameRunning = false;
    document.exitPointerLock();
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('win-screen').style.display = 'block';
    document.getElementById('final-time').textContent = `⏱️ Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('animals-collected').textContent = caughtAnimals.map(a => a.emoji).join(' ');
}

// ===== ANIMATION LOOP =====
function animate() {
    if (!gameRunning) return;
    
    requestAnimationFrame(animate);
    
    updatePlayer();
    updateAnimals();
    updateNet();
    updateUI();
    
    renderer.render(scene, camera);
}

// ===== START =====
// Pre-initialize Three.js canvas (hidden until game starts)
window.addEventListener('DOMContentLoaded', () => {
    // Show start screen
    document.getElementById('start-screen').style.display = 'block';
});
