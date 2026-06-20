const express = require('express');
const http = require('http');
const cors = require('cors'); // استدعاء مكتبة الأمان الجديدة
const { Server } = require('socket.io');

const app = express();
app.use(cors()); // تفعيل السماح لجميع التطبيقات بالاتصال

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

let rooms = {}; 

function createAndShuffleDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ value, suit });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

io.on('connection', (socket) => {
    console.log(`لاعب متصل: ${socket.id}`);

    socket.on('joinRoom', ({ roomId, playerName }) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                deck: createAndShuffleDeck(),
                communityCards: [],
                pot: 0,
                currentTurn: 0
            };
        }

        if (rooms[roomId].players.length < 5) {
            rooms[roomId].players.push({
                id: socket.id,
                name: playerName,
                chips: 1000, 
                cards: []
            });
        }

        io.to(roomId).emit('roomUpdate', rooms[roomId]);
    });

    socket.on('startRound', (roomId) => {
        if (rooms[roomId]) {
            let room = rooms[roomId];
            room.deck = createAndShuffleDeck();
            room.communityCards = [room.deck.pop(), room.deck.pop(), room.deck.pop()]; 

            room.players.forEach(player => {
                player.cards = [room.deck.pop(), room.deck.pop()];
                io.to(player.id).emit('yourCards', player.cards); 
            });

            io.to(roomId).emit('roundStarted', {
                communityCards: room.communityCards,
                pot: room.pot
            });
        }
    });

    socket.on('playerAction', ({ roomId, action, amount }) => {
        if (rooms[roomId]) {
            io.to(roomId).emit('actionBroadcast', { playerId: socket.id, action, amount });
        }
    });

    socket.on('disconnect', () => {
        console.log(`لاعب قطع الاتصال: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ: ${PORT}`);
});
