const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const startBtn = document.getElementById("startBtn");
const gameContainer = document.getElementById("gameContainer");
const gameOverModal = document.getElementById("gameOverModal");
const finalScoreDisplay = document.getElementById("finalScore");

let gameRunning = false;
let score = 0;
let lives = 5;
let gameTime = 0;
let difficulty = "normal";
let theme = "pastel";
let animationId;
let highScore = localStorage.getItem("catGameHighScore") || 0;
let streak = 0;
let maxStreak = localStorage.getItem("catGameMaxStreak") || 0;
let level = 1;
let soundEnabled = true;
let musicEnabled = true;
let audioContext = null;

const keys = { left: false, right: false };
let particles = [];
let ambientParticles = [];
let powerUps = [];

// POOL DE PARTÍCULAS PARA 60FPS
const PARTICLE_MAX = 18;
const PARTICLE_POOL = [];

const themes = {
  pastel:
    "linear-gradient(135deg, #F8C8DC 0%, #EFCFD4 25%, #F5DCE0 50%, #FDEAF2 100%)",
  lavender: "linear-gradient(135deg, #E6D7E6 0%, #F0E6F0 50%, #F5F0F5 100%)",
  peach: "linear-gradient(135deg, #F5D8C4 0%, #F0E1D3 50%, #F8E9DB 100%)",
  mint: "linear-gradient(135deg, #D4F1E8 0%, #E8F5F1 50%, #F0F9F7 100%)",
};

const player = { x: 365, y: 530, width: 70, height: 70, speed: 8, dx: 0 };
const foodTypes = ["🍕", "🍩", "🍰", "🍦", "☕", "🥝", "🍓", "🧁", "🍪", "🍵"];
const powerUpTypes = [
  { emoji: "⭐", type: "shield", duration: 300 },
  { emoji: "🚀", type: "boost", duration: 200 },
  { emoji: "💜", type: "heal", duration: 0 },
];
let fallingFoods = [];

const catImage = new Image();
catImage.src = "assets/image.png";
let catImageLoaded = false;
catImage.onload = () => {
  catImageLoaded = true;
  console.log("✅ Imagen del gatito cargada");
};
catImage.onerror = () => {
  console.log("❌ Error - usando emoji");
  catImageLoaded = false;
};

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

class Food {
  constructor() {
    this.emoji = foodTypes[Math.floor(Math.random() * foodTypes.length)];
    this.x = Math.random() * (canvas.width - 40);
    this.y = -40;
    this.width = 40;
    this.height = 40;
    this.baseSpeed = 1.2 + Math.random() * 1.2;
    this.speed = this.baseSpeed;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.05;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x + 20, this.y + 20);
    ctx.rotate(this.rotation);
    ctx.font = "40px Arial";
    ctx.fillText(this.emoji, -20, 20);
    ctx.restore();
  }
  update() {
    let mul = 1 + Math.floor(gameTime / 300) * 0.15;
    if (difficulty === "easy") mul *= 0.6;
    if (difficulty === "hard") mul *= 1.5;
    if (difficulty === "crazy") mul *= 2.2;
    this.speed = this.baseSpeed * mul;
    this.y += this.speed;
    this.rotation += this.rotationSpeed;
  }
}

class PowerUp {
  constructor(x, y, powerUpData) {
    this.emoji = powerUpData.emoji;
    this.type = powerUpData.type;
    this.duration = powerUpData.duration;
    this.x = x;
    this.y = y;
    this.width = 35;
    this.height = 35;
    this.speed = 1.5;
    this.rotation = 0;
    this.pulse = 0;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x + 17.5, this.y + 17.5);
    ctx.rotate(this.rotation);
    this.pulse += 0.1;
    const scale = 1 + Math.sin(this.pulse) * 0.2;
    ctx.scale(scale, scale);
    ctx.font = "35px Arial";
    ctx.fillText(this.emoji, -17.5, 12);
    ctx.restore();
  }
  update() {
    this.y += this.speed;
    this.rotation += 0.05;
  }
}

// PARTÍCULA OPTIMIZADA - Sin save/restore, fade-in suave
class Particle {
  constructor() {
    this.reset(0, 0, "✨");
  }

