/**
 * Bit-Masker: Neon Logic Game
 * A puzzle game about bitwise operations
 */

// --- Game Configuration ---
const CONFIG = {
    bitCount: 4,
    targetValue: 15, // 1111 in binary
    rowSpawnRate: 4000, // milliseconds - starts slower
    rowSpeed: 0.2, // pixels per frame - starts slower
    maskZone: 120, // Y-coordinate threshold for game over
    difficulty: 0, // Track game progression
    maxDifficulty: 10, // Difficulty cap
};

// --- Game State Management ---
class GameState {
    constructor() {
        this.reset();
        this.operator = 'XOR';
    }

    reset() {
        this.mask = 0;
        this.rows = [];
        this.score = 0;
        this.gameOver = false;
        this.lastSpawn = -CONFIG.rowSpawnRate;
        this.flash = 0;
        this.matchPulse = 0; // Visual pulse when pattern matches
    }

    toggleBit(bitIndex) {
        this.mask ^= (1 << bitIndex);
    }

    applyOperator(value) {
        switch (this.operator) {
            case 'XOR': return value ^ this.mask;
            case 'OR':  return value | this.mask;
            case 'AND': return value & this.mask;
            default: return value;
        }
    }
}

// --- Input Handler ---
class InputHandler {
    constructor(gameState, onResolveMatch, onRestart) {
        this.gameState = gameState;
        this.onResolveMatch = onResolveMatch;
        this.onRestart = onRestart;
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleKeyDown(e) {
        if (this.gameState.gameOver) {
            if (e.code === 'Space') this.onRestart?.();
            return;
        }

        // Bit toggles
        if (e.key === '1') this.gameState.toggleBit(3);
        if (e.key === '2') this.gameState.toggleBit(2);
        if (e.key === '3') this.gameState.toggleBit(1);
        if (e.key === '4') this.gameState.toggleBit(0);

        // Operator switches
        if (e.key.toLowerCase() === 'z') this.gameState.operator = 'XOR';
        if (e.key.toLowerCase() === 'x') this.gameState.operator = 'OR';
        if (e.key.toLowerCase() === 'c') this.gameState.operator = 'AND';

        // Execute move
        if (e.code === 'Space') this.onResolveMatch?.();
    }
}

// --- Game Logic ---
class GameLogic {
    constructor(gameState, canvasHeight) {
        this.gameState = gameState;
        this.canvasHeight = canvasHeight;
    }

    spawnRow() {
        // Generate random 4-bit value (1-14, avoiding 0 and 15)
        const value = Math.floor(Math.random() * 14) + 1;
        this.gameState.rows.push({ value, y: this.canvasHeight + 20 });
    }

    resolveMatch() {
        if (this.gameState.rows.length === 0) return;

        // Find closest row to mask zone
        const closestIdx = this.gameState.rows.reduce((minIdx, row, idx) => {
            return row.y < this.gameState.rows[minIdx].y ? idx : minIdx;
        }, 0);

        const targetRow = this.gameState.rows[closestIdx];
        const result = this.gameState.applyOperator(targetRow.value);

        if (result === CONFIG.targetValue) {
            this.gameState.score += 100;
            this.gameState.rows.splice(closestIdx, 1);
            this.gameState.matchPulse = 10;
            
            // Increase difficulty gradually
            CONFIG.difficulty = Math.min(CONFIG.maxDifficulty, CONFIG.difficulty + 0.5);
            const speedMultiplier = 1 + (CONFIG.difficulty / CONFIG.maxDifficulty) * 1.5;
            CONFIG.rowSpeed = 0.2 * speedMultiplier;
            CONFIG.rowSpawnRate = Math.max(1500, 4000 - CONFIG.difficulty * 200);
        } else {
            this.gameState.flash = -5;
            this.gameState.matchPulse = 0
            this.gameState.flash = -5;
        }
    }

