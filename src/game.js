// ===== ROBBY'S FOREST ADVENTURE - 3D ANIMAL CATCHING GAME =====
// Made by Robby! 🦊🌲

// ===== ANIMAL TYPES =====
const ANIMALS = [
    { name: 'Fox', emoji: '🦊', color: 0xff6b35, speed: 0.08 },
    { name: 'Rabbit', emoji: '🐰', color: 0xf5f5dc, speed: 0.12 },
    { name: 'Deer', emoji: '🦌', color: 0x8b4513, speed: 0.1 },
    { name: 'Bear', emoji: '🐻', color: 0x654321, speed: 0.05 },
    { name: 'Wolf', emoji: '🐺', color: 0x708090, speed: 0.09 },
    { name: 'Squirrel', emoji: '🐿️', color: 0xd2691e, speed: 0.15 },
    { name: 'Owl', emoji: '🦉', color: 0x8b7355, speed: 0.06 },
    { name: 'Raccoon', emoji: '🦝', color: 0x696969, speed: 0.07 },
    { name: 'Hedgehog', emoji: '🦔', color: 0xa0522d, speed: 0.04 },
    { name: 'Boar', emoji: '🐗', color: 0x4a3728, speed: 0.06 }
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
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 30, 100);
    
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
    
    // Trees
    createForest();
    
    // Animals
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
    // Main ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    
    // Add some height variation
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] = Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 1] * 0.1) * 0.5;
    }
    groundGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228b22,
        roughness: 0.8
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Add grass patches
    for (let i = 0; i < 500; i++) {
        const grassGeometry = new THREE.ConeGeometry(0.1, 0.3, 4);
        const grassMaterial = new THREE.MeshStandardMaterial({ 
            color: Math.random() > 0.5 ? 0x32cd32 : 0x228b22 
        });
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        grass.position.set(
            (Math.random() - 0.5) * 180,
            0.15,
            (Math.random() - 0.5) * 180
        );
        grass.castShadow = true;
        scene.add(grass);
    }
}

function createTree(x, z) {
    const tree = new THREE.Group();
    
    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);
    
    // Leaves (multiple cones for fuller look)
    const leafColors = [0x228b22, 0x006400, 0x32cd32];
    for (let i = 0; i < 3; i++) {
        const leavesGeometry = new THREE.ConeGeometry(2.5 - i * 0.5, 3, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ 
            color: leafColors[i % leafColors.length] 
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 4 + i * 1.5;
        leaves.castShadow = true;
        tree.add(leaves);
    }
    
    tree.position.set(x, 0, z);
    
    // Random scale variation
    const scale = 0.7 + Math.random() * 0.6;
    tree.scale.set(scale, scale, scale);
    
    scene.add(tree);
    trees.push({ mesh: tree, x: x, z: z, radius: 1 });
}

function createForest() {
    // Create trees in a ring around the player start
    for (let i = 0; i < 150; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 80;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        // Don't place trees too close to center
        if (Math.sqrt(x*x + z*z) > 8) {
            createTree(x, z);
        }
    }
}

function createAnimal(type, x, z) {
    const animal = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: type.color });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.set(1, 0.8, 1.2);
    body.position.y = 0.5;
    body.castShadow = true;
    animal.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const head = new THREE.Mesh(headGeometry, bodyMaterial);
    head.position.set(0, 0.7, 0.5);
    head.castShadow = true;
    animal.add(head);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 0.75, 0.75);
    animal.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 0.75, 0.75);
    animal.add(rightEye);
    
    // Ears
    const earGeometry = new THREE.ConeGeometry(0.1, 0.2, 4);
    const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
    leftEar.position.set(-0.15, 0.95, 0.4);
    animal.add(leftEar);
    const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
    rightEar.position.set(0.15, 0.95, 0.4);
    animal.add(rightEar);
    
    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
    const legPositions = [[-0.25, 0.2, 0.3], [0.25, 0.2, 0.3], [-0.25, 0.2, -0.3], [0.25, 0.2, -0.3]];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, bodyMaterial);
        leg.position.set(...pos);
        animal.add(leg);
    });
    
    // Tail
    const tailGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(0, 0.5, -0.6);
    animal.add(tail);
    
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
