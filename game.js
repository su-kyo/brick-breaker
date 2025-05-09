// 화면 요소
const mainScreen = document.getElementById('main-screen');
const gameScreen = document.getElementById('game-screen');
const gameoverModal = document.getElementById('gameover-modal');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const mainBtn = document.querySelectorAll('#main-btn');
const timeEl = document.getElementById('time');
const scoreEl = document.getElementById('score');
const lifeEl = document.getElementById('life');
const finalScoreEl = document.getElementById('final-score');
const scoreGradeEl = document.getElementById('score-grade');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const topRetryBtn = document.getElementById('top-retry-btn');
const topMainBtn = document.getElementById('top-main-btn');

// 게임 상태
let gameState = 'main'; // main, playing, gameover
let timer = 0;
let timerInterval = null;
let score = 0;
let life = 3;
let bricks = [];
let pad, ball;
let isBallLaunched = false;
let keyLeft = false, keyRight = false;
let ballSpeedMultiplier = 1;

// 벽돌 점수표
const brickScores = [100, 110, 120, 130, 140];
const brickColors = [
  '#fe888f', // var(--brick1)
  '#f79c07', // var(--brick2)
  '#ffcc01', // var(--brick3)
  '#25d0ae', // var(--brick4)
  '#4d73f9'  // var(--brick5)
];

// 패들/공/벽돌 기본값
const PAD_WIDTH = 160, PAD_HEIGHT = 24;
const BALL_RADIUS = 16;
const BRICK_ROWS = 5, BRICK_COLS = 10;
const BRICK_WIDTH = 68, BRICK_HEIGHT = 32, BRICK_GAP = 6;
let CANVAS_W = 800, CANVAS_H = 600;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const extraBrickColors = ['#4d73f9', '#25d0ae', '#ffcc01', '#f79c07', '#fe888f']; // 파랑-초록-노랑-주황-빨강
let extraRowCount = 0;

let padMaxWidthRatio = 0.32; // 최장 길이 비율(40%*0.8)
let padMinWidthRatio = 0.04; // 최소 4% (40%*0.1)
let padCurrentRatio = padMaxWidthRatio;
let padBlinking = false;
let padBlinkStart = 0;

let lastRowAddTime = 0;
let lastPadShrinkTime = 0;

function showScreen(screen) {
  mainScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  if (screen === 'main') mainScreen.classList.add('active');
  if (screen === 'game') gameScreen.classList.add('active');
}
function showModal(show) {
  if (show) gameoverModal.classList.add('active');
  else gameoverModal.classList.remove('active');
}

function resetGame() {
  timer = 0;
  score = 0;
  life = 3;
  isBallLaunched = false;
  updateUI();
  createBricks();
  createPadAndBall();
}

