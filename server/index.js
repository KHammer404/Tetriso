const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', ({ username, roomCode }) => {
        socket.join(roomCode);
        
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, { players: [], gameStarted: false });
        }
        
        const room = rooms.get(roomCode);
        const player = { id: socket.id, username, board: null, alive: true };
        room.players.push(player);

        io.to(roomCode).emit('roomUpdate', room.players);
        console.log(`${username} joined room ${roomCode}`);
    });

    socket.on('updateBoard', ({ roomCode, board }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.board = board;
            // Broadcast only to others to save bandwidth
            socket.to(roomCode).emit('opponentBoardUpdate', { id: socket.id, board });
        }
    });

    socket.on('sendGarbage', ({ roomCode, amount, targetId }) => {
        // Simple targeting: if no targetId, send to someone random
        if (targetId) {
            io.to(targetId).emit('receiveGarbage', { amount, from: socket.id });
        } else {
            const room = rooms.get(roomCode);
            const opponents = room.players.filter(p => p.id !== socket.id && p.alive);
            if (opponents.length > 0) {
                const target = opponents[Math.floor(Math.random() * opponents.length)];
                io.to(target.id).emit('receiveGarbage', { amount, from: socket.id });
            }
        }
    });

    socket.on('gameOver', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.alive = false;
            const aliveCount = room.players.filter(p => p.alive).length;
            io.to(roomCode).emit('playerKO', { id: socket.id, rank: aliveCount + 1 });
            
            if (aliveCount <= 1) {
                const winner = room.players.find(p => p.alive);
                io.to(roomCode).emit('gameEnd', { winner: winner ? winner.username : 'Unknown' });
                room.gameStarted = false;
                room.players.forEach(p => p.alive = true);
            }
        }
    });

    socket.on('startGame', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room) {
            room.gameStarted = true;
            io.to(roomCode).emit('gameStart');
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, roomCode) => {
            room.players = room.players.filter(p => p.id !== socket.id);
            io.to(roomCode).emit('roomUpdate', room.players);
        });
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.io server running on http://localhost:${PORT}`);
});
