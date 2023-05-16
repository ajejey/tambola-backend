import React from 'react'
import io from 'socket.io-client'
import { nanoid } from 'nanoid'

const socket = io("http://localhost:5000")
const userName = nanoid(4)
const room1 = nanoid(6)
const scoreCategories = [
    { category: 'EARLY_FIVE', score: 40 },
    { category: 'EARLY_SEVEN', score: 30 },
    { category: 'MIDDLE_NUMBER', score: 30 },
    { category: 'FIRST_LINE', score: 20 },
    { category: 'MIDDLE_LINE', score: 20 },
    { category: 'LAST_LINE', score: 20 },
    { category: 'CORNERS_1', score: 50 },
    { category: 'STAR_1', score: 50 },
    { category: 'FULL_HOUSE_1', score: 100 },
    { category: 'CORNERS_2', score: 30 },
    { category: 'STAR_2', score: 30 },
    { category: 'FULL_HOUSE_2', score: 70 }
]

function App() {
    const [message, setMessage] = React.useState('')
    const [chat, setChat] = React.useState([])
    const [currentRoom, setCurrentRoom] = React.useState('')
    const [numbers, setNumbers] = React.useState([])
    const [calledNumbers, setCalledNumbers] = React.useState([])
    const [struckNumbers, setStruckNumbers] = React.useState([])
    const [scoredCategories, setScoredCategories] = React.useState([])
    const [voiceNumber, setVoiceNumber] = React.useState('')

    console.log("chat", chat)

    function numberToString(number) {
        const numberString = String(number);
        const numberWords = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
        const specialNumberWords = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tensWords = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        let outputString = '';

        if (number > 0 && number < 10) {
            outputString = `Single Number ${numberString[0]}`;
            console.log(outputString);
            return outputString;
        }

        if (number == 10) {
            outputString = 'One Zero. Ten.';
            console.log(outputString);
            return outputString;
        }

        if (number > 10 && number < 20) {
            outputString = `${numberString[0]} ${numberString[1]}. ${specialNumberWords[number - 10]}.`;
            console.log(outputString);
            return outputString;
        }

        if (number % 10 === 0 && number >= 20 && number < 100) {
            outputString = `${numberString[0]} ${numberString[1]}. ${tensWords[Number(numberString[0])]}`;
            console.log(outputString);
            return outputString;
        }

        if (number > 20 && number < 100) {
            outputString = `${numberString[0]} ${numberString[1]}. ${tensWords[Number(numberString[0])]} ${Number(numberString[1])}`;
            console.log(outputString);
            return outputString;
        }
    }


    const handleVoiceNumberClick = () => {
        const utterance = new SpeechSynthesisUtterance(numberToString(voiceNumber));

        // Get the available voices
        const voices = speechSynthesis.getVoices();
        // voices.forEach(voice => console.log(voice.name));


        // Set the desired voice
        utterance.voice = voices.find(voice => voice.name === 'Google UK English Female');

        // Speak the utterance
        speechSynthesis.speak(utterance);


    }

    const handleCategoryClick = (category) => {
        console.log("category clicked", category)
        socket.emit('category', { scoreCategory: category, userName: userName, room: room1 })
    }

    const handleNumberClick = (number) => {
        console.log("clicked number ", number)
        socket.emit('struckNumber', { number, userName, room: currentRoom })
    }

    const handleStartCallNumber = () => {
        socket.emit('callNumbers', { userName: userName, room: currentRoom })
    }

    const handleJoinRoom = (e) => {

        setCurrentRoom(room1)
        socket.emit('join', { room: room1, userName: userName })
    }

    const sendChat = (e) => {
        e.preventDefault()
        socket.emit('chat', { message: message, userName: userName, room: currentRoom })
        setMessage('')
    }

    React.useEffect(() => {

        socket.on('chat', (payload) => {
            console.log("payload", payload)
            setChat([...chat, payload])
        })

        // Handle receiving private messages
        socket.on('private', (msg) => {
            // Handle the private message received from the server
            console.log('Private message:', msg);
            console.log(msg.userName, userName)
            if (msg.userName === userName) {
                setNumbers([...numbers, ...msg.numbers])
            }
        });

        socket.on('calledNumber', (payload) => {
            setCalledNumbers([...calledNumbers, payload])
        })

        socket.on('struckNumber', (payload) => {
            console.log("struckNumber", payload?.number)
            if (payload.userName === userName) {
                setStruckNumbers([...struckNumbers, payload?.number])
            }
        })

        socket.on('category', (payload) => {
            console.log("category", payload)
            if (payload.userName === userName) {
                setScoredCategories([...scoredCategories, ...payload.scoreCategory.map((item) => item.category)])
            }
        })

    })

    console.log("scoredCategories", scoredCategories)

    return (
        <div>
            <h1>My Chat App</h1>
            <h3>My Room : {currentRoom}</h3>
            <h3>User Name : {userName}</h3>

            {numbers.map((item) => (
                <p key={item} onClick={() => handleNumberClick(item)} style={{ display: 'inline-block', marginRight: '10px', cursor: 'pointer', textDecoration: struckNumbers.includes(item) ? 'line-through' : '' }}>
                    {item}
                </p>
            ))}


            {chat.map((message, index) => (
                <p key={index} >
                    <span>{message.userName}: </span>
                    <span>{message.message}</span>
                </p>
            ))}
            <form onSubmit={sendChat}>
                <input value={message} onChange={(e) => setMessage(e.target.value)} />
                <button type="submit" >Send</button>
            </form>
            <div style={{ marginTop: '20px' }} >
                <button onClick={handleJoinRoom} >Join Room 1</button>
                {/* <button name="room2" onClick={handleJoinRoom} >Join Room 2</button>
                <button name="room3" onClick={handleJoinRoom} >Join Room 3</button> */}
            </div>

            <div style={{ margin: '20px' }} >
                <button onClick={handleStartCallNumber} >Start number call</button>
            </div>
            <div style={{ margin: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {scoreCategories.map((item, index) => (
                    <button key={index} style={{ backgroundColor: scoredCategories.includes(item.category) ? 'green' : '' }} onClick={() => handleCategoryClick(item)} >{item.category}</button>
                ))}
            </div>
            {calledNumbers.map((item) => (
                <p key={item} style={{ display: 'inline-block', marginRight: '10px' }}>
                    {item}
                </p>
            ))}
            <div style={{ margin: '20px' }}>
                <input onChange={(e) => setVoiceNumber(e.target.value)} type="number" name="" id="" />
                <button onClick={handleVoiceNumberClick}>Call</button>
            </div>
        </div>
    )
}

export default App