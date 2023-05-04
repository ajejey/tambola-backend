const socketio = require('socket.io');
const Ticket = require('../models/Ticket');
const Player = require('../models/Player');
const Game = require('../models/Game');
const Tambola = require('../utils/tambola');

// Create a new instance of Tambola
const tambola = new Tambola();

module.exports = function (server) {
    const io = socketio(server);

    // Listen for new socket connections
    io.on('connection', socket => {
        console.log('New socket connection:', socket.id);

        // Listen for a new player joining the game
        socket.on('join', async (data) => {
            try {
                const { name, gameId } = data;

                // Find the game
                const game = await Game.findById(gameId);

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

        // Listen for the start game event
        socket.on('startGame', async (data) => {
            try {
                const { gameId } = data;

                // Find the game
                const game = await Game.findById(gameId);

                if (!game) {
                    return socket.emit('error', 'Game not found');
                }

                // Set the game status to 'in progress'
                game.status = 'in progress';
                await game.save();

                // Emit the game details with the updated status to all players in the game
                io.to(gameId).emit('gameDetails', { game });

                // Start the game by sending numbers to the players
                const players = await Player.find({ gameId });
                players.forEach(async (player) => {
                    const { ticket } = player;
                    const numbers = [];

                    // Get the next 90 numbers from the Tambola instance
                    for (let i = 0; i < 90; i++) {
                        const nextNumber = tambola.getNextNumber();
                        if (nextNumber === null) {
                            break;
                        }
                        numbers.push(nextNumber);
                    }

                    // Update the player's ticket with the numbers
                    ticket.numbers = numbers;

                    // Save the updated ticket to the database
                    await ticket.save();

                    // Emit the updated ticket to the player
                    socket.to(player.socketId).emit('ticket', ticket);
                });
            } catch (err) {
                console.error(err);
                socket.emit('error', err.message);
            }
        });

        // Listen for a number being called
        socket.on('numberCalled', async (data) => {
            try {
                const { gameId, number } = data;

                // Find the game
                const game = await Game.findById(gameId);

                if (!game) {
                    return socket.emit('error', 'Game not found');
                }

                // Add the number to the called numbers array
                game.calledNumbers.push(number);
                await game.save
                // Emit the updated game details to all players in the game
                io.to(gameId).emit('gameDetails', { game });

                // Check if any player has won
                const players = await Player.find({ gameId });
                players.forEach(async (player) => {
                    const { ticket } = player;

                    // Check if the player's ticket has all the called numbers
                    const hasWon = ticket.numbers.every(number => game.calledNumbers.includes(number));

                    if (hasWon && !player.hasWon) {
                        // Update the player's hasWon status and save to the database
                        player.hasWon = true;
                        await player.save();

                        // Emit the win event to the player and all other players in the game
                        socket.to(player.socketId).emit('win');
                        socket.to(gameId).broadcast.emit('playerWon', player);
                    }
                });
            } catch (err) {
                console.error(err);
                socket.emit('error', err.message);
            }
        });

        // Listen for the disconnect event
        socket.on('disconnect', async () => {
            console.log('Socket disconnected:', socket.id);

            try {
                // Find the player and remove them from the game
                const player = await Player.findOneAndRemove({ socketId: socket.id });
                if (player) {
                    // Broadcast the player left event to other players in the game
                    socket.to(player.gameId).broadcast.emit('playerLeft', player);
                }
            } catch (err) {
                console.error(err);
                socket.emit('error', err.message);
            }
        });
    });
};