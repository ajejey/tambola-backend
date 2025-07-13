const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const rooms = {};

// Helper for structured logging
const log = (level, message, data = '') => {
  console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, data);
};

// Initialize the automated house room
function initializeHouseRoom() {
    const roomName = 'house';
    rooms[roomName] = {
        players: {},
        board: Array(90).fill(false),
        numbersCalled: [],
        host: 'system',
        prizes: {},
        gameStarted: false,
        config: {
            claims: ['Early Five', 'Top Row', 'Middle Row', 'Bottom Row', 'All Corners', 'Full House'],
            callingInterval: 5000, // 5 seconds
            autoCalling: true,
        },
        autoCallTimer: null,
    };
    log('info', 'Automated house room initialized');
    io.emit('updateHouseRoomState', getGameStateForClient(rooms[roomName]));
}

initializeHouseRoom();

// Automated game management for the house room
setInterval(() => {
    const roomName = 'house';
    const room = rooms[roomName];
    if (!room) return;

    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Start a new game every 30 minutes
    if (minutes % 30 === 0 && seconds === 0) {
        if (room.gameStarted) {
            log('info', `[Room: ${roomName}] Game ended and reset automatically.`);
            io.to(roomName).emit('gameOver');
            clearTimeout(room.autoCallTimer);
            initializeHouseRoom(); // Reset the room
        }

        log('info', `[Room: ${roomName}] New game started automatically.`);
        room.gameStarted = true;
        io.to(roomName).emit('gameStarted');
        startAutoCalling(roomName);
        io.to(roomName).emit('updateGameState', getGameStateForClient(room));
    }
}, 1000);

const PRIZE_SCORES = {
  'Early Five': 100,
  'Top Row': 200,
  'Middle Row': 200,
  'Bottom Row': 200,
  'All Corners': 300,
  'Full House': 500,
};

function generateRoomCode() {
  let code;
  do {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
  } while (rooms[code]);
  return code;
}

function getGameStateForClient(room) {
  if (!room) return null;
  const playersForClient = {};
  for (const playerId in room.players) {
    const { socketId, ...playerWithoutSocketId } = room.players[playerId];
    playersForClient[playerId] = playerWithoutSocketId;
  }
  const { autoCallTimer, ...roomStateForClient } = room;
  roomStateForClient.players = playersForClient;
  return roomStateForClient;
}

