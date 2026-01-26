// Game Configuration
const CONFIG = {
    GRAVITY: 0.6,
    JUMP: -13,
    SPEED: 5,
    GROUND_Y: 450,
    HEAD_SIZE: 44,
    NECK_HEIGHT: 12,
    BODY_HEIGHT: 35
};

// Sequence Matching Configuration - adjust these to tune tolerance
const MATCHING_CONFIG = {
    // Confidence scoring (higher = more forgiving)
    CONFIDENCE_MATCH: 0.25,           // Reward for perfect match
    CONFIDENCE_DECAY_ACTIVE: 0.25,    // Penalty for wrong active pose
    CONFIDENCE_DECAY_MIXED: 0.1,      // Penalty for timing variation (one idle, one active)
    CONFIDENCE_DECAY_IDLE: 0,         // Penalty for idle-to-idle (0 = no penalty)
    
    // Thresholds for match detection (lower = more forgiving)
    QUALITY_THRESHOLD_BUILD: 0.1,    // Minimum quality to start building toward a match
    QUALITY_THRESHOLD_CONFIRM: 0.35,  // Minimum quality to maintain confirmed match
    
    // Grace period (frames allowed to lose match before resetting)
    GRACE_PERIOD: 60,
    
    // History tracking
    MAX_HISTORY_LENGTH: 120           // Keep last 2 seconds at 60fps
};

// Animation Recording System
class AnimationRecorder {
    constructor() {
        this.frames = [];
        this.isRecording = false;
    }

    record(states) {
        if (this.isRecording) {
            this.frames.push(JSON.parse(JSON.stringify(states)));
        }
    }

    startRecording() {
        this.frames = [];
        this.isRecording = true;
    }

    stopRecording() {
        this.isRecording = false;
        return this.frames;
    }

    getFrames() {
        return this.frames;
    }
}

// Move Sequence Storage
class MoveSequence {
    constructor(frames, id = Math.random().toString(36).substr(2, 9)) {
        this.frames = frames;
        this.id = id;
        this.currentFrame = 0;
        this.isPlaying = false;
    }

    play() {
        this.isPlaying = true;
        this.currentFrame = 0;
    }

    stop() {
        this.isPlaying = false;
    }

    update() {
        if (this.isPlaying) {
            this.currentFrame++;
            if (this.currentFrame >= this.frames.length) {
                this.currentFrame = 0; // Loop
            }
        }
    }

    getCurrentState() {
        if (this.frames.length === 0) return null;
        return this.frames[this.currentFrame];
    }
}

// Player Class
class Player {
    constructor() {
        this.x = 100;
        this.y = 300;
        this.vx = 0;
        this.vy = 0;
        this.isGrounded = false;
        
        // Colors
        this.bodyColor = "#00ffcc";
        this.headColor = "#00ffcc";
        this.originalColor = "#00ffcc";
        
        // State Machine
        this.states = {
            leftArmRaised: false,
            rightArmRaised: false,
            leftLegRaised: false,
            rightLegRaised: false,
            lampBlinking: false
        };
        this.blinkTimer = 0;

        // Animation recording for comparison
        this.moveHistory = [];
        this.maxHistoryLength = MATCHING_CONFIG.MAX_HISTORY_LENGTH;
        
        // Sequence matching state
        this.frameCounter = 0;
        this.sequenceMatchers = new Map(); // enemyId -> SequenceMatcher
        this.currentMatchingEnemy = null;
        this.confirmedMatchEnemy = null;
        this.graceFrames = 0;
        this.gracePeriod = MATCHING_CONFIG.GRACE_PERIOD;
    }

    // State Handlers
    toggleLeftArm() { this.states.leftArmRaised = !this.states.leftArmRaised; }
    toggleRightArm() { this.states.rightArmRaised = !this.states.rightArmRaised; }
    toggleLeftLeg() { this.states.leftLegRaised = !this.states.leftLegRaised; }
    toggleRightLeg() { this.states.rightLegRaised = !this.states.rightLegRaised; }
    blink() { this.states.lampBlinking = true; this.blinkTimer = 15; }