  reset(x, y, emoji = "✨") {
    this.x = x;
    this.y = y;
    this.emoji = emoji;
    this.vx = (Math.random() - 0.5) * 2.6;
    this.vy = Math.random() * -2.2 - 0.8;
    this.age = 0;
    this.life = 26;
    this.fadeIn = 4;
    this.alpha = 0;
    return this;
  }

  update() {
    this.age++;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1;

    if (this.age <= this.fadeIn) {
      this.alpha = this.age / this.fadeIn;
    } else {
      const t = (this.age - this.fadeIn) / (this.life - this.fadeIn);
      this.alpha = 1 - t;
    }

    return this.age < this.life;
  }

  draw() {
    ctx.globalAlpha = this.alpha;
    ctx.fillText(this.emoji, this.x, this.y);
  }
}

function spawnParticle(x, y, emoji) {
  const p = (PARTICLE_POOL.length ? PARTICLE_POOL.pop() : new Particle()).reset(
    x,
    y,
    emoji
  );
  particles.push(p);

  if (particles.length > PARTICLE_MAX) {
    const old = particles.shift();
    if (PARTICLE_POOL.length < 60) PARTICLE_POOL.push(old);
  }
}

class AmbientParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 3 + 1;
    this.speed = Math.random() * 0.5 + 0.2;
    this.opacity = Math.random() * 0.5 + 0.2;
  }
  update() {
    this.y += this.speed;
    if (this.y > canvas.height) {
      this.y = 0;
      this.x = Math.random() * canvas.width;
    }
  }
  draw() {
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

let shieldActive = false;
let boostActive = false;
let shieldTimer = 0;
let boostTimer = 0;

function playSound(type = "collect") {
  if (!soundEnabled) return;
  try {
    const ac = initAudioContext();

    if (type === "collect") {
      const osc1 = ac.createOscillator();
      const gain1 = ac.createGain();
      osc1.connect(gain1);
      gain1.connect(ac.destination);
      osc1.frequency.value = 750;
      gain1.gain.setValueAtTime(0.15, ac.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.2);
      osc1.start(ac.currentTime);
      osc1.stop(ac.currentTime + 0.2);

      setTimeout(() => {
        const osc2 = ac.createOscillator();
        const gain2 = ac.createGain();
        osc2.connect(gain2);
        gain2.connect(ac.destination);
        osc2.frequency.value = 550;
        gain2.gain.setValueAtTime(0.12, ac.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.25);
        osc2.start(ac.currentTime);
        osc2.stop(ac.currentTime + 0.25);
      }, 120);
    } else if (type === "miss") {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.setValueAtTime(300, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.15);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.15);
    } else if (type === "gameOver") {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.setValueAtTime(450, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(380, ac.currentTime + 0.4);
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.4);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.4);
    } else if (type === "powerup") {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.setValueAtTime(1200, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(1500, ac.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.1);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.1);
    }
  } catch (e) {}
}

function playBackgroundMusic() {
  if (!musicEnabled || !audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.frequency.value = 200;
  gain.gain.setValueAtTime(0.02, now);
  gain.gain.setValueAtTime(0.02, now + 4);
  osc.start(now);
  osc.stop(now + 4);
}

function showAchievementNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #F3AACB, #EB9AC0);
    color: white;
    padding: 15px 25px;
    border-radius: 20px;
    z-index: 999;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(243, 170, 203, 0.5);
    animation: slideIn 0.4s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2500);
}

function drawPlayer() {
  ctx.save();

  if (shieldActive) {
    ctx.strokeStyle = "rgba(0, 255, 150, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x + 35, player.y + 35, 55, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (catImageLoaded) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.drawImage(catImage, player.x - 10, player.y - 10, 90, 90);
  } else {
    ctx.font = "55px Arial";
    ctx.fillText("🐱🎀", player.x, player.y + 70);
  }

  if (boostActive) {
    ctx.fillStyle = "rgba(255, 200, 0, 0.4)";
    ctx.fillRect(player.x - 15, player.y - 20, 100, 8);
  }

  ctx.restore();
}

