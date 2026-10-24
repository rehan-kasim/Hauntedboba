var LIGHT_RADIUS = 150;
var UV_RADIUS = 210;
var BATTERY_DRAIN = 2.2;
var UV_BATTERY_DRAIN = 5;
var BATTERY_RECHARGE = 9;
var STARTING_LIVES = 3;
var BEST_TIME_KEY = 'boba-best';

var ingredients = [
  { icon: '🍵', name: 'black tea' },
  { icon: '🥛', name: 'milk' },
  { icon: '🧊', name: 'ice' },
  { icon: '⚫', name: 'tapioca pearls' },
  { icon: '🕯️', name: 'ghost sugar' }
];

var drinkNames = [
  'Vampire Taro',
  "Witch's Brew Milk Tea",
  'Ghost Pearl Latte',
  'Midnight Matcha',
  'Grave Digger Brown Sugar'
];

var curseMessages = [
  'Your next pull request gets merged at 3am.',
  'Every pearl you drink whispers a bug you forgot to fix.',
  'You will find a missing semicolon. Tomorrow. In production.',
  'Your wifi works perfectly, but only when nobody is watching.',
  'The sugar level is correct. That is the scary part.'
];

var pageStyle = document.documentElement;
var shop = document.getElementById('shop');
var ghost = document.getElementById('ghost');
var toast = document.getElementById('toast');
var modal = document.getElementById('modal');

var screenWidth = innerWidth;
var screenHeight = innerHeight;

addEventListener('resize', function () {
  screenWidth = innerWidth;
  screenHeight = innerHeight;
});

var gameRunning = false;
var foundCount = 0;
var livesLeft = STARTING_LIVES;
var batteryLevel = 100;
var lightEnabled = true;
var uvEnabled = false;
var lightRadius = LIGHT_RADIUS;

var pointerX = screenWidth / 2;
var pointerY = screenHeight / 2;
var lightX = pointerX;
var lightY = pointerY;
var ghostX = 0;
var ghostY = 0;

var safeUntilTime = 0;
var gameStartTime = 0;
var lastFrameTime = 0;
var lastBeatTime = 0;
var playerName = 'Stranger';
var toastTimeout;
var audioContext = null;
var soundMuted = false;