    update(keys) {
        // Movement Logic
        const isLimping = this.states.leftLegRaised || this.states.rightLegRaised;
        const speed = isLimping ? CONFIG.SPEED * 0.4 : CONFIG.SPEED;

        if (keys['KeyA']) this.vx = -speed;
        else if (keys['KeyD']) this.vx = speed;
        else this.vx *= 0.8; // Friction

        if (keys['Space'] && this.isGrounded) {
            this.vy = CONFIG.JUMP;
            this.isGrounded = false;
        }

        this.vy += CONFIG.GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Ground check
        const feetPos = this.y + CONFIG.HEAD_SIZE + CONFIG.NECK_HEIGHT + CONFIG.BODY_HEIGHT + 25;
        if (feetPos > CONFIG.GROUND_Y) {
            this.y = CONFIG.GROUND_Y - (CONFIG.HEAD_SIZE + CONFIG.NECK_HEIGHT + CONFIG.BODY_HEIGHT + 25);
            this.vy = 0;
            this.isGrounded = true;
        }

        if (this.blinkTimer > 0) {
            this.blinkTimer--;
        } else {
            this.states.lampBlinking = false;
        }

        // Record move history for comparison
        this.recordMove();
    }

    recordMove() {
        this.moveHistory.push(JSON.parse(JSON.stringify(this.states)));
        if (this.moveHistory.length > this.maxHistoryLength) {
            this.moveHistory.shift();
        }
    }

    morphToColor(newColor) {
        this.bodyColor = newColor;
        this.headColor = newColor;
    }

    render(ctx) {
        const h = CONFIG.HEAD_SIZE;
        const neck = CONFIG.NECK_HEIGHT;
        const body = CONFIG.BODY_HEIGHT;
        const cx = this.x + h / 2; // Center X of the head

        ctx.strokeStyle = this.bodyColor;
        ctx.lineWidth = 4;
        ctx.lineCap = "square";
        ctx.shadowBlur = 0; // Reset shadow

        // 1. Lamp
        ctx.fillStyle = this.states.lampBlinking ? "#fff" : "#444";
        if (this.states.lampBlinking) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = "white";
        }
        ctx.fillRect(cx - 6, this.y - 12, 12, 6);
        ctx.shadowBlur = 0; // Turn off glow for the rest

        // Face Details
        ctx.fillStyle = this.bodyColor;
        ctx.fillRect(this.x + 30, this.y + 12, 4, 4); // Eye
        ctx.fillRect(this.x + 25, this.y + 28, 12, 2); // Mouth

        // 2. Head (filled with body color for player)
        ctx.fillStyle = this.headColor;
        ctx.fillRect(this.x, this.y, h, h);
        ctx.strokeRect(this.x, this.y, h, h);

        // 3. Neck (Starts at bottom of head, goes down by NECK_HEIGHT)
        const neckBottomY = this.y + h + neck;
        ctx.beginPath();
        ctx.moveTo(cx, this.y + h);
        ctx.lineTo(cx, neckBottomY);
        ctx.stroke();

        // 4. Torso (Starts from bottom of neck)
        const hipY = neckBottomY + body;
        ctx.beginPath();
        ctx.moveTo(cx, neckBottomY);
        ctx.lineTo(cx, hipY);
        ctx.stroke();

        // 5. Arms (Attached to the bottom of the neck/top of torso)
        this.drawLimb(ctx, cx, neckBottomY, this.states.leftArmRaised, -1, 25);
        this.drawLimb(ctx, cx, neckBottomY, this.states.rightArmRaised, 1, 25);