io.on('connection', (socket) => {
  log('info', `User connected: ${socket.id}`);

  socket.on('getHouseRoomState', () => {
    log('info', `[Socket: ${socket.id}] Requested house room state.`);
    socket.emit('updateHouseRoomState', getGameStateForClient(rooms['house']));
  });

  socket.on('createRoom', ({ config, ticket, playerConfig }, callback) => {
    const roomName = generateRoomCode();
    const newPlayerId = `${Date.now()}-${Math.random()}`;
    rooms[roomName] = {
      players: {},
      board: Array(90).fill(false),
      numbersCalled: [],
      host: newPlayerId,
      prizes: {},
      gameStarted: false,
      config: config,
      autoCallTimer: null,
    };
    rooms[roomName].players[newPlayerId] = {
      ticket: ticket,
      name: 'Host',
      id: newPlayerId,
      socketId: socket.id,
      score: 0,
      config: playerConfig,
    };
    socket.join(roomName);
    callback({ success: true, roomName, playerId: newPlayerId });
    io.to(roomName).emit('updateGameState', getGameStateForClient(rooms[roomName]));
    log('info', `[Room: ${roomName}] Room created by host ${newPlayerId}.`, { config });
  });

  socket.on('joinRoom', (roomName, playerName, ticket, playerConfig, callback) => {
    const room = rooms[roomName];
    if (!room) {
      log('warn', `[Socket: ${socket.id}] Join failed: Room ${roomName} does not exist.`);
      return callback({ error: 'Room does not exist' });
    }
    if (room.gameStarted) {
      log('warn', `[Socket: ${socket.id}] Join failed: Game in room ${roomName} has already started.`);
      return callback({ error: 'Game has already started' });
    }
    const newPlayerId = `${Date.now()}-${Math.random()}`;
    room.players[newPlayerId] = {
      ticket: ticket,
      name: playerName,
      id: newPlayerId,
      socketId: socket.id,
      score: 0,
      config: playerConfig,
    };
    socket.join(roomName);
    callback({ success: true, roomName, playerId: newPlayerId, gameState: getGameStateForClient(room) });
    io.to(roomName).emit('updateGameState', getGameStateForClient(room));
    if (roomName === 'house') {
      io.emit('updateHouseRoomState', getGameStateForClient(room));
    }
    log('info', `[Room: ${roomName}] Player ${playerName} (${newPlayerId}) joined.`);
  });

  socket.on('updateCallingInterval', ({ roomName, interval }) => {
    const room = rooms[roomName];
    if (!room) return;
    const player = Object.values(room.players).find(p => p.socketId === socket.id);
    if (player && room.host === player.id) {
      room.config.callingInterval = interval;
      if (room.config.autoCalling && room.gameStarted) {
        clearTimeout(room.autoCallTimer);
        startAutoCalling(roomName);
      }
      io.to(roomName).emit('updateGameState', getGameStateForClient(room));
      log('info', `[Room: ${roomName}] Calling interval updated to ${interval}ms by host.`);
    }
  });

  socket.on('toggleAutoCalling', ({ roomName, autoCalling }) => {
    const room = rooms[roomName];
    if (!room) return;
    const player = Object.values(room.players).find(p => p.socketId === socket.id);
    if (player && room.host === player.id) {
      room.config.autoCalling = autoCalling;
      if (autoCalling && room.gameStarted) {
        startAutoCalling(roomName);
      } else {
        clearTimeout(room.autoCallTimer);
      }
      io.to(roomName).emit('updateGameState', getGameStateForClient(room));
      log('info', `[Room: ${roomName}] Auto-calling set to ${autoCalling} by host.`);
    }
  });

  socket.on('manualCall', (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    const player = Object.values(room.players).find(p => p.socketId === socket.id);
    if (player && room.host === player.id && !room.config.autoCalling) {
      drawNumber(roomName);
    }
  });

  socket.on('startGame', (roomName) => {
    const room = rooms[roomName];
    if (!room) {
      log('warn', `[Socket: ${socket.id}] Start game failed: Room ${roomName} not found.`);
      return;
    }
    const player = Object.values(room.players).find(p => p.socketId === socket.id);
    if (player && room.host === player.id) {
      room.gameStarted = true;
      io.to(roomName).emit('gameStarted');
      if (room.config.autoCalling) {
        startAutoCalling(roomName);
      }
      io.to(roomName).emit('updateGameState', getGameStateForClient(room));
      log('info', `[Room: ${roomName}] Game started by host.`);
    } else {
      log('warn', `[Socket: ${socket.id}] Unauthorized attempt to start game in room ${roomName}.`);
    }
  });

  socket.on('claimPrize', (roomName, prize, struckNumbers, callback) => {
    const room = rooms[roomName];
    if (!room) {
      log('warn', `[Socket: ${socket.id}] Claim failed: Room ${roomName} not found.`);
      return callback({ error: 'Room not found.' });
    }
    const player = Object.values(room.players).find(p => p.socketId === socket.id);
    if (!player) {
      log('error', `[Socket: ${socket.id}] Claim failed: Player not found in room ${roomName}.`);
      return callback({ error: 'Invalid player.' });
    }

    if (!room.config.claims.includes(prize)) {
      log('warn', `[Room: ${roomName}] Player ${player.name} claim failed: Prize '${prize}' not enabled.`);
      return callback({ error: 'This prize is not enabled for this game.' });
    }

    if (room.prizes[prize]) {
      log('warn', `[Room: ${roomName}] Player ${player.name} claim failed: Prize '${prize}' already claimed.`);
      return callback({ error: 'Prize already claimed.' });
    }

    const ticket = player.ticket;
    const numbersToValidate = player.config.autoStrike ? room.numbersCalled : struckNumbers;

    if (!numbersToValidate) {
      log('error', `[Room: ${roomName}] Player ${player.name} claim failed: Invalid submission for '${prize}'.`);
      return callback({ error: 'Invalid claim submission.' });
    }

    let isValid = false;
    // ... (validation logic remains the same)
    switch (prize) {
        case 'Early Five':
          let count = 0;
          for (const row of ticket) {
            for (const num of row) {
              if (num && numbersToValidate.includes(num)) {
                count++;
              }
            }
          }
          isValid = count >= 5;
          break;
        case 'Top Row':
          isValid = ticket[0].filter(num => num && numbersToValidate.includes(num)).length === 5;
          break;
        case 'Middle Row':
          isValid = ticket[1].filter(num => num && numbersToValidate.includes(num)).length === 5;
          break;
        case 'Bottom Row':
          isValid = ticket[2].filter(num => num && numbersToValidate.includes(num)).length === 5;
          break;
        case 'All Corners':
          const firstRowNumbers = ticket[0].filter(n => n !== null);
          const lastRowNumbers = ticket[2].filter(n => n !== null);
          const corners = [
            firstRowNumbers[0],
            firstRowNumbers[firstRowNumbers.length - 1],
            lastRowNumbers[0],
            lastRowNumbers[lastRowNumbers.length - 1]
          ];
          isValid = corners.every(num => numbersToValidate.includes(num));
          break;
        case 'Full House':
          let totalNumbers = 0;
          for (const row of ticket) {
            for (const num of row) {
              if (num) {
                totalNumbers++;
              }
            }
          }
          let calledNumbersCount = 0;
          for (const row of ticket) {
            for (const num of row) {
              if (num && numbersToValidate.includes(num)) {
                calledNumbersCount++;
              }
            }
          }
          isValid = calledNumbersCount === totalNumbers;
          break;
      }

    if (isValid) {
      room.prizes[prize] = { player: player.name, score: PRIZE_SCORES[prize] };
      player.score += PRIZE_SCORES[prize];
      io.to(roomName).emit('prizeClaimed', { player: player.name, prize });
      io.to(roomName).emit('updateGameState', getGameStateForClient(room));
      callback({ success: true });
      log('info', `[Room: ${roomName}] Player ${player.name} successfully claimed '${prize}'.`);

      const allPrizesClaimed = room.config.claims.every(p => room.prizes[p] !== undefined);
      if (allPrizesClaimed && roomName !== 'house') {
        log('info', `[Room: ${roomName}] All prizes claimed. Game over.`);
        io.to(roomName).emit('gameOver');
        if (room.autoCallTimer) {
          clearTimeout(room.autoCallTimer);
        }
        setTimeout(() => {
          delete rooms[roomName];
          log('info', `[Room: ${roomName}] Room closed and deleted.`);
        }, 5000);
      }
    } else {
      log('warn', `[Room: ${roomName}] Player ${player.name} failed claim for '${prize}'.`);
      callback({ error: 'Claim is not valid.' });
    }
  });

  socket.on('requestTickets', (callback) => {
    try {
      const tickets = Array.from({ length: 5 }, () => generateTicket());
      log('info', `[Socket: ${socket.id}] Generated 5 tickets.`);
      callback({ tickets });
    } catch (error) {
      log('error', 'Error generating tickets:', error);
      callback({ error: 'Failed to generate tickets.' });
    }
  });

  socket.on('reconnectPlayer', (data, callback) => {
    const { roomName, playerId, playerName } = data;
    const room = rooms[roomName];
    if (!room || (roomName !== 'house' && !room.players[playerId])) {
      log('warn', `[Socket: ${socket.id}] Reconnect failed for player ${playerId} in room ${roomName}.`);
      return callback({ error: 'Could not reconnect.' });
    }

    if (roomName === 'house' && !room.players[playerId]) {
        const newPlayerId = playerId;
        room.players[newPlayerId] = {
            ticket: null,
            name: playerName || 'Player',
            id: newPlayerId,
            socketId: socket.id,
            score: 0,
            config: { autoStrike: false, autoClaim: false },
        };
        log('info', `[Room: house] New player ${newPlayerId} added on reconnect.`);
    }

    const player = room.players[playerId];
    player.socketId = socket.id;
    player.disconnected = false;
    player.name = playerName || player.name;

    socket.join(roomName);
    callback({ success: true, playerId: player.id, gameState: getGameStateForClient(room) });
    io.to(roomName).emit('updateGameState', getGameStateForClient(room));
    log('info', `[Room: ${roomName}] Player ${player.name} reconnected with socket ${socket.id}.`);
  });

  socket.on('disconnect', () => {
    log('info', `User disconnected: ${socket.id}`);
    for (const roomName in rooms) {
      const room = rooms[roomName];
      if (!room) continue;
      const player = Object.values(room.players).find(p => p.socketId === socket.id);
      if (player) {
        player.disconnected = true;
        io.to(roomName).emit('updateGameState', getGameStateForClient(room));
        if (roomName === 'house') {
          io.emit('updateHouseRoomState', getGameStateForClient(room));
        }
        log('info', `[Room: ${roomName}] Player ${player.name} marked as disconnected.`);
        break;
      }
    }
  });
});