function keepInRange(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function showToast(text) {
  toast.textContent = text;
  toast.style.opacity = 1;

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(function () {
    toast.style.opacity = 0;
  }, 1800);
}

function playTone(freq, len, type, vol) {
  if (!audioContext || soundMuted) return;

  var o = audioContext.createOscillator();
  var g = audioContext.createGain();

  o.type = type || 'sine';
  o.frequency.value = freq;

  g.gain.setValueAtTime(vol || 0.2, audioContext.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + len);

  o.connect(g);
  g.connect(audioContext.destination);

  o.start();
  o.stop(audioContext.currentTime + len);
}

function playHeartbeat(d, now) {
  if (d < 0.25) return;
  if (now - lastBeatTime < 1100 - d * 700) return;

  lastBeatTime = now;

  playTone(110, 0.12, 'sine', 0.5);

  setTimeout(function () {
    playTone(95, 0.15, 'sine', 0.4);
  }, 160);
}

function drawHud() {
  var slotText = '';

  for (var i = 0; i < ingredients.length; i++) {
    slotText += (i < foundCount ? ingredients[i].icon : '·') + ' ';
  }

  document.getElementById('slots').textContent = slotText;

  var lifeText = '';

  for (var j = 0; j < STARTING_LIVES; j++) {
    lifeText += j < livesLeft ? '🖤' : '🥀';
  }

  document.getElementById('lives').textContent = lifeText;
}

function drawBattery() {
  var bar = document.getElementById('bat');

  bar.style.width = batteryLevel + '%';
  bar.style.background = batteryLevel < 25 ? '#f43f5e' : '#c084fc';
}

function setFlashlight(on) {
  if (on && batteryLevel < 12) {
    showToast('battery too low, wait a bit');
    return;
  }

  lightEnabled = on;

  if (!on) uvEnabled = false;

  lightRadius = LIGHT_RADIUS;

  document.body.classList.toggle('off', !on);
  document.body.classList.toggle('uv', uvEnabled);

  document.getElementById('lightBtn').textContent = on ? 'LIGHT ON' : 'LIGHT OFF';
  document.getElementById('uvBtn').textContent = 'UV';
}

function setUvLight(on) {
  if (!lightEnabled) return;

  uvEnabled = on;
  lightRadius = on ? UV_RADIUS : LIGHT_RADIUS;

  document.body.classList.toggle('uv', on);
  document.getElementById('uvBtn').textContent = on ? 'UV ON' : 'UV';
}

function movePointer(e) {
  if (e.target.closest('button') || e.target.closest('input')) return;

  pointerX = e.clientX;
  pointerY = e.clientY;
}

addEventListener('pointermove', movePointer);
addEventListener('pointerdown', movePointer);

function placeIngredients() {
  var old = shop.querySelectorAll('.item');

  for (var k = 0; k < old.length; k++) {
    old[k].remove();
  }

  var spots = [];

  for (var i = 0; i < ingredients.length; i++) {
    var x, y, tries = 0, close;

    do {
      x = 8 + Math.random() * 80;
      y = 20 + Math.random() * 60;
      close = false;

      for (var j = 0; j < spots.length; j++) {
        if (Math.abs(spots[j][0] - x) < 16 &&
            Math.abs(spots[j][1] - y) < 14) {
          close = true;
        }
      }

      tries++;
    } while (close && tries < 50);

    spots.push([x, y]);

    var b = document.createElement('button');

    b.className = 'item';
    b.textContent = ingredients[i].icon;
    b.style.left = x + '%';
    b.style.top = y + '%';
    b.dataset.i = i;

    shop.appendChild(b);
  }
}

shop.addEventListener('click', function (e) {
  var b = e.target.closest('.item');

  if (!gameRunning || !b || b.classList.contains('got')) return;

  b.classList.add('got');

  foundCount++;
  batteryLevel = Math.min(100, batteryLevel + 12);

  showToast('found ' + ingredients[b.dataset.i].name);

  playTone(660, 0.15, 'triangle', 0.25);

  setTimeout(function () {
    playTone(880, 0.2, 'triangle', 0.25);
  }, 120);

  drawHud();

  if (foundCount === ingredients.length) {
    setTimeout(winGame, 600);
  }
});

function resetGhostPosition() {
  ghostX = lightX < screenWidth / 2 ? screenWidth - 30 : 30;
  ghostY = lightY < screenHeight / 2 ? screenHeight - 120 : 100;
}

function moveGhost(dt, now) {
  var dx = lightX - ghostX;
  var dy = lightY - ghostY;
  var d = Math.hypot(dx, dy) || 1;

  var scared = lightEnabled && d < lightRadius + 20;
  var speed = 55 + foundCount * 14;

  if (!lightEnabled) speed *= 1.6;

  if (scared) {
    ghostX -= (dx / d) * 240 * dt;
    ghostY -= (dy / d) * 240 * dt;
  } else {
    ghostX += (dx / d) * speed * dt;
    ghostY += (dy / d) * speed * dt;
  }

  ghostX = keepInRange(ghostX, 20, screenWidth - 20);
  ghostY = keepInRange(ghostY, 20, screenHeight - 20);

  ghost.style.transform = 'translate(' + (ghostX - 26) + 'px,' + (ghostY - 26) + 'px)';

  var danger = scared ? 0 : Math.max(0, 1 - d / 320);

  document.getElementById('danger').style.opacity = danger;

  playHeartbeat(danger, now);

  if (!scared && d < 30 && now > safeUntilTime) {
    handleGhostHit(now);
  }
}

function handleGhostHit(now) {
  livesLeft--;
  safeUntilTime = now + 2000;

  drawHud();
  playTone(140, 0.5, 'sawtooth', 0.35);

  if (navigator.vibrate) navigator.vibrate(250);

  var f = document.getElementById('flash');

  f.style.transition = 'none';
  f.style.opacity = 0.7;

  setTimeout(function () {
    f.style.transition = 'opacity 0.6s';
    f.style.opacity = 0;
  }, 50);

  if (livesLeft <= 0) {
    loseGame();
    return;
  }

  resetGhostPosition();
  showToast('she got you! ' + livesLeft + ' left');
}

function gameLoop(t) {
  requestAnimationFrame(gameLoop);

  var dt = Math.min((t - lastFrameTime) / 1000, 0.05);
  lastFrameTime = t;

  lightX += (pointerX - lightX) * 0.25;
  lightY += (pointerY - lightY) * 0.25;

  pageStyle.style.setProperty('--light-x', lightX + 'px');
  pageStyle.style.setProperty('--light-y', lightY + 'px');
  pageStyle.style.setProperty('--light-radius', lightRadius + 'px');

  if (!gameRunning) return;

  if (lightEnabled) {
    batteryLevel -= dt * (uvEnabled ? UV_BATTERY_DRAIN : BATTERY_DRAIN);
  } else {
    batteryLevel += dt * BATTERY_RECHARGE;
  }

  batteryLevel = keepInRange(batteryLevel, 0, 100);

  if (batteryLevel <= 0 && lightEnabled) {
    setFlashlight(false);
    showToast('battery dead!');
  }

  drawBattery();
  moveGhost(dt, t);
}

function startGame() {
  foundCount = 0;
  livesLeft = STARTING_LIVES;
  batteryLevel = 100;

  setFlashlight(true);
  setUvLight(false);

  placeIngredients();
  resetGhostPosition();

  drawHud();
  drawBattery();

  gameStartTime = performance.now();
  safeUntilTime = gameStartTime + 2500;
  gameRunning = true;
}

function showModal(icon, title, text, small, btn) {
  document.getElementById('mIcon').textContent = icon;
  document.getElementById('mTitle').textContent = title;
  document.getElementById('mText').textContent = text;
  document.getElementById('mSmall').textContent = small;
  document.getElementById('mBtn').textContent = btn;

  document.getElementById('danger').style.opacity = 0;
  modal.style.display = 'flex';
}

function winGame() {
  gameRunning = false;

  var time = (performance.now() - gameStartTime) / 1000;
  var best = null;

  try {
    best = parseFloat(localStorage.getItem(BEST_TIME_KEY));
  } catch (e) {
    console.log('couldnt read best time, starting fresh');
  }

  if (!best || time < best) {
    best = time;

    try {
      localStorage.setItem(BEST_TIME_KEY, time);
    } catch (e) {}
  }

  [523, 659, 784, 1047].forEach(function (f, i) {
    setTimeout(function () {
      playTone(f, 0.3, 'triangle', 0.25);
    }, i * 140);
  });

  showModal(
    '🧋',
    playerName + "'s " + pickRandom(drinkNames),
    pickRandom(curseMessages),
    'brewed in ' + time.toFixed(1) + 's, best ' + best.toFixed(1) + 's',
    'Brew another'
  );
}

function loseGame() {
  gameRunning = false;

  showModal(
    '👻',
    'The ghost got you',
    'Your boba was never found. The shop keeps your name now.',
    'you found ' + foundCount + ' of ' + ingredients.length,
    'Try again'
  );
}

document.getElementById('lightBtn').addEventListener('click', function () {
  if (gameRunning) setFlashlight(!lightEnabled);
});

document.getElementById('uvBtn').addEventListener('click', function () {
  if (gameRunning) setUvLight(!uvEnabled);
});

document.getElementById('muteBtn').addEventListener('click', function () {
  soundMuted = !soundMuted;
  this.textContent = soundMuted ? '🔇' : '🔊';
});

document.getElementById('mBtn').addEventListener('click', function () {
  modal.style.display = 'none';
  startGame();
});

document.getElementById('start').addEventListener('click', function () {
  playerName = document.getElementById('who').value.trim() || 'Stranger';

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {}

  document.getElementById('intro').style.display = 'none';
  startGame();
});

addEventListener('keydown', function (e) {
  if (!gameRunning) return;

  if (e.key === 'f') setFlashlight(!lightEnabled);
  if (e.key === 'u') setUvLight(!uvEnabled);
});

drawHud();
requestAnimationFrame(gameLoop);