        // 6. Legs (Attached to the bottom of the torso)
        this.drawLimb(ctx, cx, hipY, this.states.leftLegRaised, -1, 30);
        this.drawLimb(ctx, cx, hipY, this.states.rightLegRaised, 1, 30);
    }

    drawLimb(ctx, sx, sy, isRaised, side, length) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);

        const segment = length / 2;
        if (isRaised) {
            // Right angle up: Out then Up
            ctx.lineTo(sx + (segment * 1.5 * side), sy);
            ctx.lineTo(sx + (segment * 1.5 * side), sy - segment);
        } else {
            // Right angle down: Out then Down
            ctx.lineTo(sx + (segment * side), sy);
            ctx.lineTo(sx + (segment * side), sy + segment);
        }
        ctx.stroke();
    }
}

// Enemy Class
class Enemy {
    constructor(x, bodyColor, moveSequence) {
        this.x = x;
        this.y = 300;
        this.vx = 0;
        this.vy = 0;
        this.isGrounded = false;
        
        // Colors
        this.bodyColor = bodyColor;
        this.headColor = bodyColor; // Head is filled with body color for enemies
        
        // Animation
        this.moveSequence = moveSequence;
        this.states = {
            leftArmRaised: false,
            rightArmRaised: false,
            leftLegRaised: false,
            rightLegRaised: false,
            lampBlinking: false
        };
        
        // Start animation
        this.moveSequence.play();
    }

    update() {
        // Simple horizontal movement (enemies patrol or stay in place)
        this.vy += CONFIG.GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Ground check
        const feetPos = this.y + CONFIG.HEAD_SIZE + CONFIG.NECK_HEIGHT + CONFIG.BODY_HEIGHT + 25;
        if (feetPos > CONFIG.GROUND_Y) {
            this.y = CONFIG.GROUND_Y - (CONFIG.HEAD_SIZE + CONFIG.NECK_HEIGHT + CONFIG.BODY_HEIGHT + 25);
            this.vy = 0;
            this.isGrounded = true;
        }

        // Update animation
        this.moveSequence.update();
        const currentState = this.moveSequence.getCurrentState();
        if (currentState) {
            this.states = JSON.parse(JSON.stringify(currentState));
        }
    }

    render(ctx) {
        const h = CONFIG.HEAD_SIZE;
        const neck = CONFIG.NECK_HEIGHT;
        const body = CONFIG.BODY_HEIGHT;
        const cx = this.x + h / 2;

        ctx.strokeStyle = this.bodyColor;
        ctx.lineWidth = 4;
        ctx.lineCap = "square";
        ctx.shadowBlur = 0;

        // 1. Lamp (enemies don't have lamps, but can have blinking)
        if (this.states.lampBlinking) {
            ctx.fillStyle = "#fff";
            ctx.shadowBlur = 15;
            ctx.shadowColor = "white";
            ctx.fillRect(cx - 6, this.y - 12, 12, 6);
            ctx.shadowBlur = 0;
        }

        // 2. Head (filled with body color)
        ctx.fillStyle = this.bodyColor;
        ctx.fillRect(this.x, this.y, h, h);
        ctx.strokeRect(this.x, this.y, h, h);

        // Face Details (in different color for contrast)
        ctx.fillStyle = "#000";
        ctx.fillRect(this.x + 30, this.y + 12, 4, 4); // Eye
        ctx.fillRect(this.x + 25, this.y + 28, 12, 2); // Mouth

        // 3. Neck
        const neckBottomY = this.y + h + neck;
        ctx.beginPath();
        ctx.moveTo(cx, this.y + h);
        ctx.lineTo(cx, neckBottomY);
        ctx.stroke();

        // 4. Torso
        const hipY = neckBottomY + body;
        ctx.beginPath();
        ctx.moveTo(cx, neckBottomY);
        ctx.lineTo(cx, hipY);
        ctx.stroke();

        // 5. Arms
        this.drawLimb(ctx, cx, neckBottomY, this.states.leftArmRaised, -1, 25);
        this.drawLimb(ctx, cx, neckBottomY, this.states.rightArmRaised, 1, 25);

        // 6. Legs
        this.drawLimb(ctx, cx, hipY, this.states.leftLegRaised, -1, 30);
        this.drawLimb(ctx, cx, hipY, this.states.rightLegRaised, 1, 30);
    }

