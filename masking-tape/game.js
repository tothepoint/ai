/**
 * Masking Tape Game - Refactored Architecture
 * Modular design for easy maintenance and extension
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
    canvas: {
        width: 800,
        height: 400
    },
    physics: {
        gravity: 0.5,
        friction: 0.95,
        rollAcceleration: 0.6,
        rewindForce: 1.5,
        anchorSnapDistance: 5,
        jumpForce: -12,
        swingForce: 0.4,           // Force applied when swinging
        swingDamping: 0.98,        // Damping for swing motion
        airFriction: 0.99          // Friction when in air (less than ground friction)
    },
    player: {
        radius: 25,
        startX: 100,
        startY: 300,
        colors: {
            body: '#e1d4b7',
            outline: '#d2b48c',
            center: '#ecf0f1',
            marker: '#333'
        }
    },
    platform: {
        colors: {
            main: '#34495e',
            detail: '#2c3e50'
        },
        conveyorPattern: {
            spacing: 20,
            speed: 20
        }
    },
    tape: {
        lineWidth: 4,
        color: '#e1d4b7',
        glueColor: 'rgba(255,255,255,0.5)',
        glueSize: { width: 10, height: 4 },
        maxLength: 200  // Maximum tape length before it constrains movement
    },
    controls: {
        left: ['a', 'arrowleft'],
        right: ['d', 'arrowright'],
        stick: ['x'],
        rewind: ['w'],
        jump: [' ', 'space', 'spacebar']
    }
};

// ==================== INPUT MANAGER ====================
class InputManager {
    constructor() {
        this.keys = {};
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            // Also store by code for special keys like Space
            this.keys[e.code.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
            this.keys[e.code.toLowerCase()] = false;
        });
    }

    isKeyPressed(keyArray) {
        return keyArray.some(key => this.keys[key]);
    }

    isPressed(action) {
        const keysForAction = CONFIG.controls[action];
        return keysForAction ? this.isKeyPressed(keysForAction) : false;
    }
}

// ==================== RENDERER ====================
class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    clear(width, height) {
        this.ctx.clearRect(0, 0, width, height);
    }

    drawPlatform(platform) {
        const { x, y, w, h, speed } = platform;
        
        // Draw platform body
        this.ctx.fillStyle = CONFIG.platform.colors.main;
        this.ctx.fillRect(x, y, w, h);
        
        // Draw conveyor belt pattern
        this.ctx.strokeStyle = CONFIG.platform.colors.detail;
        this.ctx.lineWidth = 2;
        const offset = (Date.now() / CONFIG.platform.conveyorPattern.speed * speed) % CONFIG.platform.conveyorPattern.spacing;
        
        for (let i = offset; i < w; i += CONFIG.platform.conveyorPattern.spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + i, y);
            this.ctx.lineTo(x + i, y + h);
            this.ctx.stroke();
        }
    }

    drawTape(anchorX, groundY, rollX, rollY, rollRadius, platform) {
        this.ctx.beginPath();
        this.ctx.lineWidth = CONFIG.tape.lineWidth;
        this.ctx.strokeStyle = CONFIG.tape.color;

        // Determine if player is off the platform
        const platformLeft = platform.x;
        const platformRight = platform.x + platform.w;

        // Start at anchor
        this.ctx.moveTo(anchorX, groundY);

        // Determine which edge to use based on player position relative to platform
        let cornerX = rollX;

        if (rollX < platformLeft) {
            // Player is off the left edge - use left corner
            cornerX = platformLeft;
        } else if (rollX > platformRight) {
            // Player is off the right edge - use right corner
            cornerX = platformRight;
        }

        // Draw tape along platform surface to the corner/roll position
        this.ctx.lineTo(cornerX, groundY);

        // Draw tape from corner down to roll
        this.ctx.lineTo(rollX, rollY + rollRadius);

        this.ctx.stroke();

        // Anchor glue indicator
        this.ctx.fillStyle = CONFIG.tape.glueColor;
        this.ctx.fillRect(
            anchorX - CONFIG.tape.glueSize.width / 2,
            groundY - CONFIG.tape.glueSize.height / 2,
            CONFIG.tape.glueSize.width,
            CONFIG.tape.glueSize.height
        );
    }

    drawPlayer(player) {
        const { x, y, r, rotation } = player;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);

        // Main roll body
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r, 0, Math.PI * 2);
        this.ctx.fillStyle = CONFIG.player.colors.body;
        this.ctx.fill();
        this.ctx.strokeStyle = CONFIG.player.colors.outline;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Hollow center
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        this.ctx.fillStyle = CONFIG.player.colors.center;
        this.ctx.fill();
        this.ctx.stroke();

        // Rotation marker
        this.ctx.fillStyle = CONFIG.player.colors.marker;
        this.ctx.fillRect(r - 5, -2, 5, 4);

        this.ctx.restore();
    }
}

// ==================== PHYSICS ENGINE ====================
class PhysicsEngine {
    static applyGravity(entity) {
        entity.vy += CONFIG.physics.gravity;
    }

    static applyFriction(entity) {
        entity.vx *= CONFIG.physics.friction;
    }

    static checkPlatformCollision(entity, platform) {
        const { x, y, r } = entity;
        const { x: px, y: py, w, h } = platform;
        
        return x > px && x < px + w && y + r > py && y < py + h;
    }

    static resolvePlatformCollision(entity, platform) {
        entity.y = platform.y - entity.r;
        entity.vy = 0;
    }
}

// ==================== GAME ENTITIES ====================
class Platform {
    constructor(x, y, w, h, speed = 0) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.speed = speed;
    }

    update() {
        // Platform update logic (if needed for dynamic platforms)
    }

    draw(renderer) {
        renderer.drawPlatform(this);
    }
}

class TapeSystem {
    constructor(player) {
        this.player = player;
        this.isSticking = false;
        this.attachedPlatform = null;
        this.anchorRelX = 0;
        this.deployedLength = 0;
    }

    attach(platform) {
        this.isSticking = true;
        this.attachedPlatform = platform;
        this.anchorRelX = this.player.x - platform.x;
        this.deployedLength = 0;
    }

    detach() {
        this.isSticking = false;
        this.attachedPlatform = null;
    }

    getAnchorPosition() {
        if (!this.attachedPlatform) return null;
        return this.attachedPlatform.x + this.anchorRelX;
    }

    updateDeployedLength() {
        const anchorX = this.getAnchorPosition();
        if (anchorX !== null) {
            this.deployedLength = this.player.x - anchorX;
        }
    }

    // Calculate actual tape length including corner bends
    calculateTapeLength() {
        if (!this.attachedPlatform) return 0;

        const anchorX = this.getAnchorPosition();
        const platformLeft = this.attachedPlatform.x;
        const platformRight = this.attachedPlatform.x + this.attachedPlatform.w;
        const groundY = this.attachedPlatform.y;

        let cornerX = this.player.x;

        // Determine which corner to use
        if (this.player.x < platformLeft) {
            cornerX = platformLeft;
        } else if (this.player.x > platformRight) {
            cornerX = platformRight;
        }

        // Calculate tape length: horizontal distance on platform + vertical distance to player
        const horizontalLength = Math.abs(cornerX - anchorX);
        const verticalLength = Math.abs(this.player.y + this.player.r - groundY);

        return horizontalLength + verticalLength;
    }

    // Check if player is hanging off the platform edge
    isPlayerHanging() {
        if (!this.attachedPlatform) return false;

        const platformLeft = this.attachedPlatform.x;
        const platformRight = this.attachedPlatform.x + this.attachedPlatform.w;

        // Player is hanging if they're off the platform horizontally AND NOT on the ground
        const offPlatformHorizontally = this.player.x < platformLeft || this.player.x > platformRight;
        const notOnGround = !this.player.onGround;

        return offPlatformHorizontally && notOnGround;
    }

    // Get the pivot point for swinging (the corner of the platform)
    getSwingPivot() {
        if (!this.attachedPlatform) return null;

        const platformLeft = this.attachedPlatform.x;
        const platformRight = this.attachedPlatform.x + this.attachedPlatform.w;
        const platformY = this.attachedPlatform.y;

        let pivotX;
        if (this.player.x < platformLeft) {
            pivotX = platformLeft;
        } else if (this.player.x > platformRight) {
            pivotX = platformRight;
        } else {
            return null; // Not hanging, no pivot
        }

        return { x: pivotX, y: platformY };
    }

    draw(renderer) {
        if (this.isSticking && this.attachedPlatform) {
            const anchorX = this.getAnchorPosition();
            const groundY = this.attachedPlatform.y;
            renderer.drawTape(anchorX, groundY, this.player.x, this.player.y, this.player.r, this.attachedPlatform);
        }
    }
}

class Player {
    constructor(inputManager) {
        this.r = CONFIG.player.radius;
        this.x = CONFIG.player.startX;
        this.y = CONFIG.player.startY;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.onGround = false;
        
        this.inputManager = inputManager;
        this.tapeSystem = new TapeSystem(this);
    }

    update(platforms) {
        const onPlatform = this.handlePhysics(platforms);
        this.handleTapeLogic(onPlatform);
        this.handleMovement();
        this.updateRotation();
    }

    handlePhysics(platforms) {
        PhysicsEngine.applyGravity(this);

        // Apply different friction based on whether player is hanging
        if (this.tapeSystem.isSticking && this.tapeSystem.isPlayerHanging()) {
            this.vx *= CONFIG.physics.airFriction;
            this.vy *= CONFIG.physics.airFriction;
        } else {
            PhysicsEngine.applyFriction(this);
        }

        let onPlatform = null;
        this.onGround = false;

        for (const platform of platforms) {
            if (PhysicsEngine.checkPlatformCollision(this, platform)) {
                PhysicsEngine.resolvePlatformCollision(this, platform);
                onPlatform = platform;
                this.onGround = true;

                if (!this.tapeSystem.isSticking) {
                    this.x += platform.speed;
                }
            }
        }
        return onPlatform;
    }

    handleTapeLogic(onPlatform) {
        if (this.inputManager.isPressed('stick') && onPlatform) {
            if (!this.tapeSystem.isSticking) {
                this.tapeSystem.attach(onPlatform);
            }
        } else if (!this.inputManager.isPressed('stick')) {
            this.tapeSystem.detach();
        }
    }

    handleMovement() {
        if (this.tapeSystem.isSticking) {
            this.handleStickyMovement();
        } else {
            this.handleFreeMovement();
        }

        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;

        // Enforce tape length constraint after movement
        if (this.tapeSystem.isSticking) {
            this.enforceTapeLengthConstraint();

            // Maintain position relative to moving platform (after constraint)
            this.x += this.tapeSystem.attachedPlatform.speed;
        }
    }

    handleStickyMovement() {
        const anchorX = this.tapeSystem.getAnchorPosition();
        const isHanging = this.tapeSystem.isPlayerHanging();

        if (isHanging) {
            // Swinging physics when hanging
            this.handleSwinging();
        } else {
            // Rolling while stuck on platform
            if (this.inputManager.isPressed('left')) {
                this.vx -= CONFIG.physics.rollAcceleration;
            }
            if (this.inputManager.isPressed('right')) {
                this.vx += CONFIG.physics.rollAcceleration;
            }
        }

        this.tapeSystem.updateDeployedLength();

        // Rewind mechanic
        if (this.inputManager.isPressed('rewind')) {
            this.handleRewind(anchorX);
        }
    }

    handleSwinging() {
        const pivot = this.tapeSystem.getSwingPivot();
        if (!pivot) return;

        // Calculate angle and distance from pivot
        const dx = this.x - pivot.x;
        const dy = this.y - pivot.y;
        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Apply swing force based on input
        let angularAcceleration = 0;

        if (this.inputManager.isPressed('left')) {
            // Swing left (counter-clockwise)
            angularAcceleration = -CONFIG.physics.swingForce;
        }
        if (this.inputManager.isPressed('right')) {
            // Swing right (clockwise)
            angularAcceleration = CONFIG.physics.swingForce;
        }

        // Add gravity component to create pendulum effect
        // Gravity creates a restoring force proportional to sin(angle)
        const gravityComponent = (CONFIG.physics.gravity / distance) * Math.sin(angle);
        angularAcceleration += gravityComponent;

        // Convert angular acceleration to linear velocity
        // Perpendicular direction to the rope
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);

        this.vx += perpX * angularAcceleration;
        this.vy += perpY * angularAcceleration;

        // Apply damping to prevent infinite swinging
        this.vx *= CONFIG.physics.swingDamping;
        this.vy *= CONFIG.physics.swingDamping;
    }

    enforceTapeLengthConstraint() {
        if (!this.tapeSystem.isSticking || !this.tapeSystem.attachedPlatform) {
            return;
        }

        const tapeLength = this.tapeSystem.calculateTapeLength();

        if (tapeLength <= CONFIG.tape.maxLength) {
            return; // Within limits, no constraint needed
        }

        const anchorX = this.tapeSystem.getAnchorPosition();
        const platformLeft = this.tapeSystem.attachedPlatform.x;
        const platformRight = this.tapeSystem.attachedPlatform.x + this.tapeSystem.attachedPlatform.w;
        const groundY = this.tapeSystem.attachedPlatform.y;

        // Calculate the bottom of the player (where tape attaches)
        const playerBottom = this.y + this.r;
        const verticalDist = Math.abs(playerBottom - groundY);

        // Check if player is hanging (swinging)
        const isHanging = this.tapeSystem.isPlayerHanging();

        // Determine which side the player is on and constrain accordingly
        if (this.x < platformLeft) {
            // Off left edge - tape goes: anchor -> corner -> player
            const anchorToCorner = Math.abs(platformLeft - anchorX);
            const maxHorizontalFromCorner = Math.max(0, CONFIG.tape.maxLength - anchorToCorner - verticalDist);

            if (isHanging) {
                // When swinging, use circular constraint from pivot
                const pivot = this.tapeSystem.getSwingPivot();
                const maxRadius = Math.max(0, CONFIG.tape.maxLength - anchorToCorner);
                this.constrainToCircle(pivot.x, pivot.y, maxRadius);
            } else {
                const constrainedX = platformLeft - maxHorizontalFromCorner;
                if (this.x < constrainedX) {
                    this.x = constrainedX;
                    this.vx = Math.max(0, this.vx); // Stop leftward velocity
                }
            }
        } else if (this.x > platformRight) {
            // Off right edge - tape goes: anchor -> corner -> player
            const anchorToCorner = Math.abs(platformRight - anchorX);
            const maxHorizontalFromCorner = Math.max(0, CONFIG.tape.maxLength - anchorToCorner - verticalDist);

            if (isHanging) {
                // When swinging, use circular constraint from pivot
                const pivot = this.tapeSystem.getSwingPivot();
                const maxRadius = Math.max(0, CONFIG.tape.maxLength - anchorToCorner);
                this.constrainToCircle(pivot.x, pivot.y, maxRadius);
            } else {
                const constrainedX = platformRight + maxHorizontalFromCorner;
                if (this.x > constrainedX) {
                    this.x = constrainedX;
                    this.vx = Math.min(0, this.vx); // Stop rightward velocity
                }
            }
        } else {
            // On platform - tape goes: anchor -> player (along platform surface + vertical drop)
            // The vertical distance should be minimal when on platform, but account for it
            const maxHorizontalDist = Math.max(0, CONFIG.tape.maxLength - verticalDist);

            if (this.x > anchorX) {
                // Moving right from anchor
                const constrainedX = anchorX + maxHorizontalDist;
                if (this.x > constrainedX) {
                    this.x = constrainedX;
                    this.vx = Math.min(0, this.vx); // Stop rightward velocity
                }
            } else {
                // Moving left from anchor
                const constrainedX = anchorX - maxHorizontalDist;
                if (this.x < constrainedX) {
                    this.x = constrainedX;
                    this.vx = Math.max(0, this.vx); // Stop leftward velocity
                }
            }
        }
    }

    constrainToCircle(centerX, centerY, maxRadius) {
        // Calculate distance from center to player
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxRadius) {
            // Constrain player to circle
            const angle = Math.atan2(dy, dx);
            this.x = centerX + Math.cos(angle) * maxRadius;
            this.y = centerY + Math.sin(angle) * maxRadius;

            // Project velocity to be tangent to the circle (remove radial component)
            const radialVx = (dx / distance) * (this.vx * dx + this.vy * dy) / distance;
            const radialVy = (dy / distance) * (this.vx * dx + this.vy * dy) / distance;

            this.vx -= radialVx;
            this.vy -= radialVy;
        }
    }

    handleRewind(anchorX) {
        const direction = this.x > anchorX ? -1 : 1;
        this.vx += direction * CONFIG.physics.rewindForce;

        if (Math.abs(this.x - anchorX) < CONFIG.physics.anchorSnapDistance) {
            this.vx = 0;
            this.x = anchorX;
        }
    }

    handleFreeMovement() {
        if (this.inputManager.isPressed('left')) {
            this.vx -= CONFIG.physics.rollAcceleration;
        }
        if (this.inputManager.isPressed('right')) {
            this.vx += CONFIG.physics.rollAcceleration;
        }
        if (this.inputManager.isPressed('jump') && this.onGround) {
            this.vy = CONFIG.physics.jumpForce;
        }
    }

    updateRotation() {
        this.rotation = this.x / this.r;
    }

    draw(renderer) {
        this.tapeSystem.draw(renderer);
        renderer.drawPlayer(this);
    }
}

// ==================== LEVEL MANAGER ====================
class LevelManager {
    constructor() {
        this.platforms = this.createDefaultLevel();
    }

    createDefaultLevel() {
        return [
            new Platform(0, 380, 800, 20, 0),       // Static floor
            new Platform(100, 250, 300, 20, 1.5),   // Right-moving conveyor
            new Platform(450, 150, 300, 20, -1.5)   // Left-moving conveyor
        ];
    }

    getPlatforms() {
        return this.platforms;
    }

    update() {
        this.platforms.forEach(p => p.update());
    }

    draw(renderer) {
        this.platforms.forEach(p => p.draw(renderer));
    }
}

// ==================== GAME ENGINE ====================
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.setupCanvas();
        
        this.inputManager = new InputManager();
        this.renderer = new Renderer(this.ctx);
        this.levelManager = new LevelManager();
        this.player = new Player(this.inputManager);
        
        this.isRunning = false;
    }

    setupCanvas() {
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;
    }

    start() {
        this.isRunning = true;
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
    }

    update() {
        this.levelManager.update();
        this.player.update(this.levelManager.getPlatforms());
    }

    render() {
        this.renderer.clear(this.canvas.width, this.canvas.height);
        this.levelManager.draw(this.renderer);
        this.player.draw(this.renderer);
    }

    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// ==================== INITIALIZATION ====================
const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);
game.start();
