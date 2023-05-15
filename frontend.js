import React from 'react'
import io from 'socket.io-client'
import { nanoid } from 'nanoid'

const socket = io("http://localhost:5000")
const userName = nanoid(4)
const room1 = nanoid(6)

function App() {
    const [message, setMessage] = React.useState('')
    const [chat, setChat] = React.useState([])
    const [currentRoom, setCurrentRoom] = React.useState('')
    const [numbers, setNumbers] = React.useState([])
    const [calledNumbers, setCalledNumbers] = React.useState([])
    const [struckNumbers, setStruckNumbers] = React.useState([])

    console.log("chat", chat)

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

    })

    return (
        <div>
            <h1>My Chat App</h1>
            <h3>My Room : {currentRoom}</h3>

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
            {calledNumbers.map((item) => (
                <p key={item} style={{ display: 'inline-block', marginRight: '10px' }}>
                    {item}
                </p>
            ))}
        </div>
    )
}

export default App