    drawLimb(ctx, sx, sy, isRaised, side, length) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);

        const segment = length / 2;
        if (isRaised) {
            ctx.lineTo(sx + (segment * 1.5 * side), sy);
            ctx.lineTo(sx + (segment * 1.5 * side), sy - segment);
        } else {
            ctx.lineTo(sx + (segment * side), sy);
            ctx.lineTo(sx + (segment * side), sy + segment);
        }
        ctx.stroke();
    }
}

// Robust Sequence Matching Algorithm
class SequenceMatcher {
    constructor(enemySequenceFrames) {
        this.sequence = enemySequenceFrames;
        this.sequenceLength = enemySequenceFrames.length;
        
        // Extract unique states and transitions
        this.uniqueStates = this.extractUniqueStates();
        this.statePatternLength = this.calculatePatternLength();
        
        // Tracking
        this.matchPosition = 0;           // Current position in sequence (0 to sequenceLength-1)
        this.cyclesCompleted = 0;         // Number of full cycles through the sequence
        this.confidenceScore = 0;         // 0 to 1, indicates match quality
        this.lastMatchFrame = -Infinity;  // Last frame where a match occurred
        this.isActive = false;            // Whether we're currently tracking this sequence
    }

    extractUniqueStates() {
        const unique = [];
        if (this.sequence.length === 0) return unique;
        
        unique.push(JSON.parse(JSON.stringify(this.sequence[0])));
        for (let i = 1; i < this.sequence.length; i++) {
            if (!this.statesEqual(this.sequence[i], unique[unique.length - 1])) {
                unique.push(JSON.parse(JSON.stringify(this.sequence[i])));
            }
        }
        return unique;
    }

    calculatePatternLength() {
        // Find the shortest repeating pattern
        if (this.sequence.length <= 1) return 1;
        
        for (let len = 1; len <= this.sequence.length / 2; len++) {
            let isPattern = true;
            for (let i = 0; i < this.sequence.length; i++) {
                if (!this.statesEqual(this.sequence[i], this.sequence[i % len])) {
                    isPattern = false;
                    break;
                }
            }
            if (isPattern) return len;
        }
        return this.sequence.length;
    }

    statesEqual(state1, state2) {
        if (!state1 || !state2) return false;
        return state1.leftArmRaised === state2.leftArmRaised &&
               state1.rightArmRaised === state2.rightArmRaised &&
               state1.leftLegRaised === state2.leftLegRaised &&
               state1.rightLegRaised === state2.rightLegRaised;
    }

    isActiveState(state) {
        if (!state) return false;
        return state.leftArmRaised || state.rightArmRaised || 
               state.leftLegRaised || state.rightLegRaised;
    }

    // Find best starting position in sequence for current player state
    findBestStartingPosition(playerState) {
        // Only start matching from active states
        if (!this.isActiveState(playerState)) return -1;
        
        // Search through the entire sequence for matching active states
        for (let i = 0; i < this.sequence.length; i++) {
            if (this.isActiveState(this.sequence[i]) && 
                this.statesEqual(playerState, this.sequence[i])) {
                return i;
            }
        }
        
        return -1;
    }

    // Update matching with new player frame
    updateMatch(playerState, frameNumber) {
        const expectedState = this.sequence[this.matchPosition];
        
        if (this.statesEqual(playerState, expectedState)) {
            // Perfect match
            this.confidenceScore = Math.min(1, this.confidenceScore + MATCHING_CONFIG.CONFIDENCE_MATCH);
            this.lastMatchFrame = frameNumber;
            this.isActive = true;
            return true;
        } else if (!this.isActiveState(playerState) && !this.isActiveState(expectedState)) {
            // Both idle - maintain confidence (don't decay)
            // This allows the player to transition between poses without losing progress
            this.lastMatchFrame = frameNumber;
            this.confidenceScore = Math.max(0, this.confidenceScore - MATCHING_CONFIG.CONFIDENCE_DECAY_IDLE);
            return true;
        } else if (this.isActiveState(playerState) && this.isActiveState(expectedState)) {
            // Both active but different pose - lost match, decay
            this.confidenceScore = Math.max(0, this.confidenceScore - MATCHING_CONFIG.CONFIDENCE_DECAY_ACTIVE);
            this.isActive = false;
            return false;
        } else {
            // One active, one idle - timing variation, small decay
            this.confidenceScore = Math.max(0, this.confidenceScore - MATCHING_CONFIG.CONFIDENCE_DECAY_MIXED);
            return true;
        }
    }