    update() {
        if (this.gameState.gameOver) return;

        const now = performance.now();

        // Spawn new rows
        if (now - this.gameState.lastSpawn > CONFIG.rowSpawnRate) {
            this.spawnRow();
            this.gameState.lastSpawn = now;
        }

        // Move rows up
        this.gameState.rows.forEach(row => {
            row.y -= CONFIG.rowSpeed;
            if (row.y < CONFIG.maskZone) {
                this.gameState.gameOver = true;
            }
        });
    }
}

// --- Rendering ---
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.setupFont();
    }

    setupFont() {
        this.ctx.font = '16px Courier New';
        this.ctx.textBaseline = 'top';
    }

    drawBulbs(value, x, y, size, color) {
        for (let i = 0; i < CONFIG.bitCount; i++) {
            const isSet = (value >> (CONFIG.bitCount - 1 - i)) & 1;
            const bx = x + i * (size + 10);

            this.ctx.beginPath();
            this.ctx.arc(bx, y, size / 2, 0, Math.PI * 2);

            if (isSet) {
                this.ctx.fillStyle = color;
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = color;
                this.ctx.fill();
            } else {
                this.ctx.strokeStyle = '#444';
                this.ctx.shadowBlur = 0;
                this.ctx.stroke();
            }
            this.ctx.shadowBlur = 0;
        }
    }

    drawFlash(gameState) {
        if (gameState.flash > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${gameState.flash / 10})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            gameState.flash--;
        } else if (gameState.flash < 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(gameState.flash) / 5})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            gameState.flash++;
        }
    }

    drawMatchIndicator(gameState) {
        // Draw pulsing green border on mask zone when pattern matches
        if (gameState.rows.length > 0) {
            const closestRow = gameState.rows.reduce((min, row) => 
                row.y < min.y ? row : min
            );
            
            const result = gameState.applyOperator(closestRow.value);
            if (result === CONFIG.targetValue) {
                const pulseAlpha = 0.5 + Math.sin(gameState.matchPulse) * 0.3;
                this.ctx.strokeStyle = `rgba(0, 255, 100, ${pulseAlpha})`;
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = `rgba(0, 255, 255, ${pulseAlpha})`;
                this.ctx.shadowBlur = 15;
                this.ctx.strokeRect(100, 115, 200, 30);
                this.ctx.shadowBlur = 0;
                
                this.ctx.fillStyle = `rgba(0, 255, 255, ${pulseAlpha * 0.3})`;
                this.ctx.fillRect(100, 115, 200, 30);
                
                // Draw "Space" text under the user's mask when pattern matches
                this.ctx.fillStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
                this.ctx.font = 'bold 16px Courier New';
                this.ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
                this.ctx.shadowBlur = 15;
                this.ctx.fillText('Space', 150, 122);
                this.ctx.shadowBlur = 0;
                this.ctx.font = '16px Courier New';
                
                gameState.matchPulse += 0.15;
            }
        }
    }

    drawUI(gameState) {
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.fillText(`SCORE: ${gameState.score}`, 20, 30);
        this.ctx.fillText(`OP: ${gameState.operator}`, 300, 30);

        this.ctx.fillStyle = '#555';
        this.ctx.fillText('YOUR MASK', 160, 60);
        this.drawBulbs(gameState.mask, 130, 90, 30, '#00f2ff');

        this.ctx.strokeStyle = '#333';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 130);
        this.ctx.lineTo(this.canvas.width, 130);
        this.ctx.stroke();
    }

    drawRows(gameState) {
        gameState.rows.forEach(row => {
            this.drawBulbs(row.value, 150, row.y, 20, '#ff00ff');
        });
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = '30px Courier New';
        this.ctx.fillText('SYSTEM CRASH', 90, 300);
        this.ctx.font = '16px Courier New';
        this.ctx.fillText('Press Space to play again', 80, 330);
    }   

    render(gameState) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawFlash(gameState);
        this.drawUI(gameState);
        this.drawRows(gameState);
        this.drawMatchIndicator(gameState);

        if (gameState.gameOver) {
            this.drawGameOver();
        }
    }
}

// --- Game Loop ---
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.gameState = new GameState();
        this.gameLogic = new GameLogic(this.gameState, canvas.height);
        this.renderer = new Renderer(canvas);
        this.input = new InputHandler(
            this.gameState,
            () => this.gameLogic.resolveMatch(),
            () => this.restart()
        );
    }

    restart() {
        this.gameState.reset();
        this.gameLogic = new GameLogic(this.gameState, this.canvas.height);
    }

    start() {
        const loop = () => {
            this.gameLogic.update();
            this.renderer.render(this.gameState);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

// --- Initialize Game ---
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    game.start();
});
