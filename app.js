require('dotenv').config();
const express = require('express');
const app = express();
var tambola = require('tambola-generator');

const server = require('http').createServer(app);

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
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
    numbers: [[{
        value: Number,
        struck: { type: Boolean, default: false }
    }]],
    userName: String,
    room: String,
    ticketDate: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    userName: { type: String },
    room: String,
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

const categoryCardSchema = new mongoose.Schema({
    category: {
        type: [
            {
                category: { type: String, required: true },
                score: { type: Number, required: true },
                claimed: { type: Boolean, default: false }
            }
        ],
        default: [
            { category: 'EARLY_FIVE', score: 40, claimed: false },
            { category: 'EARLY_SEVEN', score: 30, claimed: false },
            { category: 'MIDDLE_NUMBER', score: 30, claimed: false },
            { category: 'FIRST_LINE', score: 20, claimed: false },
            { category: 'MIDDLE_LINE', score: 20, claimed: false },
            { category: 'LAST_LINE', score: 20, claimed: false },
            { category: 'CORNERS_1', score: 50, claimed: false },
            { category: 'STAR_1', score: 50, claimed: false },
            { category: 'FULL_HOUSE_1', score: 100, claimed: false },
            { category: 'CORNERS_2', score: 30, claimed: false },
            { category: 'STAR_2', score: 30, claimed: false },
            { category: 'FULL_HOUSE_2', score: 70, claimed: false }
        ]
    },
    room: { type: String, required: true }
});