    // Advance to next position in sequence
    advancePosition() {
        this.matchPosition++;
        if (this.matchPosition >= this.sequenceLength) {
            this.matchPosition = 0;
            this.cyclesCompleted++;
        }
    }

    // Reset matching state
    reset() {
        this.matchPosition = 0;
        this.cyclesCompleted = 0;
        this.confidenceScore = 0;
        this.lastMatchFrame = -Infinity;
        this.isActive = false;
    }

    // Get current match quality (0 to 1)
    getMatchQuality() {
        return this.confidenceScore;
    }

    // Check if we've completed a full cycle
    isFullCycleComplete() {
        return this.cyclesCompleted > 0 && this.matchPosition === 0;
    }
}

// Move Similarity Calculation
class MoveSimilarityCalculator {
    static compare(playerMoves, enemyMoves, windowSize = 30) {
        if (playerMoves.length < windowSize || enemyMoves.length < windowSize) {
            return 0;
        }

        const playerWindow = playerMoves.slice(-windowSize);
        const enemyWindow = enemyMoves.slice(-windowSize);

        let matches = 0;
        for (let i = 0; i < windowSize; i++) {
            if (this.statesEqual(playerWindow[i], enemyWindow[i])) {
                matches++;
            }
        }

        return matches / windowSize;
    }

    static statesEqual(state1, state2) {
        if (!state1 || !state2) return false;
        return state1.leftArmRaised === state2.leftArmRaised &&
               state1.rightArmRaised === state2.rightArmRaised &&
               state1.leftLegRaised === state2.leftLegRaised &&
               state1.rightLegRaised === state2.rightLegRaised;
    }

    static isActiveState(state) {
        if (!state) return false;
        return state.leftArmRaised || state.rightArmRaised || state.leftLegRaised || state.rightLegRaised;
    }
}

class InputHandler {
    constructor(player) {
        this.player = player;
        this.keys = {};
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('keydown', e => this.handleKeyDown(e));
        window.addEventListener('keyup', e => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        this.keys[e.code] = true;

        // State toggles
        if (e.code === 'KeyQ') this.player.toggleLeftArm();
        if (e.code === 'KeyE') this.player.toggleRightArm();
        if (e.code === 'KeyZ') this.player.toggleLeftLeg();
        if (e.code === 'KeyX') this.player.toggleRightLeg();
        if (e.code === 'KeyR') this.player.blink();
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
    }

    getKeys() {
        return this.keys;
    }
}

// Game Engine
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 500;

        this.player = new Player();
        this.input = new InputHandler(this.player);
        this.enemies = [];
        this.frameNumber = 0;

        // Create some enemy sequences to demo
        this.createEnemies();