function playIntroAnimation() {
  let intro = document.createElement("div");
  intro.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001;
    font-size: 60px;
    animation: fadeOut 3s ease forwards;
  `;
  intro.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 100px; margin-bottom: 20px; animation: bounce 1s ease infinite;">🐱</div>
      <div style="color: white; font-weight: bold; font-size: 30px;">¡Feliz Cumpleaños!</div>
      <div style="color: #F3AACB; font-size: 20px; margin-top: 10px;">Hecho con 💕 para ti</div>
    </div>
  `;
  document.body.appendChild(intro);
  setTimeout(() => intro.remove(), 3000);
}

function update() {
  if (!gameRunning) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  gameTime++;

  for (let i = 0; i < ambientParticles.length; i++) {
    ambientParticles[i].update();
    ambientParticles[i].draw();
  }

  if (shieldActive) {
    shieldTimer--;
    if (shieldTimer <= 0) shieldActive = false;
  }
  if (boostActive) {
    boostTimer--;
    if (boostTimer <= 0) boostActive = false;
  }

  const currentSpeed = boostActive ? player.speed * 1.5 : player.speed;
  player.dx = 0;
  if (keys.left) player.dx = -currentSpeed;
  if (keys.right) player.dx = currentSpeed;
  player.x += player.dx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width)
    player.x = canvas.width - player.width;

  drawPlayer();

  let rate = 0.012 + level * 0.002;
  if (difficulty === "easy") rate *= 0.6;
  if (difficulty === "hard") rate *= 1.8;
  if (difficulty === "crazy") rate *= 2.5;
  if (Math.random() < rate) fallingFoods.push(new Food());

  if (score % 50 === 0 && score > 0 && Math.random() < 0.05) {
    const powerUp =
      powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    powerUps.push(new PowerUp(Math.random() * canvas.width, -40, powerUp));
  }

  fallingFoods = fallingFoods.filter((f) => f.y < canvas.height + 50);
  powerUps = powerUps.filter((p) => p.y < canvas.height + 50);

  for (let i = fallingFoods.length - 1; i >= 0; i--) {
    fallingFoods[i].update();
    fallingFoods[i].draw();

    if (
      player.x < fallingFoods[i].x + fallingFoods[i].width &&
      player.x + player.width > fallingFoods[i].x &&
      player.y < fallingFoods[i].y + fallingFoods[i].height &&
      player.y + player.height > fallingFoods[i].y
    ) {
      score += 10;
      streak++;
      level = Math.floor(score / 100) + 1;
      scoreEl.textContent = score;

      if (streak === 5) showAchievementNotification("🔥 ¡5 seguidas!");
      if (streak === 10) showAchievementNotification("🔥🔥 ¡10 seguidas!");
      if (streak === 20)
        showAchievementNotification("🔥🔥🔥 ¡20 seguidas! ¡INCREÍBLE!");
      if (score % 100 === 0) showAchievementNotification(`📈 ¡Nivel ${level}!`);

      const px = player.x + 35;
      const py = player.y;
      spawnParticle(px, py, fallingFoods[i].emoji);
      spawnParticle(px, py, fallingFoods[i].emoji);
      spawnParticle(px, py, "💕");

      playSound("collect");
      fallingFoods.splice(i, 1);
      continue;
    }

    if (fallingFoods[i].y > canvas.height) {
      if (!shieldActive) {
        lives--;
        streak = 0;
      } else {
        shieldActive = false;
        showAchievementNotification("⭐ ¡Escudo usado!");
      }
      livesEl.textContent = lives;
      playSound("miss");
      fallingFoods.splice(i, 1);
      if (lives <= 0) {
        gameOver();
        return;
      }
    }
  }

  for (let i = powerUps.length - 1; i >= 0; i--) {
    powerUps[i].update();
    powerUps[i].draw();

    if (
      player.x < powerUps[i].x + powerUps[i].width &&
      player.x + player.width > powerUps[i].x &&
      player.y < powerUps[i].y + powerUps[i].height &&
      player.y + player.height > powerUps[i].y
    ) {
      if (powerUps[i].type === "shield") {
        shieldActive = true;
        shieldTimer = powerUps[i].duration;
        showAchievementNotification("⭐ ¡Escudo adquirido!");
      } else if (powerUps[i].type === "boost") {
        boostActive = true;
        boostTimer = powerUps[i].duration;
        showAchievementNotification("🚀 ¡Velocidad +!");
      } else if (powerUps[i].type === "heal") {
        lives = Math.min(lives + 1, 5);
        livesEl.textContent = lives;
        showAchievementNotification("💜 ¡+1 Vida!");
      }

      playSound("powerup");
      powerUps.splice(i, 1);
    }
  }

  // BATCH RENDER PARTÍCULAS (muy eficiente)
  ctx.font = "30px Arial";
  for (let i = particles.length - 1; i >= 0; i--) {
    const alive = particles[i].update();
    if (!alive) {
      const dead = particles.splice(i, 1)[0];
      if (PARTICLE_POOL.length < 60) PARTICLE_POOL.push(dead);
      continue;
    }
    particles[i].draw();
  }
  ctx.globalAlpha = 1;

  if (gameTime % 240 === 0 && musicEnabled) {
    playBackgroundMusic();
  }

  animationId = requestAnimationFrame(update);
}

