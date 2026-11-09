const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve data files (for client-side revision sheets)
app.use('/data', express.static(path.join(__dirname, 'data')));

// Health check endpoint (for Render keep-alive)
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── Data Loading ─────────────────────────────────────────────────────────────
const DATA = {
  irregular_verbs: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'irregular_verbs.json'), 'utf8')),
  vocabulary: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'vocabulary.json'), 'utf8')),
  grammar: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'grammar.json'), 'utf8')),
  traps: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'traps.json'), 'utf8'))
};

// ─── Game State ───────────────────────────────────────────────────────────────
const rooms = new Map();

// Generate a random 4-character room code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Generate a question automatically based on category
function generateQuestion(category) {
  if (category === 'irregular_verbs') {
    const verbs = DATA.irregular_verbs;
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const questionTypes = [
      {
        question: `📝 What is the <strong>Past Simple</strong> of "<em>${verb.infinitive}</em>"?\n(FR: ${verb.fr})`,
        answer: verb.past,
        hint: `Infinitive: ${verb.infinitive}`
      },
      {
        question: `📝 What is the <strong>Past Participle</strong> of "<em>${verb.infinitive}</em>"?\n(FR: ${verb.fr})`,
        answer: verb.participle,
        hint: `Infinitive: ${verb.infinitive}`
      },
      {
        question: `📝 Translate to English (Past Simple): "<em>${verb.fr}</em>"`,
        answer: verb.past,
        hint: `Infinitive: ${verb.infinitive}`
      }
    ];
    const qType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    return { ...qType, category, source: verb };
  }

  if (category === 'vocabulary') {
    const allCategories = Object.keys(DATA.vocabulary.categories);
    const randCat = allCategories[Math.floor(Math.random() * allCategories.length)];
    const words = DATA.vocabulary.categories[randCat];
    const word = words[Math.floor(Math.random() * words.length)];
    const questionTypes = [
      {
        question: `🔤 Translate to English: "<em>${word.fr}</em>"`,
        answer: word.word,
        hint: `Category: ${randCat}`
      },
      {
        question: `🔤 Translate to French: "<em>${word.word}</em>"`,
        answer: word.fr,
        hint: `English word: ${word.word}`
      },
      {
        question: `🔤 Complete the sentence:\n"${word.example ? word.example.replace(word.word, '___') : `Translate: "${word.fr}"`}"`,
        answer: word.word,
        hint: `French: ${word.fr}`
      }
    ];
    const qType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    return { ...qType, category, source: word };
  }

  if (category === 'grammar') {
    const questions = DATA.grammar.questions;
    const q = questions[Math.floor(Math.random() * questions.length)];
    return {
      question: `📐 ${q.question}`,
      answer: q.answer,
      hint: 'Think about the tense and the subject.',
      explanation: q.explanation,
      category,
      source: q
    };
  }

  if (category === 'traps') {
    const traps = DATA.traps;
    const trap = traps[Math.floor(Math.random() * traps.length)];
    return {
      question: `⚠️ Find and correct the mistake:\n<em>"${trap.wrong}"</em>`,
      answer: trap.correct,
      hint: `Rule: ${trap.rule}`,
      explanation: trap.explanation,
      category,
      source: trap
    };
  }

  return { question: 'No question available.', answer: '', category };
}