function startAutoCalling(roomName) {
  const room = rooms[roomName];
  if (!room) return;
  if (room.autoCallTimer) {
    clearTimeout(room.autoCallTimer);
  }
  room.autoCallTimer = setTimeout(() => {
    if (rooms[roomName] && rooms[roomName].config.autoCalling) {
      drawNumber(roomName);
      startAutoCalling(roomName);
    }
  }, room.config.callingInterval);
}

function drawNumber(roomName) {
  const room = rooms[roomName];
  if (!room) return;

  const remainingNumbers = [];
  for (let i = 1; i <= 90; i++) {
    if (!room.numbersCalled.includes(i)) {
      remainingNumbers.push(i);
    }
  }

  if (remainingNumbers.length > 0) {
    const number = remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
    room.numbersCalled.push(number);
    room.board[number - 1] = true;
    io.to(roomName).emit('newNumber', number);
    io.to(roomName).emit('updateGameState', getGameStateForClient(room));
    // Optional: log every number draw. Can be noisy.
    // log('debug', `[Room: ${roomName}] Called number ${number}.`);
  }
}

function generateTicket() {
  const ticket = [];
  const columns = [[], [], [], [], [], [], [], [], []];
  for (let i = 1; i <= 90; i++) {
    const col = Math.floor((i - 1) / 10);
    columns[col].push(i);
  }
  for (let i = 0; i < 3; i++) {
    ticket.push(Array(9).fill(null));
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5; i++) {
      let col;
      do {
        col = Math.floor(Math.random() * 9);
      } while (ticket[row][col] !== null);
      const availableNumbers = columns[col];
      let num;
      do {
        num = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      } while (isNumberInTicket(ticket, num));
      ticket[row][col] = num;
    }
  }
  return ticket;
}

function isNumberInTicket(ticket, num) {
  for (const row of ticket) {
    if (row.includes(num)) {
      return true;
    }
  }
  return false;
}

server.listen(3001, () => {
  log('info', 'Server started and listening on *:3001');
});