const Chat = mongoose.model('Chat', chatSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const CalledNumbers = mongoose.model('CalledNumbers', calledNumbersSchema);
const User = mongoose.model('User', userSchema);
const CategoryCard = mongoose.model('CategoryCard', categoryCardSchema);

let categoryCard = {
    category: [
        { category: 'EARLY_FIVE', score: 40, claimed: false },
        { category: 'EARLY_SEVEN', score: 30, claimed: false },
        { category: 'MIDDLE_NUMBER', score: 30, claimed: false },
        { category: 'FIRST_LINE', score: 20, claimed: false },
        { category: 'MIDDLE_LINE', score: 20, claimed: false },
        { category: 'LAST_LINE', score: 20, claimed: false },
        { category: 'CORNERS_1', score: 50, claimed: false },
        { category: 'STAR_1', score: 50, claimed: false },
        { category: 'FULL_HOUSE_1', score: 100, claimed: false },
        { category: 'CORNERS_2', score: 30, claimed: false },
        { category: 'STAR_2', score: 30, claimed: false },
        { category: 'FULL_HOUSE_2', score: 70, claimed: false }
    ],
    room: ""
}

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

// Function to generate a random number within a given range
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to generate a Tambola ticket
function generateTambolaTicket() {
    const ticket = [];

    // Generate numbers for each column
    for (let column = 1; column <= 9; column++) {
        const columnNumbers = [];
        let minRange = (column - 1) * 10 + 1;
        let maxRange = column == 9 ? (column * 10) : (column * 10) - 1;

        // Generate numbers for each row in the column
        for (let row = 0; row < 3; row++) {
            let number = getRandomNumber(minRange, maxRange);

            // Check if the generated number is already present in the column
            while (columnNumbers.includes(number)) {
                number = getRandomNumber(minRange, maxRange);
            }

            columnNumbers.push(number);
        }

        ticket.push(columnNumbers);
    }

    // console.log("original Ticket ", ticket)

    ticket.forEach((item) => {
        item.sort((a, b) => a - b);
    })

    function transposeArray(array) {
        return array[0].map((_, columnIndex) => array.map(row => row[columnIndex]));
    }

    let transposedArray = transposeArray(ticket);
    // console.log("transposedArray 1", transposedArray);

    let nullSpots = [
        [[0, 3, 7, 8], [1, 4, 6, 8], [0, 1, 4, 5]],
        [[1, 2, 3, 7], [0, 4, 6, 8], [1, 2, 5, 6]],
        [[1, 2, 5, 7], [0, 3, 6, 8], [2, 4, 5, 6]],
        [[1, 2, 5, 6], [0, 3, 7, 8], [1, 4, 6, 8]],
        [[0, 2, 5, 7], [1, 3, 6, 8], [0, 4, 5, 6]],
        [[0, 4, 5, 8], [3, 6, 7, 8], [2, 5, 6, 7]],
        [[0, 2, 4, 7], [1, 3, 4, 6], [0, 1, 3, 5]],
        [[0, 2, 4, 7], [1, 3, 6, 8], [0, 4, 5, 6]],
        [[2, 3, 4, 6], [1, 2, 5, 6], [0, 1, 3, 4]],
        [[1, 2, 3, 4], [0, 1, 4, 7], [0, 2, 3, 5]],
        [[0, 1, 4, 8], [2, 3, 4, 6], [0, 2, 3, 5]],
        [[0, 1, 7, 8], [3, 4, 5, 7], [0, 2, 4, 5]],
    ]

    // pick a random nullSpots array
    let randomNo = Math.floor(Math.random() * nullSpots.length)
    console.log("nulspots index chosen", randomNo);
    for (let i = 0; i < transposedArray.length; i++) {
        let randomNullSpot = nullSpots[randomNo];
        transposedArray[i][randomNullSpot[i][0]] = null;
        transposedArray[i][randomNullSpot[i][1]] = null;
        transposedArray[i][randomNullSpot[i][2]] = null;
        transposedArray[i][randomNullSpot[i][3]] = null;

    }

    // console.log("transposedArray 2", transposedArray);
    let transposedBackArray = transposeArray(transposedArray);


    function displayTicket(array) {
        let output = '';
        for (let i = 0; i < array.length; i++) {
            for (let j = 0; j < array[i].length; j++) {
                const value = array[i][j];
                const formattedValue = value !== null ? value.toString().padStart(2, '0') : '  ';
                output += formattedValue + ' ';
            }
            output += '\n';
        }
        return output;
    }

    let ticket1 = displayTicket(transposedBackArray);
    console.log(ticket1);

    // // Count the total number of nulls in myArray
    // function countTotalNulls(arr) {
    //     let totalNulls = 0;
    //     for (let i = 0; i < arr.length; i++) {
    //         totalNulls += arr[i].filter((element) => element === null).length;
    //     }
    //     return totalNulls;
    // }

    // // Iterate until the total number of nulls is exactly 12
    // while (countTotalNulls(ticket) < 12) {
    //     let randomRowIndex = getRandomNumber(0, ticket.length - 1);
    //     let nullCount = ticket[randomRowIndex].filter((element) => element === null).length;
    //     if (nullCount < 2) {
    //         let randomColIndex = getRandomNumber(0, ticket[randomRowIndex].length - 1);
    //         if (ticket[randomRowIndex][randomColIndex] !== null) {
    //             ticket[randomRowIndex][randomColIndex] = null;
    //         }
    //     }
    // }



    // console.log(ticket);


    return transposedBackArray;
}


// let tambolaTicket = generateTambolaTicket();



// // Display the generated ticket
// console.log("Tambola Ticket:");
// for (let row = 0; row < 3; row++) {
//     let rowString = "";
//     for (let column = 0; column < 9; column++) {
//         if (tambolaTicket[column][row]) {
//             rowString += tambolaTicket[column][row] + "\t";
//         } else {
//             rowString += "\t";
//         }
//     }
//     console.log(rowString);
// }



let roomStates = {};

io.on('connection', async (socket) => {
    console.log('a user connected ', socket.id);

    // Join a room
    socket.on('join', async (payload) => {
        const { userName, room } = payload
        console.log("joined room ", room)
        socket.join(room)

        // check if user already exists in the database
        const userInDB = await User.findOne({ userName: userName, room: room })
        console.log("userInDB ", userInDB);
        if (!userInDB) {
            try {
                const user = new User({
                    userName: userName,
                    scoreCategory: [],
                    room: room
                })
                await user.save();
            } catch (error) {
                console.log("error in saving the User", error.message);
                io.to(room).emit('error', {
                    error: error.message
                })
            }
            // create a new user with userName

        }

        // check if categoryCard already exists in Database
        const categoryCardInDB = await CategoryCard.findOne({ room: room })
        if (!categoryCardInDB) {
            try {
                // create a new categoryCard 
                const categoryCard = new CategoryCard({
                    room: room
                })
                await categoryCard.save();
            } catch (error) {
                console.log(error);
            }

        }

        io.to(room).emit('join', {
            userName: userName,
            room: room
        });

    })

    socket.on('getTicket', async (payload) => {
        const { userName, room } = payload
        console.log("getTicket", userName, room)

        // check if user exists in the database
        const user = await User.findOne({ userName: userName, room: room })
        console.log("user in get ticket ", user)
        if (!user) {
            io.to(room).emit('error', {
                error: "User does not exist, please join a room"
            })
        } else {
            // check if a ticket exists with the userName and room in the database
            const ticket = await Ticket.findOne({ userName: userName, room: room })
            if (!ticket) {
                let randomNumbers = generateTambolaTicket();

                // save numbers along with userName to the database
                const ticket = new Ticket({
                    userName: userName,
                    numbers: randomNumbers.map(row => row.map(element => {
                        return { value: element, struck: false };
                    })),
                    room: room
                })

                try {
                    await ticket.save();

                    // get all tickets in the room
                    const tickets = await Ticket.find({ room: room })

                    // get all the userNames in tickets and put in an array
                    const allUserNames = tickets.map((ticket) => ticket.userName)
                    console.log("allUserNames ", allUserNames)

                    // get all users
                    const allUsers = await User.find({ room: room })
                    console.log("allUsers ", allUsers)

                    io.to(room).emit('private', {
                        userName: userName,
                        numbers: randomNumbers,
                        allUsers: allUsers
                    });
                } catch (error) {
                    console.log("erron in saving ticket ", error)
                }
            } else {
                // // get all tickets in the room
                // const tickets = await Ticket.find({ room: room })

                // // get all the userNames in tickets and put in an array
                // const allUserNames = tickets.map((ticket) => ticket.userName)
                // console.log("allUserNames ", allUserNames)
                // get ticket based on userName
                const ticket = await Ticket.findOne({ userName: userName, room: room })

                // get all users
                const allUsers = await User.find({ room: room })
                console.log("allUsers ", allUsers)

                io.to(room).emit('private', {
                    userName: userName,
                    numbers: ticket.numbers.map(row => row.map(obj => obj.value)),
                    allUsers: allUsers
                });
            }
        }


    })
    let intervalId;
    
    socket.on('callNumbers', async (payload) => {
        const { userName, room, timeInterval } = payload;
        console.log("room in callNumbers", room);
        let calledNumbers = [];

        intervalId = setInterval(async () => {
            if (roomStates[room] && roomStates[room].isPaused) {
                return; // Skip emitting numbers if paused for this room
            }

            let randomNumber;

            do {
                randomNumber = Math.floor(Math.random() * 90) + 1;
            } while (calledNumbers.includes(randomNumber));

            calledNumbers.push(randomNumber);
            console.log("randomNumber ", randomNumber);

            const calledNumbersInDB = await CalledNumbers.findOne({ room: room });
            if (calledNumbersInDB) {
                calledNumbersInDB.numbers.push(randomNumber);
                console.log("calledNumbers ", calledNumbersInDB);
                await CalledNumbers.findOneAndUpdate({ room: room }, { numbers: calledNumbersInDB.numbers });
            } else {
                const newCalledNumbers = new CalledNumbers({
                    numbers: [randomNumber],
                    room: room
                });
                await newCalledNumbers.save();
            }

            io.to(room).emit('calledNumber', calledNumbers);

            if (calledNumbers.length >= 90) {
                clearInterval(intervalId);
            }
        }, timeInterval || 500);
    });

    socket.on('stopCall', () => {
        clearInterval(intervalId);
        delete roomStates[room];
    });

    socket.on('pauseCall', (payload) => {
        const { room } = payload;
        roomStates[room] = { isPaused: true };
    });

    socket.on('resumeCall', (payload) => {
        const { room } = payload;
        roomStates[room] = { isPaused: false };
    });

    socket.on('struckNumber', async (payload) => {
        const { number, userName, room } = payload
        // check if the number is in calledNumbers in database
        try {
            const calledNumbers = await CalledNumbers.findOne({ room: room })
            if (calledNumbers) {
                console.log("calledNumbers in db for (struck number)", calledNumbers)
                console.log("struck number exists, ", calledNumbers.numbers.includes(number))
                if (calledNumbers.numbers.includes(number)) {
                    console.log("struck number exists, ", calledNumbers.numbers.includes(number))
                    const userTicket = await Ticket.findOne({ userName: userName, room: room })
                    if (userTicket) {
                        for (let i = 0; i < userTicket.numbers.length; i++) {
                            for (let j = 0; j < userTicket.numbers[i].length; j++) {
                                if (userTicket.numbers[i][j].value === number) {
                                    userTicket.numbers[i][j].struck = true;
                                    break;
                                }
                            }
                        }

                        await Ticket.findOneAndUpdate({ userName: userName, room: room }, { numbers: userTicket.numbers })
                        io.to(room).emit('struckNumber', { number: number, userName: userName });
                    }
                }
            }
        } catch (error) {
            console.log(error)
        }

    })



    socket.on('category', async (payload) => {
        const { userName, room, scoreCategory } = payload
        console.log("category payload ", payload)

        // get the categoryCard and update the category claim
        const categoryCard = await CategoryCard.findOne({ room: room })
        console.log("categoryCard ", categoryCard)
        if (categoryCard) {
            if (categoryCard.category.find((item) => item.category === scoreCategory.category).claimed === false) {
                categoryCard.category.find((item) => item.category === scoreCategory.category).claimed = true
                console.log("upadated categoryCard ", categoryCard)
                await CategoryCard.findOneAndUpdate({ room: room }, { category: categoryCard.category })

                // Get the user and update the scoreCategory array 
                const user = await User.findOne({ userName: userName, room: room })
                console.log("user ", user)
                if (user) {
                    if (!user.scoreCategory.includes(scoreCategory)) {
                        user.scoreCategory.push(scoreCategory)
                        // get all the scores in the scoreCategory array and add the score
                        let score = user.scoreCategory.reduce((accumulator, currentValue) => {
                            return accumulator + currentValue.score;
                        }, 0);
                        console.log("score ", score)
                        // update score in user
                        await User.findOneAndUpdate({ userName: userName, room: room }, { scoreCategory: user.scoreCategory, score: score })
                        console.log("user updated")
                        // get all users
                        const allUsers = await User.find({ room: room })
                        io.to(room).emit('category', { userName: userName, scoreCategory: user.scoreCategory, score: score, categoryCard: categoryCard, allUsers: allUsers })
                    }
                } else {
                    console.log("user not found")
                }
            }

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

server.listen(process.env.PORT || 5000, () => {
    console.log('listening on port 5000');
})



