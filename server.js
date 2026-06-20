const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // السماح لجميع الواجهات بالاتصال بالسيرفر
        methods: ["GET", "POST"]
    }
});

// قاعدة بيانات مؤقتة في الذاكرة لحفظ الغرف واللاعبين
let rooms = {}; 

// دالة لإنشاء علبة ورق جديدة وخلطها بشكل آمن في السيرفر
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

// مراقبة اتصالات اللاعبين الفورية
io.on('connection', (socket) => {
    console.log(`لاعب متصل الآن برقم معرف: ${socket.id}`);

    // عندما يطلب اللاعب الانضمام لغرفة لعب (طاولة أونلاين)
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

        // إضافة اللاعب إلى الطاولة إذا كان هناك مكان (الحد الأقصى 5 لاعبين مثلاً)
        if (rooms[roomId].players.length < 5) {
            rooms[roomId].players.push({
                id: socket.id,
                name: playerName,
                chips: 1000, // رصيد افتراضي يبدأ به اللاعب حتى يشحن USDT
                cards: []
            });
        }

        // تحديث جميع اللاعبين في الغرفة بالشكل الجديد للطاولة واللاعبين المتواجدين
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
    });

    // عند بدء جولة جديدة (توزيع الأوراق سرياً)
    socket.on('startRound', (roomId) => {
        if (rooms[roomId]) {
            let room = rooms[roomId];
            room.deck = createAndShuffleDeck();
            room.communityCards = [room.deck.pop(), room.deck.pop(), room.deck.pop()]; // الـ Flop

            // توزيع ورقتين لكل لاعب بشكل سري مخصص له فقط لحمايتها من الكشف
            room.players.forEach(player => {
                player.cards = [room.deck.pop(), room.deck.pop()];
                io.to(player.id).emit('yourCards', player.cards); // إرسال الأوراق لصاحبها فقط
            });

            // إرسال أوراق الطاولة العامة للجميع
            io.to(roomId).emit('roundStarted', {
                communityCards: room.communityCards,
                pot: room.pot
            });
        }
    });

    // عند قيام لاعب بحركة (Call, Fold, Raise)
    socket.on('playerAction', ({ roomId, action, amount }) => {
        if (rooms[roomId]) {
            // هنا يتم حساب المنطق الرياضي للرهانات وتحديث الـ Pot
            // وتمرير الدور للاعب التالي تلقائياً وبث الحركة فوراً لجميع الهواتف
            io.to(roomId).emit('actionBroadcast', { playerId: socket.id, action, amount });
        }
    });

    // عند خروج اللاعب أو قطع الاتصال
    socket.on('disconnect', () => {
        console.log(`لاعب قطع الاتصال: ${socket.id}`);
        // تنظيف الغرف وحذف اللاعب لكي لا تتجمد الطاولة
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`سيرفر البوكر الاحترافي يعمل الآن على المنفذ: ${PORT}`);
});
