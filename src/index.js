require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const socketio = require('socket.io');
const http = require('http');

const ticketsRouter = require('./routes/tickets');
const playersRouter = require('./routes/players');
const gamesRouter = require('./routes/games');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

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

// Socket.IO
io.on('connection', (socket) => {
  console.log(`Socket ${socket.id} connected.`);

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
