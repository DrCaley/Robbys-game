// ===== ROBBY'S JUNGLE ADVENTURE - 3D SNAKE CATCHING GAME =====
// Made by Robby! 🐍🌴

// ===== SNAKE TYPES =====
const ANIMALS = [
    { name: 'Python', emoji: '🐍', color: 0x8b7355, speed: 0.05 },
    { name: 'Cobra', emoji: '🐍', color: 0x2d2d2d, speed: 0.08 },
    { name: 'Viper', emoji: '🐍', color: 0x228b22, speed: 0.1 },
    { name: 'Anaconda', emoji: '🐍', color: 0x556b2f, speed: 0.04 },
    { name: 'Coral Snake', emoji: '🐍', color: 0xff4500, speed: 0.12 },
    { name: 'Rattlesnake', emoji: '🐍', color: 0xd2b48c, speed: 0.07 },
    { name: 'Boa', emoji: '🐍', color: 0xcd853f, speed: 0.05 },
    { name: 'Mamba', emoji: '🐍', color: 0x32cd32, speed: 0.15 },
    { name: 'King Snake', emoji: '🐍', color: 0x1a1a1a, speed: 0.09 },
    { name: 'Tree Snake', emoji: '🐍', color: 0x90ee90, speed: 0.11 }
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
    scene.fog = new THREE.Fog(0x5dade2, 30, 100);
    
    // Camera (first person)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    
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
    document.addEventListener('keydown', (e) => keys[e.code] = true);
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
    // Calculate where the net is pointing (in front of player)
    const netReachX = player.x - Math.sin(yaw) * NET_CATCH_RANGE;
    const netReachZ = player.z - Math.cos(yaw) * NET_CATCH_RANGE;
    
    animals.forEach(animal => {
        if (animal.caught) return;
        
        // Check distance from animal to net swing area
        const dx = animal.x - player.x;
        const dz = animal.z - player.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);
        
        // Animal must be within range
        if (distToPlayer > NET_CATCH_RANGE) return;
        
        // Check if animal is roughly in front of player (within ~60 degree cone)
        const angleToAnimal = Math.atan2(-dx, -dz);
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
    // Main ground - rich jungle floor
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    
    // Add some height variation
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 1] * 0.1) * 0.5;
    }
    groundGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2e8b57, // Darker jungle green
        roughness: 0.9
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add jungle plants and ferns
    for (let i = 0; i < 600; i++) {
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
        
        plant.position.set(
            (Math.random() - 0.5) * 180,
            0.15,
            (Math.random() - 0.5) * 180
        );
        plant.castShadow = true;
        scene.add(plant);
    }
}

function createPalmTree(x, z) {
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
    
    tree.position.set(x, 0, z);
    
    // Random scale variation
    const scale = 0.8 + Math.random() * 0.4;
    tree.scale.set(scale, scale, scale);
    
    scene.add(tree);
    trees.push({ mesh: tree, x: x, z: z, radius: 1 });
}

function createJungleTree(x, z) {
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
    
    tree.position.set(x, 0, z);
    
    const scale = 0.7 + Math.random() * 0.5;
    tree.scale.set(scale, scale, scale);
    
    scene.add(tree);
    trees.push({ mesh: tree, x: x, z: z, radius: 1.5 });
}

function createJungle() {
    // Create palm trees and jungle trees
    for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 80;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        // Don't place trees too close to center
        if (Math.sqrt(x*x + z*z) > 8) {
            if (Math.random() > 0.5) {
                createPalmTree(x, z);
            } else {
                createJungleTree(x, z);
            }
        }
    }
    
    // Add some standalone vines hanging from nothing (atmosphere)
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 60;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
        const vineLength = 4 + Math.random() * 6;
        const vineGeometry = new THREE.CylinderGeometry(0.04, 0.02, vineLength, 4);
        const vine = new THREE.Mesh(vineGeometry, vineMaterial);
        vine.position.set(x, 8 - vineLength / 2, z);
        scene.add(vine);
    }
}

function createAnimal(type, x, z) {
    const animal = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: type.color });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    
    // Different snake body shapes based on type
    switch(type.name) {
        case 'Python':
            createPython(animal, bodyMaterial, darkMaterial);
            break;
        case 'Cobra':
            createCobra(animal, bodyMaterial, darkMaterial, whiteMaterial);
            break;
        case 'Viper':
            createViper(animal, bodyMaterial, darkMaterial);
            break;
        case 'Anaconda':
            createAnaconda(animal, bodyMaterial, darkMaterial);
            break;
        case 'Coral Snake':
            createCoralSnake(animal, accentMaterial, darkMaterial, whiteMaterial);
            break;
        case 'Rattlesnake':
            createRattlesnake(animal, bodyMaterial, darkMaterial);
            break;
        case 'Boa':
            createBoa(animal, bodyMaterial, darkMaterial);
            break;
        case 'Mamba':
            createMamba(animal, bodyMaterial, darkMaterial);
            break;
        case 'King Snake':
            createKingSnake(animal, bodyMaterial, whiteMaterial, darkMaterial);
            break;
        case 'Tree Snake':
            createTreeSnake(animal, bodyMaterial, darkMaterial);
            break;
        default:
            createGenericSnake(animal, bodyMaterial, darkMaterial);
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
        moveTimer: 0
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

function addLegs(animal, mat, radius, height, xSpread, zSpread) {
    const legGeo = new THREE.CylinderGeometry(radius, radius, height, 8);
    const positions = [
        [-xSpread, height/2, zSpread],
        [xSpread, height/2, zSpread],
        [-xSpread, height/2, -zSpread],
        [xSpread, height/2, -zSpread]
    ];
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, mat);
        leg.position.set(...pos);
        animal.add(leg);
    });
}
function createAnimals() {
    animals = [];
    
    // Create 10 random animals
    for (let i = 0; i < 10; i++) {
        const type = ANIMALS[i % ANIMALS.length];
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 50;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        animals.push(createAnimal(type, x, z));
    }
}