function updateUI() {
  timeEl.textContent = formatTime(timer);
  scoreEl.textContent = score;
  // 라이프 표시
  lifeEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'life-dot';
    dot.style.background = i < life ? 'var(--life-on)' : 'var(--life-off)';
    lifeEl.appendChild(dot);
  }
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  timerInterval = setInterval(() => {
    timer++;
    timeEl.textContent = formatTime(timer);
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
}

function resizeCanvas() {
  // 4:3 비율 유지, 최대 90vw, 70vh
  const parent = canvas.parentElement;
  let w = Math.min(window.innerWidth * 0.9, parent.offsetWidth || 800);
  let h = Math.min(window.innerHeight * 0.7, parent.offsetHeight || 600);
  if (w / h > 4/3) w = h * 4/3;
  else h = w * 3/4;
  w = Math.round(w); h = Math.round(h);
  // HiDPI(레티나) 대응: devicePixelRatio 적용
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  CANVAS_W = w;
  CANVAS_H = h;
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
  ctx.scale(dpr, dpr);
  // 패들/공/벽돌 위치 재계산
  createBricks();
  createPadAndBall();
  draw();
}
window.addEventListener('resize', resizeCanvas);

function getBrickLayout() {
  // 캔버스 크기에 맞춰 벽돌 크기/간격/여백 계산 (정상 상태로 복구)
  const paddingX = 24, paddingY = 24;
  const availableW = CANVAS_W - paddingX * 2;
  const availableH = Math.max(120, CANVAS_H * 0.35);
  let gap = Math.max(4, Math.floor(availableW * 0.01));
  let brickW = Math.floor((availableW - gap * (BRICK_COLS - 1)) / BRICK_COLS);
  let brickH = Math.floor((availableH - gap * (BRICK_ROWS - 1)) / BRICK_ROWS);
  // 중앙 정렬
  const totalW = brickW * BRICK_COLS + gap * (BRICK_COLS - 1);
  const totalH = brickH * BRICK_ROWS + gap * (BRICK_ROWS - 1);
  const offsetX = Math.round((CANVAS_W - totalW) / 2);
  const offsetY = Math.max(paddingY, Math.round((CANVAS_H * 0.12)));
  return { brickW, brickH, gap, offsetX, offsetY };
}

function createBricks() {
  bricks = [];
  const { brickW, brickH, gap, offsetX, offsetY } = getBrickLayout();
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      // 점수: 아랫줄이 100점, 윗줄이 140점
      const scoreIdx = BRICK_ROWS - 1 - row;
      bricks.push({
        x: offsetX + col * (brickW + gap),
        y: offsetY + row * (brickH + gap),
        w: brickW,
        h: brickH,
        color: brickColors[row],
        score: brickScores[scoreIdx],
        visible: true,
        brightness: 1
      });
    }
  }
}

function createPadAndBall() {
  // 패들/공 크기와 위치를 캔버스 크기에 맞게 비율로 계산
  const padW = Math.max(80, Math.round(CANVAS_W * padCurrentRatio));
  const padH = Math.max(16, Math.round(CANVAS_H * 0.04));
  pad = {
    x: (CANVAS_W - padW) / 2,
    y: CANVAS_H - padH - 32,
    w: padW,
    h: padH,
    speed: Math.max(6, Math.round(CANVAS_W / 120))
  };
  const ballR = Math.max(10, Math.round(Math.min(CANVAS_W, CANVAS_H) * 0.025));
  ball = {
    x: pad.x + pad.w / 2,
    y: pad.y - ballR,
    r: ballR,
    dx: 0,
    dy: 0
  };
  isBallLaunched = false;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPillRect(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI/2, Math.PI/2, false);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI/2, 3*Math.PI/2, false);
  ctx.closePath();
}

