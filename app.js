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

// Room states will be stored in memory instead of MongoDB
// This will be our in-memory database for the game state
const roomStates = {};

const categoryCard = {
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



io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join', async (payload) => {
        const { userName, room, isHost } = payload;
        console.log("join", userName, room, "isHost:", isHost);

        try {
            // Initialize room state if it doesn't exist
            if (!roomStates[room]) {
                roomStates[room] = {
                    isPaused: false,
                    calledNumbers: [],
                    users: [],
                    host: null, // Store the host username
                    categoryCard: JSON.parse(JSON.stringify(categoryCard))
                };
                roomStates[room].categoryCard.room = room;
            }
            
            // Check if this user is claiming to be the host
            if (isHost === true) {
                // If there's no host yet or this user is already the host, set them as host
                if (!roomStates[room].host || roomStates[room].host === userName) {
                    console.log(`Setting ${userName} as host for room ${room}`);
                    roomStates[room].host = userName;
                }
            }
            
            // If this is the first user to join and no host is set, make them the host
            if (!roomStates[room].host && roomStates[room].users.length === 0) {
                console.log(`Setting first user ${userName} as host for room ${room}`);
                roomStates[room].host = userName;
            }
            
            // Add user to room state if not already there
            if (!roomStates[room].users.some(user => user.userName === userName)) {
                roomStates[room].users.push({
                    userName: userName,
                    room: room,
                    score: 0,
                    scoreCategory: []
                });
            }

            // Store the username in the socket data
            socket.data.userName = userName;
            socket.data.room = room;
            
            // Join the room
            socket.join(room);

            // Emit the join event to the user
            socket.emit('join', { 
                userName: userName, 
                room: room, 
                host: roomStates[room].host, // Include the host in the response
                allUsers: roomStates[room].users, 
                calledNumbers: roomStates[room].calledNumbers 
            });
            
            // Notify other users in the room that a new user has joined
            socket.to(room).emit('userJoined', { 
                userName: userName, 
                allUsers: roomStates[room].users 
            });
        } catch (error) {
            console.error("Error in join:", error);
            socket.emit('error', { message: "Error joining room" });
        }
    });

    socket.on('getTicket', async (payload) => {
        const { userName, room, hasStoredTicket } = payload;
        console.log("getTicket", userName, room, "hasStoredTicket:", hasStoredTicket);

        try {
            // Join the room
            socket.join(room);
            
            // Store the username in the socket data
            socket.data.userName = userName;
            socket.data.room = room;
            
            // Initialize room state if it doesn't exist
            if (!roomStates[room]) {
                roomStates[room] = {
                    isPaused: false,
                    calledNumbers: [],
                    users: [],
                    userTickets: {}, // Store user tickets here
                    categoryCard: JSON.parse(JSON.stringify(categoryCard))
                };
                roomStates[room].categoryCard.room = room;
            }
            
            // Add user to room state if not already there
            if (!roomStates[room].users.some(user => user.userName === userName)) {
                roomStates[room].users.push({
                    userName: userName,
                    room: room,
                    score: 0,
                    scoreCategory: []
                });
            }
            
            // Check if we need to generate a new ticket
            let ticketNumbers;
            
            // If the user says they have a stored ticket, don't generate a new one
            // Or if we have a ticket stored for this user in roomStates
            if (hasStoredTicket) {
                console.log("User has stored ticket, not generating a new one");
                // Just send back the current state without a new ticket
                // The client will use their stored ticket
                socket.emit('private', {
                    userName: userName,
                    useStoredTicket: true,
                    allUsers: roomStates[room].users,
                    calledNumbers: roomStates[room].calledNumbers
                });
                return;
            }
            
            // Generate a new ticket
            ticketNumbers = generateTambolaTicket();
            
            // Store the ticket in roomStates for this user
            if (!roomStates[room].userTickets) {
                roomStates[room].userTickets = {};
            }
            roomStates[room].userTickets[userName] = ticketNumbers;
            
            // Emit the ticket to the user
            socket.emit('private', {
                userName: userName,
                numbers: ticketNumbers,
                allUsers: roomStates[room].users,
                calledNumbers: roomStates[room].calledNumbers
            });
        } catch (error) {
            console.error("Error in getTicket:", error);
            socket.emit('error', { message: "Error getting ticket" });
        }
    });

    let intervalId;

    socket.on('callNumbers', async (payload) => {
        const { room, timeInterval } = payload;
        console.log("callNumbers", room);

        // Check if there's already an interval running for this room
        if (intervalId) {
            clearInterval(intervalId);
        }

        // Initialize roomStates for this room if it doesn't exist
        if (!roomStates[room]) {
            roomStates[room] = { 
                isPaused: false,
                calledNumbers: [],
                users: [],
                categoryCard: JSON.parse(JSON.stringify(categoryCard))
            };
            roomStates[room].categoryCard.room = room;
        }

        // Set up the interval to call numbers
        intervalId = setInterval(() => {
            // Check if the game is paused
            if (roomStates[room] && roomStates[room].isPaused) {
                return;
            }

            // Generate a random number between 1 and 90
            let randomNumber;
            do {
                randomNumber = Math.floor(Math.random() * 90) + 1;
            } while (roomStates[room].calledNumbers.includes(randomNumber));

            try {
                // Add the random number to the called numbers
                roomStates[room].calledNumbers.push(randomNumber);
                console.log("Called number:", randomNumber);

                // Emit the updated called numbers to all users in the room
                io.to(room).emit('calledNumber', roomStates[room].calledNumbers);
                
                // Stop calling numbers if all 90 numbers have been called
                if (roomStates[room].calledNumbers.length >= 90) {
                    clearInterval(intervalId);
                }
            } catch (error) {
                console.error("Error in callNumbers:", error);
            }
        }, timeInterval || 5000); // Call a number every 5 seconds by default
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
        const { number, userName, room } = payload;
        
        try {
            // Check if room state exists
            if (!roomStates[room]) {
                console.log("Room state doesn't exist for room:", room);
                return;
            }
            
            // Check if the number is in calledNumbers
            if (roomStates[room].calledNumbers.includes(number)) {
                console.log("Struck number exists in called numbers:", number);
                
                // We don't need to update any ticket in the backend
                // The frontend will handle updating the struck numbers in localStorage
                
                // Just relay the struck number event to all users in the room
                io.to(room).emit('struckNumber', { number: number, userName: userName });
            } else {
                console.log("Number not found in called numbers:", number);
            }
        } catch (error) {
            console.error("Error in struckNumber:", error);
        }
    });

    socket.on('category', async (payload) => {
        const { userName, room, scoreCategory } = payload;
        console.log("category payload ", payload);

        try {
            // Check if room state exists
            if (!roomStates[room]) {
                console.log("Room state doesn't exist for room:", room);
                return;
            }
            
            // Get the category card from room state
            const categoryCard = roomStates[room].categoryCard;
            
            // Check if the category exists and is not already claimed
            const categoryItem = categoryCard.category.find(item => item.category === scoreCategory.category);
            
            if (categoryItem && !categoryItem.claimed) {
                // Mark the category as claimed
                categoryItem.claimed = true;
                console.log("Updated categoryCard ", categoryCard);
                
                // Find the user in the room state
                const userIndex = roomStates[room].users.findIndex(user => user.userName === userName);
                
                if (userIndex !== -1) {
                    const user = roomStates[room].users[userIndex];
                    
                    // Check if the user has already claimed this category
                    const alreadyClaimed = user.scoreCategory && 
                                          user.scoreCategory.some(item => item.category === scoreCategory.category);
                    
                    if (!alreadyClaimed) {
                        // Initialize scoreCategory array if it doesn't exist
                        if (!user.scoreCategory) {
                            user.scoreCategory = [];
                        }
                        
                        // Add the category to the user's claimed categories
                        user.scoreCategory.push(scoreCategory);
                        
                        // Calculate the user's score
                        let score = user.scoreCategory.reduce((accumulator, currentValue) => {
                            return accumulator + currentValue.score;
                        }, 0);
                        
                        // Update the user's score
                        user.score = score;
                        console.log("User updated with score:", score);
                        
                        // Emit the updated category information to all users in the room
                        io.to(room).emit('category', { 
                            userName: userName, 
                            scoreCategory: user.scoreCategory, 
                            score: score, 
                            categoryCard: categoryCard, 
                            allUsers: roomStates[room].users 
                        });
                    }
                } else {
                    console.log("User not found in room state:", userName);
                }
            } else {
                console.log("Category already claimed or doesn't exist:", scoreCategory.category);
            }
        } catch (error) {
            console.error("Error in category:", error);
        }
    });

    // Listen for a chat message
    socket.on('chat', async (payload) => {
        const { room, message, userName } = payload;
        console.log("room, message, userName ", room, message, userName);
        
        try {
            // Just relay the chat message to all users in the room
            // No need to save to database
            io.to(room).emit('chat', payload);
        } catch (error) {
            console.error("Error in chat:", error);
        }
    });


    // Listen for disconnections
    socket.on('disconnect', () => {
        console.log('A user disconnected.');
        
        // If the user was in a room, remove them from the room state
        if (socket.data && socket.data.room && socket.data.userName) {
            const room = socket.data.room;
            const userName = socket.data.userName;
            
            if (roomStates[room]) {
                // Remove the user from the room state
                roomStates[room].users = roomStates[room].users.filter(user => user.userName !== userName);
                
                // Notify other users in the room that this user has disconnected
                socket.to(room).emit('userLeft', { 
                    userName: userName, 
                    allUsers: roomStates[room].users 
                });
                
                // If the room is empty, clean up the room state
                if (roomStates[room].users.length === 0) {
                    delete roomStates[room];
                }
            }
        }
    });


    // Add a pauseCall event handler
    socket.on('pauseCall', (payload) => {
        const { room } = payload;
        if (roomStates[room]) {
            roomStates[room].isPaused = true;
        }
    });
    
    // Add a resumeCall event handler
    socket.on('resumeCall', (payload) => {
        const { room } = payload;
        if (roomStates[room]) {
            roomStates[room].isPaused = false;
        }
    });
    
    // Add a stopCall event handler
    socket.on('stopCall', () => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });
});

server.listen(process.env.PORT || 5000, () => {
    console.log('listening on port 5000');
})