function createSky() {
    // Sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(50, 80, 50);
    scene.add(sun);
    
    // Clouds
    for (let i = 0; i < 20; i++) {
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
        
        cloudGroup.position.set(
            (Math.random() - 0.5) * 200,
            40 + Math.random() * 20,
            (Math.random() - 0.5) * 200
        );
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
    
    const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? 0.2 : 0.1;
    
    // Get movement direction based on camera yaw
    let moveX = 0, moveZ = 0;
    
    if (keys['KeyW'] || keys['ArrowUp']) {
        moveX -= Math.sin(yaw) * speed;
        moveZ -= Math.cos(yaw) * speed;
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        moveX += Math.sin(yaw) * speed;
        moveZ += Math.cos(yaw) * speed;
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
        moveX -= Math.cos(yaw) * speed;
        moveZ += Math.sin(yaw) * speed;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        moveX += Math.cos(yaw) * speed;
        moveZ -= Math.sin(yaw) * speed;
    }
    
    // Apply movement with collision check
    const newX = player.x + moveX;
    const newZ = player.z + moveZ;
    
    // Check tree collisions
    let canMove = true;
    trees.forEach(tree => {
        const dx = newX - tree.x;
        const dz = newZ - tree.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < tree.radius + 0.5) {
            canMove = false;
        }
    });
    
    // Keep player in bounds
    if (Math.abs(newX) > 95 || Math.abs(newZ) > 95) {
        canMove = false;
    }
    
    if (canMove) {
        player.x = newX;
        player.z = newZ;
    }
    
    // Update camera
    camera.position.set(player.x, player.y, player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

function updateAnimals() {
    animals.forEach(animal => {
        if (animal.caught) return;
        
        // Check if player is nearby
        const dx = player.x - animal.x;
        const dz = player.z - animal.z;
        const distToPlayer = Math.sqrt(dx*dx + dz*dz);
        
        // Run away if player is close (removed auto-catch - must use net!)
        if (distToPlayer < 15) {
            // Move away from player
            const angle = Math.atan2(animal.z - player.z, animal.x - player.x);
            animal.targetX = animal.x + Math.cos(angle) * 20;
            animal.targetZ = animal.z + Math.sin(angle) * 20;
        } else {
            // Wander randomly
            animal.moveTimer--;
            if (animal.moveTimer <= 0) {
                animal.targetX = animal.x + (Math.random() - 0.5) * 20;
                animal.targetZ = animal.z + (Math.random() - 0.5) * 20;
                animal.moveTimer = 60 + Math.random() * 120;
            }
        }
        
        // Keep animals in bounds
        animal.targetX = Math.max(-90, Math.min(90, animal.targetX));
        animal.targetZ = Math.max(-90, Math.min(90, animal.targetZ));
        
        // Move towards target
        const toTargetX = animal.targetX - animal.x;
        const toTargetZ = animal.targetZ - animal.z;
        const distToTarget = Math.sqrt(toTargetX*toTargetX + toTargetZ*toTargetZ);
        
        if (distToTarget > 0.5) {
            const speed = distToPlayer < 15 ? animal.type.speed * 1.5 : animal.type.speed;
            animal.x += (toTargetX / distToTarget) * speed;
            animal.z += (toTargetZ / distToTarget) * speed;
            
            // Check tree collisions
            trees.forEach(tree => {
                const tdx = animal.x - tree.x;
                const tdz = animal.z - tree.z;
                const tdist = Math.sqrt(tdx*tdx + tdz*tdz);
                if (tdist < tree.radius + 0.5) {
                    animal.x = tree.x + (tdx / tdist) * (tree.radius + 0.6);
                    animal.z = tree.z + (tdz / tdist) * (tree.radius + 0.6);
                    animal.targetX = animal.x + (Math.random() - 0.5) * 10;
                    animal.targetZ = animal.z + (Math.random() - 0.5) * 10;
                }
            });
            
            // Face movement direction
            animal.mesh.rotation.y = Math.atan2(toTargetX, toTargetZ);
        }
        
        // Animate bobbing
        animal.mesh.position.set(animal.x, Math.sin(Date.now() * 0.01) * 0.1, animal.z);
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