function brightenColor(hex, percent) {
  // hex to hsl, 밝기 증가
  let r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if(max===min){h=s=0;}else{
    let d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  l = Math.min(1, l + percent);
  // hsl to rgb
  let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  let p = 2 * l - q;
  function hue2rgb(p, q, t){
    if(t<0) t+=1;
    if(t>1) t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p;
  }
  r = Math.round(hue2rgb(p,q,h)*255);
  g = Math.round(hue2rgb(p,q,h+1/3)*255);
  b = Math.round(hue2rgb(p,q,h+2/3)*255);
  return `rgb(${r},${g},${b})`;
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  // 벽돌
  bricks.forEach(brick => {
    if (brick.visible) {
      ctx.save();
      ctx.globalAlpha = brick.brightness;
      ctx.fillStyle = brick.brightness > 1 ? brightenColor(brick.color, 0.05) : brick.color;
      drawRoundedRect(ctx, brick.x, brick.y, brick.w, brick.h, 8);
      ctx.fill();
      ctx.restore();
    }
  });
  // 패들
  ctx.save();
  if (padBlinking && ((performance.now() - padBlinkStart) % 200 < 100)) {
    ctx.globalAlpha = 0.3;
  } else {
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#30363c';
  drawPillRect(ctx, pad.x, pad.y, pad.w, pad.h);
  ctx.fill();
  ctx.restore();
  // 공
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    pad.x + pad.w / 2 + (isBallLaunched ? (ball.x - (pad.x + pad.w / 2)) : 0),
    pad.y - ball.r + (isBallLaunched ? (ball.y - (pad.y - ball.r)) : 0),
    ball.r, 0, Math.PI * 2
  );
  ctx.fillStyle = '#d63f72';
  ctx.fill();
  ctx.restore();
}

function update() {
  // 패들 이동
  if (keyLeft) pad.x -= pad.speed;
  if (keyRight) pad.x += pad.speed;
  pad.x = Math.max(0, Math.min(CANVAS_W - pad.w, pad.x));
  // 공 이동
  if (!isBallLaunched) {
    ball.x = pad.x + pad.w / 2;
    ball.y = pad.y - ball.r;
  } else {
    ball.x += ball.dx * ballSpeedMultiplier;
    ball.y += ball.dy * ballSpeedMultiplier;
    // 벽 충돌
    let hitSideWall = false;
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.dx *= -1;
      hitSideWall = true;
    }
    if (ball.x + ball.r > CANVAS_W) {
      ball.x = CANVAS_W - ball.r;
      ball.dx *= -1;
      hitSideWall = true;
    }
    if (ball.y - ball.r < 0) ball.dy *= -1;
    // 패들 충돌
    if (
      ball.y + ball.r > pad.y &&
      ball.x > pad.x && ball.x < pad.x + pad.w &&
      ball.dy > 0
    ) {
      // 반사각
      const hit = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2);
      ball.dx = hit * 7;
      ball.dy = -Math.abs(ball.dy);
    }
    // 벽돌 충돌
    for (let i = 0; i < bricks.length; i++) {
      const brick = bricks[i];
      if (brick.visible &&
        ball.x + ball.r > brick.x && ball.x - ball.r < brick.x + brick.w &&
        ball.y + ball.r > brick.y && ball.y - ball.r < brick.y + brick.h
      ) {
        brick.visible = false;
        brick.brightness = 1.05;
        score += brick.score;
        updateUI(); // 점수 실시간 반영
        // 충돌 방향
        const prevX = ball.x - ball.dx;
        const prevY = ball.y - ball.dy;
        let hitFromSide = false;
        if (
          prevX + ball.r <= brick.x || prevX - ball.r >= brick.x + brick.w
        ) {
          ball.dx *= -1;
          hitFromSide = true;
        }
        if (
          prevY + ball.r <= brick.y || prevY - ball.r >= brick.y + brick.h
        ) {
          ball.dy *= -1;
          if (!hitFromSide) break;
        }
        if (!hitFromSide) ball.dy *= -1;
        setTimeout(() => { brick.brightness = 1; }, 80);
        break; // 한 번에 하나만 부서지게
      }
    }
    // 벽돌과 벽 사이에 끼어서 떨리는 경우 처리
    if (hitSideWall && Math.abs(ball.dx) < 1e-2) {
      // 공을 바닥으로 떨어뜨림
      ball.dy = Math.abs(ball.dy);
      ball.dx = 0;
    }
    // 바닥에 떨어짐
    if (ball.y - ball.r > CANVAS_H) {
      life--;
      updateUI();
      if (life === 0) {
        endGame();
        return;
      }
      createPadAndBall();
    }
  }
  // 벽돌이 패드와 겹치거나 패드보다 아래로 내려오면 게임 오버
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i];
    if (brick.visible && brick.y + brick.h >= pad.y) {
      endGame();
      break;
    }
  }
}

function addBrickRow() {
  // 기존 벽돌 한 줄씩 아래로 이동, 맨 아래줄은 삭제하지 않음
  const { brickW, brickH, gap, offsetX, offsetY } = getBrickLayout();
  for (let i = 0; i < bricks.length; i++) {
    bricks[i].y += brickH + gap;
  }
  // 새 줄 추가 (맨 위)
  const colorIdx = extraRowCount % extraBrickColors.length;
  const extraScore = 100 + (extraRowCount + 1) * 10;
  for (let col = 0; col < BRICK_COLS; col++) {
    bricks.unshift({
      x: offsetX + col * (brickW + gap),
      y: offsetY,
      w: brickW,
      h: brickH,
      color: extraBrickColors[colorIdx],
      score: extraScore,
      visible: true,
      brightness: 1
    });
  }
  extraRowCount++;
}

