/* ══════════════════════════════════════════════════════════════════════════════
   ENGLISH QUIZ — client.js
   Socket.io client + complete UI logic
══════════════════════════════════════════════════════════════════════════════ */

// ── Socket connection ─────────────────────────────────────────────────────────
const socket = io();

// ── App State ─────────────────────────────────────────────────────────────────
const state = {
  roomCode: null,
  myId: null,
  myPseudo: null,
  isHost: false,
  players: [],
  currentQuestion: null,
  timerInterval: null,
  timerDuration: 60,
  pendingValidations: {},  // { playerId: null | true | false }
  previousView: null,
  sheetsData: null
};

// ── View Management ───────────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
  state.previousView = id;
}

// ── Toast Notification ────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.classList.remove('show'); }, duration);
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer(duration, displayId, barId, onEnd) {
  clearInterval(state.timerInterval);
  const timerEl  = document.getElementById(displayId);
  const barEl    = document.getElementById(barId);
  let remaining  = duration;

  function tick() {
    remaining = Math.max(0, remaining - 1);
    if (timerEl) {
      timerEl.textContent = remaining;
      timerEl.classList.toggle('urgent', remaining <= 10);
    }
    if (barEl) {
      const pct = (remaining / duration) * 100;
      barEl.style.width = pct + '%';
      barEl.classList.toggle('low', remaining <= 10);
    }
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      if (onEnd) onEnd();
    }
  }

  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
}

