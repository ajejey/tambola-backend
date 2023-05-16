require('dotenv').config();
const express = require('express');
const app = express();

const server = require('http').createServer(app);

const io = require('socket.io')(server, {
    cors: {
        origin: '*'
    }
});

// mongoDB connection
const MONGODB_URI = process.env.MONGODB_URI
const mongoose = require('mongoose');
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})

const chatSchema = new mongoose.Schema({
    userName: String,
    message: String,
    room: String,
    messageDate: { type: Date, default: Date.now }
})

const ticketSchema = new mongoose.Schema({
    numbers: [{
        value: Number,
        struck: { type: Boolean, default: false }
    }],
    userName: String,
    room: String,
    ticketDate: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    userName: String,
    winStatus: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    scoreCategory: [{
        category: { type: String },
        score: { type: Number }
    }]
});


const calledNumbersSchema = new mongoose.Schema({
    numbers: [Number],
    room: String,
})

const Chat = mongoose.model('Chat', chatSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const CalledNumbers = mongoose.model('CalledNumbers', calledNumbersSchema);
const User = mongoose.model('User', userSchema);

const scoreCategories = [
    { category: 'EARLY_FIVE', score: 40, description: 'First five numbers marked' },
    { category: 'EARLY_SEVEN', score: 30, description: 'First seven numbers marked' },
    { category: 'MIDDLE_NUMBER', score: 30, description: 'Middle number marked' },
    { category: 'FIRST_LINE', score: 20, description: 'First line completed' },
    { category: 'MIDDLE_LINE', score: 20, description: 'Middle line completed' },
    { category: 'LAST_LINE', score: 20, description: 'Last line completed' },
    { category: 'CORNERS_1', score: 50, description: 'First set of corner numbers marked' },
    { category: 'STAR_1', score: 50, description: 'Star pattern completed (Set 1)' },
    { category: 'FULL_HOUSE_1', score: 100, description: 'Full house completed (Set 1)' },
    { category: 'CORNERS_2', score: 30, description: 'Second set of corner numbers marked' },
    { category: 'STAR_2', score: 30, description: 'Star pattern completed (Set 2)' },
    { category: 'FULL_HOUSE_2', score: 70, description: 'Full house completed (Set 2)' }
]


io.on('connection', async (socket) => {
    console.log('a user connected ', socket.id);

    // Join a room
    socket.on('join', async (payload) => {
        const { userName, room } = payload
        socket.join(room)
        // get 15 random numbers from 1 to 90
        const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
        const shuffledNumbers = numbers.sort(() => Math.random() - 0.5);
        const randomNumbers = shuffledNumbers.slice(0, 15);
        console.log("randomNumbers ", randomNumbers)
        console.log("joined room ", room)

        // save numbers along with userName to the database
        const ticket = new Ticket({
            userName: userName,
            numbers: randomNumbers.map((value) => ({ value, struck: false })),
            room: room
        })

        // create a new user with userName
        const user = new User({
            userName: userName,
            scoreCategory: [],
        })

        try {
            await ticket.save();
            await user.save();

            // get all tickets in the room
            const tickets = await Ticket.find({ room: room })

            // get all the userNames in tickets and put in an array
            const allUserNames = tickets.map((ticket) => ticket.userName)
            console.log("allUserNames ", allUserNames)

            io.to(room).emit('private', {
                userName: userName,
                numbers: randomNumbers,
                allUserNames: allUserNames
            });
        } catch (error) {
            console.log("erron in saving ticket ", error)
        }
    })

    socket.on('callNumbers', async (payload) => {
        const { userName, room, timeInterval } = payload
        // Create an array to store the numbers that have already been called
        let calledNumbers = [];

        // Emit random numbers from 1 to 90 to the user in 1 second intervals, stopping after 90 numbers have been called
        const intervalId = setInterval(async () => {
            let randomNumber;

            // Generate a random number that hasn't already been called
            do {
                randomNumber = Math.floor(Math.random() * 90) + 1;
            } while (calledNumbers.includes(randomNumber));

            // Add the number to the called numbers array
            calledNumbers.push(randomNumber);
            console.log("randomNumber ", randomNumber)

            const calledNumbersInDB = await CalledNumbers.findOne({ room: room })
            if (calledNumbersInDB) {
                // update the array numbers in calledNumbers
                calledNumbersInDB.numbers.push(randomNumber)
                console.log("calledNumbers ", calledNumbersInDB)
                await CalledNumbers.findOneAndUpdate({ room: room }, { numbers: calledNumbersInDB.numbers })
            } else {
                const newCalledNumbers = new CalledNumbers({
                    numbers: [randomNumber],
                    room: room
                })
                await newCalledNumbers.save();
            }


            // Emit the number to the user
            io.to(room).emit('calledNumber', randomNumber);

            // Stop emitting numbers after 90 have been called
            if (calledNumbers.length >= 90) {
                clearInterval(intervalId);
            }
        }, timeInterval || 500);
    });

    socket.on('struckNumber', async (payload) => {
        const { number, userName, room } = payload
        // check if the number is in calledNumbers in database
        const calledNumbers = await CalledNumbers.findOne({ room: room })
        if (calledNumbers) {
            console.log("calledNumbers in db for (struck number)", calledNumbers)
            console.log("struck number exists, ", calledNumbers.numbers.includes(number))
            if (calledNumbers.numbers.includes(number)) {
                console.log("struck number exists, ", calledNumbers.numbers.includes(number))
                const userTicket = await Ticket.findOne({ userName: userName, room: room })
                if (userTicket) {
                    userTicket.numbers.forEach((item, index) => {
                        if (item.value === number) {
                            userTicket.numbers[index].struck = true;
                        }
                    })
                    await Ticket.findOneAndUpdate({ userName: userName, room: room }, { numbers: userTicket.numbers })
                    io.to(room).emit('struckNumber', { number: number, userName: userName });
                }
            }
        }
    })

    socket.on('category', async (payload) => {
        const { userName, room, scoreCategory } = payload
        console.log("category payload ", payload)
        // Get the user and update the scoreCategory array 
        const user = await User.findOne({ userName: userName })
        console.log("user ", user)
        if (user) {
            user.scoreCategory.push(scoreCategory)
            // get all the scores in the scoreCategory array and add the score
            let score = user.scoreCategory.reduce((accumulator, currentValue) => {
                return accumulator + currentValue.score;
            }, 0);
            console.log("score ", score)
            // update score in user
            await User.findOneAndUpdate({ userName: userName }, { scoreCategory: user.scoreCategory, score: score })
            console.log("user updated")
            io.to(room).emit('category', { userName: userName, scoreCategory: user.scoreCategory, score: score })
        } else {
            console.log("user not found")
        }

    })

    // Listen for a chat message
    socket.on('chat', async (payload) => {
        const { room, message, userName } = payload;
        console.log("room, message, userName ", room, message, userName)
        let chat = new Chat({
            userName: userName,
            message: message,
            room: room
        })
        try {
            await chat.save();
            io.to(room).emit('chat', payload);
        } catch (error) {
            console.error(error);
        }

    })


    // Listen for disconnections
    socket.on('disconnect', () => {
        console.log('A user disconnected.');
    });


    // socket.on('chat', async (payload) => {
    //     console.log("payload", payload);
    //     const chat = new Chat({
    //         userName: payload.userName,
    //         message: payload.message
    //     });

    //     try {
    //         await chat.save();
    //         io.emit('chat', payload);
    //     } catch (err) {
    //         console.error('Error saving chat message:', err);
    //     }
    // });
});

server.listen(5000, () => {
    console.log('listening on port 5000');
})



