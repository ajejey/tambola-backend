require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const socketio = require('socket.io');
const http = require('http');
const socketFunction = require('../src/sockets/index');
const Player = require('../src/models/Player');
const Game = require('../src/models/Game');
const Tambola = require('../src/utils/tambola');




const ticketsRouter = require('./routes/tickets');
const playersRouter = require('./routes/players');
const gamesRouter = require('./routes/games');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const path = require('path');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

console.log("mongodb uri ", MONGODB_URI)

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/tickets', ticketsRouter);
app.use('/api/players', playersRouter);
app.use('/api/games', gamesRouter);

app.get('/', (req, res) => {
  var options = {
    root: path.join(__dirname),
  }

  var fileName = 'index.html'
  res.sendFile(fileName, options)

})

// Socket.IO
io.on('connection', (socket) => {
  console.log(`Socket ${socket.id} connected.`);

  // socketFunction(socket)
  // Listen for a new player joining the game
  socket.on('join', async (data) => {
    console.log("recieved data ", data)
    try {
      const { name, gameId } = data;

      // Find the game
      const game = await Game.findById(gameId);
      console.log("game found ", game)

      if (!game) {
        return socket.emit('error', 'Game not found');
      }

      // Create a new player
      const player = new Player({
        name,
        gameId,
        socketId: socket.id,
        ticket: new Ticket().generateTicket(),
        hasWon: false
      });

      // Save the player to the database
      await player.save();
      console.log("new player created")

      // Join the player to the game room
      socket.join(gameId);

      // Broadcast the player joined event to other players in the game
      socket.to(gameId).broadcast.emit('playerJoined', player);

      // Emit the game and player details to the new player
      socket.emit('gameDetails', { game, player });
    } catch (err) {
      console.error(err);
      socket.emit('error', err.message);
    }
  });


  // Socket logic goes here
});



// MongoDB connection
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connection successful.');
    // Start the server
    server.listen(PORT, () => {
      console.log(`Server started on port ${PORT}.`);
    });
  })
  .catch((err) => console.error(err));