// ── Players List Rendering ────────────────────────────────────────────────────
function renderPlayersList(players, containerId) {
  const ul = document.getElementById(containerId);
  if (!ul) return;
  ul.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${p.isHost ? '👑' : '🎮'}</span>
      <span>${escHtml(p.pseudo)}</span>
      ${p.isHost ? '<span class="host-badge">HÔTE</span>' : `<span class="score-badge">${p.score} pts</span>`}
    `;
    ul.appendChild(li);
  });
  const count = document.getElementById('lobby-player-count');
  if (count) count.textContent = `(${players.length})`;
}

function renderScoreBar(players, containerId) {
  const bar = document.getElementById(containerId);
  if (!bar) return;
  bar.innerHTML = players
    .sort((a, b) => b.score - a.score)
    .map(p => `<div class="score-pill"><span class="sp-name">${escHtml(p.pseudo)}</span><span class="sp-score">${p.score}</span></div>`)
    .join('');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── HOME — Create Room ────────────────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  const pseudo = document.getElementById('host-pseudo').value.trim();
  if (!pseudo) { showToast('Entre ton pseudo !', 'error'); return; }
  socket.emit('create-room', { pseudo });
});

document.getElementById('host-pseudo').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-create').click();
});

// ── HOME — Join Room ──────────────────────────────────────────────────────────
document.getElementById('btn-join').addEventListener('click', () => {
  const pseudo = document.getElementById('join-pseudo').value.trim();
  const code   = document.getElementById('join-code').value.trim().toUpperCase();
  const errEl  = document.getElementById('join-error');
  errEl.textContent = '';
  if (!pseudo) { errEl.textContent = 'Entre ton pseudo !'; return; }
  if (code.length !== 4) { errEl.textContent = 'Le code doit faire 4 caractères.'; return; }
  socket.emit('join-room', { code, pseudo });
});

document.getElementById('join-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

document.getElementById('join-code').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

// ── LOBBY HOST — Copy code ────────────────────────────────────────────────────
document.getElementById('btn-copy-code').addEventListener('click', () => {
  const code = document.getElementById('display-room-code').textContent;
  navigator.clipboard.writeText(code).then(() => showToast('Code copié !', 'success')).catch(() => {
    showToast(`Code : ${code}`, 'info');
  });
});

// ── LOBBY HOST — Config changes ───────────────────────────────────────────────
document.getElementById('select-category').addEventListener('change', e => {
  socket.emit('update-config', { code: state.roomCode, config: { category: e.target.value } });
  const gameCat = document.getElementById('game-category');
  if (gameCat) gameCat.value = e.target.value;
});

document.getElementById('select-duration').addEventListener('change', e => {
  socket.emit('update-config', { code: state.roomCode, config: { duration: parseInt(e.target.value) } });
  state.timerDuration = parseInt(e.target.value);
});

// ── LOBBY HOST — Start Game ───────────────────────────────────────────────────
document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('start-game', { code: state.roomCode });
});

// ── HOST DASHBOARD — Generate Question ───────────────────────────────────────
document.getElementById('btn-generate-question').addEventListener('click', () => {
  const cat = document.getElementById('game-category').value;
  socket.emit('generate-question', { code: state.roomCode, category: cat });
});

// ── HOST DASHBOARD — Send Question ───────────────────────────────────────────
document.getElementById('btn-send-question').addEventListener('click', () => {
  const question    = document.getElementById('input-question').value.trim();
  const answer      = document.getElementById('input-answer').value.trim();
  const hint        = document.getElementById('input-hint').value.trim();
  const explanation = document.getElementById('input-explanation').value.trim();

  if (!question) { showToast('La question est vide !', 'error'); return; }
  if (!answer)   { showToast('La réponse correcte est vide !', 'error'); return; }

  state.currentQuestion = { question, answer, hint, explanation };
  state.pendingValidations = {};

  socket.emit('send-question', { code: state.roomCode, question, answer, hint, explanation });

  // Switch to answers monitoring UI
  document.getElementById('host-answers-panel').classList.remove('hidden');
  document.getElementById('host-review-panel').classList.add('hidden');
  document.getElementById('answers-live-list').innerHTML = '';

  const nonHostCount = state.players.filter(p => !p.isHost).length;
  document.getElementById('answers-total').textContent = nonHostCount;
  document.getElementById('answers-count').querySelector('span').textContent = `(0/${nonHostCount})`;

  // Start host timer (visual only)
  startTimer(state.timerDuration, 'host-timer-display', 'host-timer-bar', () => {
    showToast('⏱️ Temps écoulé !', 'info');
  });

  // Clear form
  document.getElementById('input-question').value   = '';
  document.getElementById('input-answer').value     = '';
  document.getElementById('input-hint').value       = '';
  document.getElementById('input-explanation').value = '';
});

// ── HOST DASHBOARD — Validate Answers ─────────────────────────────────────────
document.getElementById('btn-validate').addEventListener('click', () => {
  const validations = Object.entries(state.pendingValidations)
    .filter(([, v]) => v !== null)
    .map(([playerId, correct]) => ({ playerId, correct }));

  if (validations.length === 0) {
    showToast('Valide ou refuse au moins une réponse !', 'error');
    return;
  }

  socket.emit('validate-answers', { code: state.roomCode, validations });
});

// ── HOST DASHBOARD — End Game ─────────────────────────────────────────────────
document.getElementById('btn-end-game').addEventListener('click', () => {
  if (confirm('Terminer la partie et afficher le podium ?')) {
    socket.emit('end-game', { code: state.roomCode });
  }
});

// ── PLAYER — Submit Answer ────────────────────────────────────────────────────
document.getElementById('btn-submit-answer').addEventListener('click', submitPlayerAnswer);

document.getElementById('player-answer-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitPlayerAnswer();
});

function submitPlayerAnswer() {
  const answer = document.getElementById('player-answer-input').value.trim();
  if (!answer) { showToast('Tape ta réponse !', 'error'); return; }

  socket.emit('submit-answer', { code: state.roomCode, answer });

  // Show "sent" state
  document.getElementById('answer-form').classList.add('hidden');
  document.getElementById('answer-sent-state').classList.remove('hidden');
  document.getElementById('sent-answer-display').textContent = `"${answer}"`;
  stopTimer();
}

// ── SCORES VIEW — Next Question (host) ───────────────────────────────────────
// Rendered dynamically

// ── FINAL VIEW — Play Again ───────────────────────────────────────────────────
document.getElementById('btn-play-again').addEventListener('click', () => {
  // Go back to lobby-host if host, else home
  if (state.isHost) {
    showView('view-lobby-host');
    socket.emit('update-config', { code: state.roomCode, config: {} }); // keep room alive
  } else {
    location.reload(); // simplest: refresh for players
  }
});

// ── SHEETS NAV ────────────────────────────────────────────────────────────────
document.getElementById('btn-open-sheets').addEventListener('click', () => {
  loadSheetsData();
  showView('view-sheets');
});

document.getElementById('btn-close-sheets').addEventListener('click', () => {
  if (state.previousView && state.previousView !== 'view-sheets') {
    showView(state.previousView);
  } else {
    showView('view-home');
  }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.classList.add('hidden'); });
    btn.classList.add('active');
    const content = document.getElementById(`tab-${tab}`);
    if (content) { content.classList.add('active'); content.classList.remove('hidden'); }
  });
});

// Verb search
document.getElementById('verb-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#verbs-table-body tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ── Load Sheets Data via fetch ────────────────────────────────────────────────
async function loadSheetsData() {
  if (state.sheetsData) return; // already loaded

  try {
    const [verbs, vocab, grammar, traps] = await Promise.all([
      fetch('/data/irregular_verbs.json').then(r => r.json()),
      fetch('/data/vocabulary.json').then(r => r.json()),
      fetch('/data/grammar.json').then(r => r.json()),
      fetch('/data/traps.json').then(r => r.json())
    ]);
    state.sheetsData = { verbs, vocab, grammar, traps };
    renderVerbsTable(verbs);
    renderVocabTab(vocab);
    renderGrammarTab(grammar);
    renderTrapsTab(traps);
  } catch (err) {
    showToast('Erreur de chargement des fiches.', 'error');
  }
}

function renderVerbsTable(verbs) {
  const tbody = document.getElementById('verbs-table-body');
  tbody.innerHTML = verbs.map(v => `
    <tr>
      <td><strong>${escHtml(v.infinitive)}</strong></td>
      <td>${escHtml(v.past)}</td>
      <td>${escHtml(v.participle)}</td>
      <td>${escHtml(v.fr)}</td>
    </tr>
  `).join('');
}

function renderVocabTab(vocab) {
  const container = document.getElementById('vocab-categories');
  container.innerHTML = '';
  const catLabels = {
    general: '🌍 Général',
    professions: '💼 Métiers',
    science_nature: '🔬 Sciences & Nature',
    society_politics: '🏛️ Société & Politique',
    technology: '💻 Technologie'
  };
  Object.entries(vocab.categories).forEach(([key, words]) => {
    const div = document.createElement('div');
    div.className = 'vocab-cat';
    div.innerHTML = `
      <div class="vocab-cat-title">${catLabels[key] || key}</div>
      <div class="vocab-grid">
        ${words.map(w => `
          <div class="vocab-word-card" title="${escHtml(w.example || '')}">
            <div class="vw-en">${escHtml(w.word)}</div>
            <div class="vw-fr">${escHtml(w.fr)}</div>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(div);
  });
}

function renderGrammarTab(grammar) {
  const container = document.getElementById('grammar-sheets-content');
  container.innerHTML = '';

  // Render sheets
  grammar.sheets.forEach(sheet => {
    const div = document.createElement('div');
    div.className = 'grammar-sheet';

    let content = `
      <div class="grammar-sheet-title">
        <div class="dot" style="background:${sheet.color}"></div>
        ${escHtml(sheet.title)}
      </div>
    `;

    if (sheet.formula) {
      content += `<div class="formula-box">${escHtml(sheet.formula)}</div>`;
    }
    if (sheet.usage) {
      content += `<ul class="usage-list">${sheet.usage.map(u => `<li>${escHtml(u)}</li>`).join('')}</ul>`;
    }
    if (sheet.keywords) {
      content += `<div class="keywords-row">${sheet.keywords.map(k => `<span class="keyword-badge">${escHtml(k)}</span>`).join('')}</div>`;
    }
    if (sheet.examples) {
      content += `<div class="example-list">${sheet.examples.map(ex => `
        <div class="example-item">
          <div class="ex-en">▶ ${escHtml(ex.en)}</div>
          <div class="ex-fr">${escHtml(ex.fr)}</div>
        </div>
      `).join('')}</div>`;
    }
    if (sheet.rules) {
      sheet.rules.forEach(rule => {
        content += `
          <div style="margin-bottom:0.75rem">
            <div style="font-weight:700;color:var(--warning);margin-bottom:0.3rem">${escHtml(rule.form || rule.tense)}</div>
            <div style="font-size:0.9rem;margin-bottom:0.3rem">${escHtml(rule.meaning || rule.when)}</div>
            ${rule.signals ? `<div class="keywords-row">${rule.signals.map(s=>`<span class="keyword-badge">${escHtml(s)}</span>`).join('')}</div>` : ''}
            <div class="example-item"><div class="ex-en">▶ ${escHtml(rule.example_en)}</div><div class="ex-fr">${escHtml(rule.example_fr)}</div></div>
          </div>
        `;
      });
    }
    if (sheet.comparison) {
      content += `
        <table class="comparison-table">
          <thead><tr><th>Past Simple</th><th>Present Perfect</th></tr></thead>
          <tbody>
            ${sheet.comparison.map(c => `<tr><td>${escHtml(c.past_simple)}</td><td>${escHtml(c.present_perfect)}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
    }
    if (sheet.negative) content += `<div style="margin-top:0.5rem;font-size:0.85rem;color:var(--danger)">Négation : <strong>${escHtml(sheet.negative)}</strong></div>`;
    if (sheet.question) content += `<div style="font-size:0.85rem;color:var(--accent2)">Question : <strong>${escHtml(sheet.question)}</strong></div>`;

    div.innerHTML = content;
    container.appendChild(div);
  });
}

function renderTrapsTab(traps) {
  const container = document.getElementById('traps-content');
  container.innerHTML = traps.map(t => `
    <div class="trap-card">
      <div class="trap-rule">⚠️ ${escHtml(t.rule)}</div>
      <div class="trap-wrong">❌ ${escHtml(t.wrong)}</div>
      <div class="trap-correct">✅ ${escHtml(t.correct)}</div>
      <div class="trap-explain">${escHtml(t.explanation)}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
//  SOCKET.IO EVENT HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

socket.on('connect', () => {
  state.myId = socket.id;
  console.log('Connected:', socket.id);
});

// ── Room Created ──────────────────────────────────────────────────────────────
socket.on('room-created', ({ code, player }) => {
  state.roomCode  = code;
  state.myPseudo  = player.pseudo;
  state.isHost    = true;
  state.players   = [player];

  document.getElementById('display-room-code').textContent = code;
  renderPlayersList(state.players, 'lobby-players-list');
  showView('view-lobby-host');
  showToast(`Salon créé ! Code : ${code}`, 'success');
});

// ── Room Joined ───────────────────────────────────────────────────────────────
socket.on('room-joined', ({ code, player, players }) => {
  state.roomCode = code;
  state.myPseudo = player.pseudo;
  state.isHost   = false;
  state.players  = players;

  document.getElementById('display-room-code-player').textContent = code;
  renderPlayersList(players, 'waiting-players-list');
  showView('view-lobby-player');
  showToast(`Bienvenue dans le salon ${code} !`, 'success');
});

socket.on('join-error', ({ message }) => {
  document.getElementById('join-error').textContent = message;
  showToast(message, 'error');
});

// ── Player Joined/Left ────────────────────────────────────────────────────────
socket.on('player-joined', ({ players }) => {
  state.players = players;
  renderPlayersList(players, 'lobby-players-list');
  renderPlayersList(players, 'waiting-players-list');
  const newcomer = players[players.length - 1];
  showToast(`👋 ${newcomer.pseudo} a rejoint !`, 'info');
});

socket.on('player-left', ({ players }) => {
  state.players = players;
  renderPlayersList(players, 'lobby-players-list');
  renderPlayersList(players, 'waiting-players-list');
});

// ── Config Updated ────────────────────────────────────────────────────────────
socket.on('config-updated', (config) => {
  state.timerDuration = config.duration || 60;
});

// ── Game Started ──────────────────────────────────────────────────────────────
socket.on('game-started', ({ config, players }) => {
  state.players = players;
  state.timerDuration = config.duration;

  if (state.isHost) {
    // Sync category selector
    document.getElementById('game-category').value = config.category;
    // Reset host dashboard
    document.getElementById('host-answers-panel').classList.add('hidden');
    document.getElementById('host-review-panel').classList.add('hidden');
    renderScoreBar(players, 'host-score-bar');
    showView('view-host-dashboard');
    showToast('La partie commence ! Envoie une question.', 'success');
  } else {
    // Show player answer view in waiting state
    document.getElementById('player-waiting-state').classList.remove('hidden');
    document.getElementById('player-question-state').classList.add('hidden');
    document.getElementById('player-review-state').classList.add('hidden');
    document.getElementById('player-view-title').textContent = 'En attente d\'une question…';
    renderScoreBar(players, 'player-score-bar');
    showView('view-player-answer');
    showToast('La partie a commencé !', 'success');
  }
});

// ── Question Generated (host only) ───────────────────────────────────────────
socket.on('question-generated', ({ question, answer, hint, explanation }) => {
  // Render HTML in question (unescape intentionally safe tags like <strong>, <em>)
  document.getElementById('input-question').value   = question.replace(/<[^>]*>/g, '');
  document.getElementById('input-answer').value     = answer || '';
  document.getElementById('input-hint').value       = hint || '';
  document.getElementById('input-explanation').value = explanation || '';
  showToast('Question générée !', 'success');
});

// ── New Question (players) ────────────────────────────────────────────────────
socket.on('new-question', ({ question, hint, duration, startTime }) => {
  state.timerDuration = duration;

  // Switch to question active state
  document.getElementById('player-waiting-state').classList.add('hidden');
  document.getElementById('player-question-state').classList.remove('hidden');
  document.getElementById('player-review-state').classList.add('hidden');

  // Reset answer form
  document.getElementById('answer-form').classList.remove('hidden');
  document.getElementById('answer-sent-state').classList.add('hidden');
  document.getElementById('player-answer-input').value = '';

  // Render question (safe HTML rendering for bold/italic)
  document.getElementById('player-question-text').innerHTML = renderQuestionHtml(question);

  // Hint
  const hintBox = document.getElementById('player-hint-box');
  if (hint) {
    document.getElementById('player-hint-text').textContent = hint;
    hintBox.classList.remove('hidden');
  } else {
    hintBox.classList.add('hidden');
  }

  document.getElementById('player-view-title').textContent = '✏️ Question !';

  // Calculate remaining time (accounting for server latency)
  const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const remaining = Math.max(0, duration - elapsed);

  startTimer(remaining, 'player-timer-display', 'player-timer-bar', () => {
    showToast('⏱️ Temps écoulé !', 'info');
    // Auto-submit empty if no answer
    const form = document.getElementById('answer-form');
    if (!form.classList.contains('hidden')) {
      document.getElementById('answer-form').classList.add('hidden');
      document.getElementById('answer-sent-state').classList.remove('hidden');
      document.getElementById('sent-answer-display').textContent = '(aucune réponse)';
    }
  });

  // Focus input
  setTimeout(() => document.getElementById('player-answer-input').focus(), 300);
});

function renderQuestionHtml(text) {
  // Allow safe tags: <strong>, <em> — escape everything else
  return escHtml(text)
    .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gs, '<strong>$1</strong>')
    .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gs, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ── Answer Received (host sees player answers live) ───────────────────────────
let liveAnswerCount = 0;

socket.on('answer-received', ({ playerId, pseudo, answer, elapsed }) => {
  liveAnswerCount++;
  const list = document.getElementById('answers-live-list');
  const li   = document.createElement('li');
  li.id      = `ans-${playerId}`;
  li.innerHTML = `
    <span class="answer-pseudo">🎮 ${escHtml(pseudo)}</span>
    <span class="answer-text">"${escHtml(answer)}"</span>
    <span class="answer-time">${elapsed}s</span>
  `;
  list.appendChild(li);

  const total = state.players.filter(p => !p.isHost).length;
  const countEl = document.getElementById('answers-count');
  if (countEl) countEl.innerHTML = `(<strong>${liveAnswerCount}/${total}</strong>)`;

  showToast(`${pseudo} a répondu !`, 'info', 1500);
});

socket.on('all-answered', ({ answers }) => {
  stopTimer();
  showReviewPanel(answers);
});

socket.on('time-up', ({ answers }) => {
  stopTimer();
  showReviewPanel(answers);
});

function showReviewPanel(answers) {
  document.getElementById('host-answers-panel').classList.add('hidden');
  document.getElementById('host-review-panel').classList.remove('hidden');
  liveAnswerCount = 0;

  // Display correct answer
  document.getElementById('display-correct-answer').textContent = state.currentQuestion?.answer || '';
  document.getElementById('display-explanation').textContent   = state.currentQuestion?.explanation || '';

  // Build review list
  const reviewList = document.getElementById('review-list');
  reviewList.innerHTML = '';
  state.pendingValidations = {};

  answers.forEach(({ playerId, pseudo, answer }) => {
    state.pendingValidations[playerId] = null;

    const item = document.createElement('div');
    item.className = 'review-item';
    item.id = `review-${playerId}`;
    item.innerHTML = `
      <span class="r-pseudo">${escHtml(pseudo)}</span>
      <span class="r-answer">"${escHtml(answer.text || answer)}"</span>
      <div class="r-actions">
        <button class="btn-valid"   data-id="${playerId}" data-correct="true">✅</button>
        <button class="btn-invalid" data-id="${playerId}" data-correct="false">❌</button>
      </div>
    `;
    reviewList.appendChild(item);
  });

  // Attach validation button events
  reviewList.querySelectorAll('.btn-valid, .btn-invalid').forEach(btn => {
    btn.addEventListener('click', () => {
      const id      = btn.dataset.id;
      const correct = btn.dataset.correct === 'true';
      state.pendingValidations[id] = correct;

      const item = document.getElementById(`review-${id}`);
      item.classList.remove('validated-correct', 'validated-wrong');
      item.classList.add(correct ? 'validated-correct' : 'validated-wrong');

      // Deselect other button in same row
      item.querySelectorAll('.btn-valid, .btn-invalid').forEach(b => {
        b.style.opacity = (b === btn) ? '1' : '0.4';
      });
    });
  });
}

// ── Answer Submitted (player confirmation) ────────────────────────────────────
socket.on('answer-submitted', () => {
  // Already handled in submitPlayerAnswer
});

socket.on('already-answered', () => {
  showToast('Tu as déjà répondu !', 'info');
});

socket.on('waiting-review', () => {
  stopTimer();
  document.getElementById('player-question-state').classList.add('hidden');
  document.getElementById('player-review-state').classList.remove('hidden');
  document.getElementById('player-view-title').textContent = 'Correction en cours…';
  showToast('L\'hôte corrige les réponses…', 'info');
});

// ── Scores Updated ────────────────────────────────────────────────────────────
socket.on('scores-updated', ({ scoreUpdates, players }) => {
  state.players = players;

  // Build scores view
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

  // Last answer recap
  const recapEl = document.getElementById('last-answer-recap');
  const correctAnswer = state.currentQuestion?.answer || '';
  const explanation   = state.currentQuestion?.explanation || '';
  recapEl.innerHTML = `
    <h3>✅ Réponse correcte : <span style="color:var(--accent)">${escHtml(correctAnswer)}</span></h3>
    ${explanation ? `<div class="explanation-text">${escHtml(explanation)}</div>` : ''}
    <div style="margin-top:0.75rem;font-size:0.9rem">
      ${scoreUpdates.map(s => `
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem">
          <span>${s.correct ? '✅' : '❌'}</span>
          <span style="font-weight:600">${escHtml(s.pseudo)}</span>
          ${s.correct ? `<span style="color:#22c55e;font-size:0.85rem">+${s.pointsEarned} pts</span>` : '<span style="color:var(--danger);font-size:0.85rem">0 pt</span>'}
        </div>
      `).join('')}
    </div>
  `;

  // Scores list
  const scoresList = document.getElementById('scores-list');
  scoresList.innerHTML = sortedPlayers.map((p, i) => {
    const update = scoreUpdates.find(s => s.pseudo === p.pseudo);
    const delta  = update ? update.pointsEarned : 0;
    const correct = update ? update.correct : null;
    return `
      <div class="score-row">
        <span class="rank">${rankEmojis[i] || (i+1)}</span>
        <span class="s-name">${escHtml(p.pseudo)}${p.isHost ? ' 👑' : ''}</span>
        <span class="s-score">${p.score} pts</span>
        ${delta > 0 ? `<span class="s-delta">+${delta}</span>` : (correct === false ? '<span class="s-wrong">✗</span>' : '')}
      </div>
    `;
  }).join('');

  // Host: add "Next question" button
  const nextBtnContainer = document.getElementById('host-next-btn-container');
  if (state.isHost) {
    nextBtnContainer.innerHTML = `<button class="btn btn-primary btn-xl" id="btn-next-question">➡️ Question suivante</button><button class="btn btn-danger" id="btn-end-game-scores">🏁 Terminer</button>`;
    document.getElementById('btn-next-question').addEventListener('click', () => {
      // Reset host dashboard for next question
      document.getElementById('host-answers-panel').classList.add('hidden');
      document.getElementById('host-review-panel').classList.add('hidden');
      renderScoreBar(state.players, 'host-score-bar');
      showView('view-host-dashboard');
    });
    document.getElementById('btn-end-game-scores').addEventListener('click', () => {
      if (confirm('Terminer la partie ?')) socket.emit('end-game', { code: state.roomCode });
    });
  } else {
    nextBtnContainer.innerHTML = '';
    // Player: reset for next question
    document.getElementById('player-waiting-state').classList.remove('hidden');
    document.getElementById('player-question-state').classList.add('hidden');
    document.getElementById('player-review-state').classList.add('hidden');
    document.getElementById('player-view-title').textContent = 'En attente de la prochaine question…';
    renderScoreBar(state.players, 'player-score-bar');
  }

  showView('view-scores');
});

// ── Game Ended ────────────────────────────────────────────────────────────────
socket.on('game-ended', ({ podium, difficultQuestions, totalQuestions }) => {
  stopTimer();

  // Build podium
  const podiumEl = document.getElementById('podium');
  const medals   = ['🥇', '🥈', '🥉'];
  const rankClass = ['rank-1', 'rank-2', 'rank-3', 'rank-other'];

  podiumEl.innerHTML = podium.map((p, i) => `
    <div class="podium-place ${rankClass[i] || 'rank-other'}">
      <div class="podium-medal">${medals[i] || '🎖️'}</div>
      <div class="podium-name">${escHtml(p.pseudo)}</div>
      <div class="podium-score">${p.score} pts</div>
      <div class="podium-block">${i + 1}</div>
    </div>
  `).join('');

  // Difficult questions
  const difficultList = document.getElementById('difficult-list');
  if (difficultQuestions.length === 0) {
    difficultList.innerHTML = '<p style="color:var(--accent)">👏 Excellent ! Aucune question n\'a posé de problème au groupe.</p>';
  } else {
    difficultList.innerHTML = difficultQuestions.map(q => `
      <div class="difficult-item">
        <div class="di-q">${renderQuestionHtml(q.question)}</div>
        <div class="di-a">✅ ${escHtml(q.answer)}</div>
        ${q.explanation ? `<div class="di-ex">${escHtml(q.explanation)}</div>` : ''}
        <div style="font-size:0.78rem;color:var(--danger);margin-top:0.3rem">❌ Raté par ${q.wrongCount} joueur(s)</div>
      </div>
    `).join('');
  }

  document.getElementById('difficult-questions-panel').style.display = difficultQuestions.length > 0 ? '' : '';

  showView('view-final');
  showToast('🏆 Partie terminée !', 'success', 5000);
});

// ── Host Changed (after host disconnects) ─────────────────────────────────────
socket.on('host-changed', ({ newHostId, players }) => {
  state.players = players;
  if (socket.id === newHostId) {
    state.isHost = true;
    showToast('⚠️ L\'hôte a quitté — tu es maintenant l\'hôte !', 'info', 5000);
    // Redirect to host dashboard or lobby if game hasn't started
    showView('view-host-dashboard');
  }
});

// ── Errors ────────────────────────────────────────────────────────────────────
socket.on('error', ({ message }) => {
  showToast(message, 'error');
});

socket.on('disconnect', () => {
  showToast('Connexion perdue. Reconnexion…', 'error');
});

socket.on('reconnect', () => {
  showToast('Reconnecté !', 'success');
});