        this.start();
    }

    createEnemies() {
        // Enemy 1: Purple - raise left arm only
        const enemy1Sequence = this.createSequence([
            { leftArmRaised: true, rightArmRaised: false, leftLegRaised: false, rightLegRaised: false, lampBlinking: false },
            { leftArmRaised: false, rightArmRaised: false, leftLegRaised: false, rightLegRaised: false, lampBlinking: false }
        ]);
        this.enemies.push(new Enemy(300, "#ff00ff", new MoveSequence(enemy1Sequence, "enemy1")));

        // Enemy 2: Orange - raise right leg only
        const enemy2Sequence = this.createSequence([
            { leftArmRaised: false, rightArmRaised: false, leftLegRaised: false, rightLegRaised: true, lampBlinking: false },
            { leftArmRaised: false, rightArmRaised: false, leftLegRaised: false, rightLegRaised: false, lampBlinking: false }
        ]);
        this.enemies.push(new Enemy(500, "#ff8800", new MoveSequence(enemy2Sequence, "enemy2")));

        // Enemy 3: Cyan - raise both arms
        const enemy3Sequence = this.createSequence([
            { leftArmRaised: true, rightArmRaised: true, leftLegRaised: false, rightLegRaised: false, lampBlinking: false },
            { leftArmRaised: false, rightArmRaised: false, leftLegRaised: false, rightLegRaised: false, lampBlinking: false }
        ]);
        this.enemies.push(new Enemy(650, "#00ffff", new MoveSequence(enemy3Sequence, "enemy3")));
    }

    createSequence(pattern) {
        // Repeat each state multiple times to create a longer animation
        const frames = [];
        for (let state of pattern) {
            for (let i = 0; i < 150; i++) {
                frames.push(JSON.parse(JSON.stringify(state)));
            }
        }
        return frames;
    }

    start() {
        this.gameLoop();
    }

    gameLoop = () => {
        this.update();
        this.render();
        requestAnimationFrame(this.gameLoop);
    }

    update() {
        this.player.update(this.input.getKeys());
        this.frameNumber++;
        this.player.frameCounter++;

        // Update all enemies
        for (let enemy of this.enemies) {
            enemy.update();
        }

        // Check similarity with all enemies using robust algorithm
        this.checkPlayerMatches();
    }

    checkPlayerMatches() {
        if (this.player.moveHistory.length < 5) return;

        const playerState = this.player.states;
        
        // Initialize matchers for all enemies if not already done
        for (let enemy of this.enemies) {
            if (!this.player.sequenceMatchers.has(enemy.moveSequence.id)) {
                this.player.sequenceMatchers.set(
                    enemy.moveSequence.id,
                    new SequenceMatcher(enemy.moveSequence.frames)
                );
            }
        }

        let bestEnemy = null;
        let bestMatchQuality = 0;

        // If we have a confirmed match, only update that enemy
        if (this.player.confirmedMatchEnemy) {
            const matcher = this.player.sequenceMatchers.get(this.player.confirmedMatchEnemy.moveSequence.id);
            const matched = matcher.updateMatch(playerState, this.player.frameCounter);
            if (matched) {
                matcher.advancePosition();
            }
            bestMatchQuality = matcher.getMatchQuality();
            bestEnemy = this.player.confirmedMatchEnemy;
        } else if (this.player.currentMatchingEnemy) {
            // Continue updating the enemy we're already tracking
            const matcher = this.player.sequenceMatchers.get(this.player.currentMatchingEnemy.moveSequence.id);
            const matched = matcher.updateMatch(playerState, this.player.frameCounter);
            if (matched) {
                matcher.advancePosition();
            }
            bestMatchQuality = matcher.getMatchQuality();
            bestEnemy = this.player.currentMatchingEnemy;
        } else {
            // No current match - search all enemies for a new starting point
            for (let enemy of this.enemies) {
                const matcher = this.player.sequenceMatchers.get(enemy.moveSequence.id);
                const startPos = matcher.findBestStartingPosition(playerState);
                
                if (startPos !== -1) {
                    // Found a potential match position
                    matcher.reset();
                    matcher.matchPosition = startPos;
                    const matched = matcher.updateMatch(playerState, this.player.frameCounter);
                    if (matched) {
                        matcher.advancePosition();
                    }
                    
                    const quality = matcher.getMatchQuality();
                    if (quality > bestMatchQuality) {
                        bestMatchQuality = quality;
                        bestEnemy = enemy;
                    }
                }
            }
        }

        // Handle state transitions
        if (this.player.confirmedMatchEnemy) {
            const matcher = this.player.sequenceMatchers.get(this.player.confirmedMatchEnemy.moveSequence.id);
            
            // Check if still matching confirmed enemy with good quality
            if (bestEnemy === this.player.confirmedMatchEnemy && bestMatchQuality > MATCHING_CONFIG.QUALITY_THRESHOLD_CONFIRM) {
                // Still matching - maintain color and reset grace period
                this.player.graceFrames = 0;
                this.player.morphToColor(this.player.confirmedMatchEnemy.bodyColor);
            } else {
                // Lost match - start grace period
                this.player.graceFrames++;
                
                if (this.player.graceFrames < this.player.gracePeriod) {
                    // Still in grace period, maintain color
                    this.player.morphToColor(this.player.confirmedMatchEnemy.bodyColor);
                } else {
                    // Grace period expired
                    this.player.confirmedMatchEnemy = null;
                    this.player.currentMatchingEnemy = null;
                    this.player.morphToColor(this.player.originalColor);
                    
                    // Reset all matchers
                    for (let matcher of this.player.sequenceMatchers.values()) {
                        matcher.reset();
                    }
                }
            }
        } else if (bestEnemy && bestMatchQuality > MATCHING_CONFIG.QUALITY_THRESHOLD_BUILD) {
            // Building progress toward a new match
            const matcher = this.player.sequenceMatchers.get(bestEnemy.moveSequence.id);
            
            if (matcher.cyclesCompleted > 0) {
                // Full cycle completed - confirm match
                this.player.confirmedMatchEnemy = bestEnemy;
                this.player.currentMatchingEnemy = bestEnemy;
                this.player.graceFrames = 0;
                this.player.morphToColor(bestEnemy.bodyColor);
            } else {
                // Still building - show progress with color
                this.player.currentMatchingEnemy = bestEnemy;
                this.player.morphToColor(bestEnemy.bodyColor);
            }
        } else {
            // No matching
            this.player.currentMatchingEnemy = null;
            this.player.morphToColor(this.player.originalColor);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw floor
        this.drawFloor();

        // Draw enemies
        for (let enemy of this.enemies) {
            enemy.render(this.ctx);
        }

        // Draw player
        this.player.render(this.ctx);

        // Draw similarity info
        this.drawDebugInfo();
    }

    drawDebugInfo() {
        this.ctx.fillStyle = "#fff";
        this.ctx.font = "12px Arial";
        
        const matchingEnemy = this.player.currentMatchingEnemy || this.player.confirmedMatchEnemy;
        const isConfirmed = this.player.confirmedMatchEnemy !== null;
        const gracePeriod = this.player.graceFrames < this.player.gracePeriod ? 
            `[Grace: ${this.player.gracePeriod - this.player.graceFrames}]` : "";
        
        let matcherQuality = 0;
        let matcherPos = 0;
        let matcherCycles = 0;
        if (matchingEnemy) {
            const matcher = this.player.sequenceMatchers.get(matchingEnemy.moveSequence.id);
            if (matcher) {
                matcherQuality = (matcher.getMatchQuality() * 100).toFixed(0);
                matcherPos = matcher.matchPosition;
                matcherCycles = matcher.cyclesCompleted;
            }
        }
        
        // Current player state for debugging
        const playerState = this.player.states;
        const playerActive = playerState.leftArmRaised || playerState.rightArmRaised || 
                            playerState.leftLegRaised || playerState.rightLegRaised;
        
        let info = `Matching: ${matchingEnemy ? "Yes" : "No"} | Quality: ${matcherQuality}% | Pos: ${matcherPos} | Cycles: ${matcherCycles}`;
        if (isConfirmed) {
            info += ` | ✓ CONFIRMED ${gracePeriod}`;
        }
        info += ` | Active: ${playerActive ? "Yes" : "No"}`;
        
        this.ctx.fillText(info, 10, 480);
        this.ctx.fillText(`History: ${this.player.moveHistory.length} frames`, 10, 495);
    }

    drawFloor() {
        this.ctx.strokeStyle = "#333";
        this.ctx.beginPath();
        this.ctx.moveTo(0, CONFIG.GROUND_Y);
        this.ctx.lineTo(this.canvas.width, CONFIG.GROUND_Y);
        this.ctx.stroke();
    }
}

// Initialize Game
window.addEventListener('DOMContentLoaded', () => {
    new Game('gameCanvas');
});