function startGame() {
  gameRunning = true;
  score = 0;
  streak = 0;
  level = 1;
  lives = 5;
  gameTime = 0;
  fallingFoods = [];
  particles = [];
  powerUps = [];
  shieldActive = false;
  boostActive = false;

  ambientParticles = [];
  for (let i = 0; i < 10; i++) {
    ambientParticles.push(new AmbientParticle());
  }

  scoreEl.textContent = score;
  livesEl.textContent = lives;
  startBtn.style.display = "none";
  update();
}

function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationId);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("catGameHighScore", highScore);
  }

  if (streak > maxStreak) {
    maxStreak = streak;
    localStorage.setItem("catGameMaxStreak", maxStreak);
  }

  finalScoreDisplay.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">🎉 Puntuación: ${score} pts</h3>
    <p style="margin: 5px 0; font-size: 14px;">📈 Nivel alcanzado: ${level}</p>
    <p style="margin: 5px 0; font-size: 14px;">🔥 Racha: ${streak}</p>
    <p style="margin: 5px 0; font-size: 14px;">🏆 Record: ${highScore} pts</p>
    <p style="margin: 5px 0; font-size: 14px;">🔥 Mejor racha: ${maxStreak}</p>
  `;
  gameOverModal.classList.remove("hidden");
  playSound("gameOver");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "Left") {
    keys.left = true;
    e.preventDefault();
  }
  if (e.key === "ArrowRight" || e.key === "Right") {
    keys.right = true;
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "Left") keys.left = false;
  if (e.key === "ArrowRight" || e.key === "Right") keys.right = false;
});

startBtn.addEventListener("click", startGame);

document.getElementById("restartBtn").addEventListener("click", () => {
  gameOverModal.classList.add("hidden");
  startBtn.style.display = "block";
  startGame();
});

document.getElementById("fullscreenBtn").addEventListener("click", () => {
  gameContainer.requestFullscreen().catch(() => {});
});

document.getElementById("colorBtn").addEventListener("click", () => {
  const colors = [
    "board-color-1",
    "board-color-2",
    "board-color-3",
    "board-color-4",
  ];
  const current = Array.from(gameContainer.classList).find((c) =>
    c.includes("color")
  );
  gameContainer.classList.remove(current);
  const next = colors[(colors.indexOf(current) + 1) % colors.length];
  gameContainer.classList.add(next);
});

document.getElementById("difficulty").addEventListener("change", (e) => {
  difficulty = e.target.value;
});

document.getElementById("theme").addEventListener("change", (e) => {
  theme = e.target.value;
  document.body.style.background = themes[theme];
});

gameContainer.classList.add("board-color-1");

document.addEventListener("click", () => {
  initAudioContext();
});

window.addEventListener("load", () => {
  playIntroAnimation();
  console.log("🎮 ¡Juego OPTIMIZADO A 60FPS! 💛");
  console.log(`🏆 Tu mejor puntuación: ${highScore} pts`);
  console.log(`🔥 Tu mejor racha: ${maxStreak}`);
});