// ─── Socket.io Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── Create Room ──────────────────────────────────────────────────────────────
  socket.on('create-room', ({ pseudo }) => {
    if (!pseudo || pseudo.trim().length === 0) {
      socket.emit('error', { message: 'Pseudo required.' });
      return;
    }
    const code = generateCode();
    const room = {
      code,
      hostId: socket.id,
      players: [{ id: socket.id, pseudo: pseudo.trim(), score: 0, answers: [] }],
      status: 'lobby',
      config: { duration: 60, category: 'irregular_verbs' },
      currentQuestion: null,
      questionHistory: [],
      timerTimeout: null
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room-created', {
      code,
      player: { id: socket.id, pseudo: pseudo.trim(), score: 0, isHost: true }
    });
    console.log(`[Room] Created: ${code} by ${pseudo}`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────────
  socket.on('join-room', ({ code, pseudo }) => {
    const room = rooms.get(code);
    if (!room) {
      socket.emit('join-error', { message: `Room "${code}" not found. Check the code!` });
      return;
    }
    if (room.status !== 'lobby') {
      socket.emit('join-error', { message: 'The game has already started. Wait for the next round!' });
      return;
    }
    if (room.players.length >= 8) {
      socket.emit('join-error', { message: 'Room is full (max 8 players).' });
      return;
    }
    if (!pseudo || pseudo.trim().length === 0) {
      socket.emit('join-error', { message: 'Pseudo required.' });
      return;
    }
    const cleanPseudo = pseudo.trim();
    if (room.players.some(p => p.pseudo.toLowerCase() === cleanPseudo.toLowerCase())) {
      socket.emit('join-error', { message: `Pseudo "${cleanPseudo}" is already taken. Choose another one.` });
      return;
    }

    room.players.push({ id: socket.id, pseudo: cleanPseudo, score: 0, answers: [] });
    socket.join(code);

    socket.emit('room-joined', {
      code,
      player: { id: socket.id, pseudo: cleanPseudo, score: 0, isHost: false },
      players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }))
    });

    // Notify host and other players
    io.to(code).emit('player-joined', {
      players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }))
    });

    console.log(`[Room] ${cleanPseudo} joined ${code}. Players: ${room.players.length}`);
  });

  // ── Update Config (host only) ────────────────────────────────────────────────
  socket.on('update-config', ({ code, config }) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    room.config = { ...room.config, ...config };
    io.to(code).emit('config-updated', room.config);
  });

  // ── Start Game ───────────────────────────────────────────────────────────────
  socket.on('start-game', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 1) {
      socket.emit('error', { message: 'Need at least 1 player!' });
      return;
    }
    room.status = 'waiting-question';
    // Reset scores for a fresh game
    room.players.forEach(p => { p.score = 0; p.answers = []; });
    room.questionHistory = [];

    io.to(code).emit('game-started', {
      config: room.config,
      players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }))
    });
    console.log(`[Game] Started: ${code}`);
  });

  // ── Generate Question (host only) ────────────────────────────────────────────
  socket.on('generate-question', ({ code, category }) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;
    const generated = generateQuestion(category || room.config.category);
    socket.emit('question-generated', generated);
  });

  // ── Send Question (host only) ────────────────────────────────────────────────
  socket.on('send-question', ({ code, question, answer, hint, explanation }) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    // Reset answers for this round
    room.players.forEach(p => { p.answers = []; });
    room.currentQuestion = {
      question,
      answer: answer.trim().toLowerCase(),
      hint: hint || '',
      explanation: explanation || '',
      startTime: Date.now(),
      duration: room.config.duration
    };
    room.status = 'question';

    // Send question to players (without the answer!)
    io.to(code).emit('new-question', {
      question,
      hint: hint || '',
      duration: room.config.duration,
      startTime: room.currentQuestion.startTime
    });

    // Send full question (with answer) only to host
    socket.emit('host-question-info', {
      question,
      answer,
      hint,
      explanation,
      duration: room.config.duration
    });

    // Auto-end question after timer expires
    if (room.timerTimeout) clearTimeout(room.timerTimeout);
    room.timerTimeout = setTimeout(() => {
      if (room.status === 'question') {
        room.status = 'review';
        // Emit to host to review answers
        io.to(room.hostId).emit('time-up', {
          answers: room.players
            .filter(p => p.id !== room.hostId)
            .map(p => ({
              playerId: p.id,
              pseudo: p.pseudo,
              answer: p.answers[0] || { text: '(no answer)', timestamp: null }
            }))
        });
        // Notify players that time is up
        io.to(code).except(room.hostId).emit('waiting-review');
      }
    }, room.config.duration * 1000);

    console.log(`[Question] Sent in ${code}: "${question.substring(0, 50)}..."`);
  });

  // ── Submit Answer (players only) ─────────────────────────────────────────────
  socket.on('submit-answer', ({ code, answer }) => {
    const room = rooms.get(code);
    if (!room || room.status !== 'question') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.id === room.hostId) return;
    if (player.answers.length > 0) {
      socket.emit('already-answered');
      return;
    }

    const elapsed = (Date.now() - room.currentQuestion.startTime) / 1000;
    player.answers.push({ text: answer.trim(), timestamp: elapsed });

    socket.emit('answer-submitted', { text: answer.trim() });

    // Notify host of this answer
    io.to(room.hostId).emit('answer-received', {
      playerId: socket.id,
      pseudo: player.pseudo,
      answer: answer.trim(),
      elapsed: Math.round(elapsed)
    });

    // Check if all non-host players have answered
    const nonHostPlayers = room.players.filter(p => p.id !== room.hostId);
    const allAnswered = nonHostPlayers.every(p => p.answers.length > 0);
    if (allAnswered && nonHostPlayers.length > 0) {
      clearTimeout(room.timerTimeout);
      room.status = 'review';
      io.to(room.hostId).emit('all-answered', {
        answers: nonHostPlayers.map(p => ({
          playerId: p.id,
          pseudo: p.pseudo,
          answer: p.answers[0] || { text: '(no answer)', timestamp: null }
        }))
      });
      io.to(code).except(room.hostId).emit('waiting-review');
    }

    console.log(`[Answer] ${player.pseudo} in ${code}: "${answer}" (${Math.round(elapsed)}s)`);
  });

  // ── Validate Answers (host only) ─────────────────────────────────────────────
  socket.on('validate-answers', ({ code, validations }) => {
    // validations: [{ playerId, correct: true/false }]
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    const correctAnswer = room.currentQuestion ? room.currentQuestion.answer : '';
    const duration = room.currentQuestion ? room.currentQuestion.duration : 60;
    const scoreUpdates = [];

    validations.forEach(({ playerId, correct }) => {
      const player = room.players.find(p => p.id === playerId);
      if (!player) return;

      let pointsEarned = 0;
      if (correct) {
        const elapsed = player.answers[0] ? player.answers[0].timestamp : duration;
        pointsEarned = 10;
        if (elapsed <= 5) pointsEarned += 3;
        else if (elapsed <= 10) pointsEarned += 2;
        else if (elapsed < duration) pointsEarned += 1;
        player.score += pointsEarned;
      }

      scoreUpdates.push({
        playerId,
        pseudo: player.pseudo,
        correct,
        pointsEarned,
        totalScore: player.score
      });
    });

    // Record in question history
    if (room.currentQuestion) {
      room.questionHistory.push({
        question: room.currentQuestion.question,
        answer: room.currentQuestion.answer,
        explanation: room.currentQuestion.explanation,
        results: scoreUpdates
      });
    }

    room.status = 'waiting-question';

    // Broadcast score updates to all
    io.to(code).emit('scores-updated', {
      scoreUpdates,
      players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }))
    });

    console.log(`[Validate] ${code} — ${scoreUpdates.length} answers validated`);
  });

  // ── End Game (host only) ─────────────────────────────────────────────────────
  socket.on('end-game', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    if (room.timerTimeout) clearTimeout(room.timerTimeout);
    room.status = 'ended';

    // Sort players by score for podium
    const podium = [...room.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }));

    // Analyze difficult questions (questions with many wrong answers)
    const difficultQuestions = room.questionHistory
      .map(q => {
        const wrongCount = q.results.filter(r => !r.correct).length;
        return { ...q, wrongCount };
      })
      .filter(q => q.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 5);

    io.to(code).emit('game-ended', { podium, difficultQuestions, totalQuestions: room.questionHistory.length });

    console.log(`[Game] Ended: ${code}`);
    // Keep room for a while, then clean up
    setTimeout(() => rooms.delete(code), 10 * 60 * 1000);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    rooms.forEach((room, code) => {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) return;

      const wasHost = room.hostId === socket.id;
      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        if (room.timerTimeout) clearTimeout(room.timerTimeout);
        rooms.delete(code);
        return;
      }

      if (wasHost) {
        // Transfer host to next player
        room.hostId = room.players[0].id;
        io.to(code).emit('host-changed', {
          newHostId: room.hostId,
          players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }))
        });
      } else {
        io.to(code).emit('player-left', {
          players: room.players.map(p => ({ id: p.id, pseudo: p.pseudo, score: p.score, isHost: p.id === room.hostId }))
        });
      }
    });
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📚 Data loaded: ${DATA.irregular_verbs.length} verbs, ${DATA.traps.length} traps, ${DATA.grammar.questions.length} grammar questions`);
});