function shrinkPad() {
  // 패들 길이 8%씩 줄이기, 최소 4%까지
  const prevRatio = padCurrentRatio;
  padCurrentRatio = Math.max(padMinWidthRatio, padCurrentRatio - 0.08);
  if (pad) {
    const newW = Math.max(80, Math.round(CANVAS_W * padCurrentRatio));
    pad.x = Math.max(0, Math.min(CANVAS_W - newW, pad.x + pad.w / 2 - newW / 2));
    pad.w = newW;
  }
  // 최소 길이에 도달하지 않았을 때만 깜빡임 효과
  if (padCurrentRatio > padMinWidthRatio) {
    padBlinking = true;
    padBlinkStart = performance.now();
    setTimeout(() => { padBlinking = false; }, 1000);
  }
  // 공 속도 0.1배 가속
  ballSpeedMultiplier += 0.1;
}

function gameLoop() {
  if (gameState !== 'playing') return;
  update();
  draw();
  // 15초마다 한 줄 추가
  if (timer > 0 && Math.floor(timer / 15) > lastRowAddTime) {
    addBrickRow();
    lastRowAddTime = Math.floor(timer / 15);
  }
  // 30초마다 패들 줄이기
  if (timer > 0 && Math.floor(timer / 30) > lastPadShrinkTime) {
    shrinkPad();
    lastPadShrinkTime = Math.floor(timer / 30);
  }
  requestAnimationFrame(gameLoop);
}

function startGame() {
  gameState = 'playing';
  showScreen('game');
  showModal(false);
  padCurrentRatio = padMaxWidthRatio; // 패들 길이 항상 초기화
  padBlinking = false;
  resetGame();
  updateUI();
  resizeCanvas();
  createPadAndBall(); // 패들 길이/위치 초기화
  draw();
  stopTimer(); // 기존 타이머 중복 방지
  startTimer();
  extraRowCount = 0;
  lastRowAddTime = 0;
  lastPadShrinkTime = 0;
  ballSpeedMultiplier = 1;
  requestAnimationFrame(gameLoop);
}

function endGame() {
  gameState = 'gameover';
  stopTimer();
  showModal(true);
  finalScoreEl.textContent = score;
  scoreGradeEl.textContent = getScoreGrade(score);
}

function getScoreGrade(score) {
  if (score <= 2000) return '다음엔 더 잘할 수 있어요!';
  if (score <= 5000) return '괜찮아요, 꽤 했어요!';
  if (score <= 9000) return '좋았어요!';
  if (score <= 12000) return '훌륭해요!';
  return '전설이네요!';
}

// 이벤트 바인딩
startBtn.onclick = startGame;
retryBtn.onclick = startGame;
mainBtn.forEach(btn => btn.onclick = () => {
  gameState = 'main';
  showScreen('main');
  showModal(false);
  stopTimer();
});
topRetryBtn.onclick = startGame;
topMainBtn.onclick = () => {
  gameState = 'main';
  showScreen('main');
  showModal(false);
  stopTimer();
};

document.addEventListener('keydown', e => {
  if (gameState !== 'playing') return;
  if (e.key === 'ArrowLeft') keyLeft = true;
  if (e.key === 'ArrowRight') keyRight = true;
  if (!isBallLaunched && (e.key === ' ' || e.key === 'ArrowUp')) {
    isBallLaunched = true;
    ball.dx = 0;
    ball.dy = -7;
  }
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') keyLeft = false;
  if (e.key === 'ArrowRight') keyRight = false;
});
// 마우스 패들 조작
canvas.addEventListener('mousemove', e => {
  if (gameState !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  pad.x = Math.max(0, Math.min(CANVAS_W - pad.w, mouseX - pad.w / 2));
  if (!isBallLaunched) {
    ball.x = pad.x + pad.w / 2;
  }
});
// 마우스 클릭으로 공 발사
canvas.addEventListener('click', () => {
  if (gameState === 'playing' && !isBallLaunched) {
    isBallLaunched = true;
    ball.dx = 0;
    ball.dy = -7;
  }
}); 