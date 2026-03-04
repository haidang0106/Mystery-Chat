"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // Allow all for dev
        methods: ['GET', 'POST']
    }
});
const waitingQueue = [];
// A dictionary mapping socketId to the roomId they are in
const activeRooms = new Map();
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    // Handle joining the matching queue
    socket.on('join_queue', (payload) => {
        // If they are already in the queue, ignore
        if (waitingQueue.some(item => item.socketId === socket.id))
            return;
        // Find a matching partner
        const matchIndex = waitingQueue.findIndex(waitingUser => {
            const partnerSocket = io.sockets.sockets.get(waitingUser.socketId);
            if (!partnerSocket)
                return false;
            // Check gender preferences
            const mePrefersThem = payload.preferences.preferredGender === 'any' || payload.preferences.preferredGender === waitingUser.profile.gender;
            const theyPreferMe = waitingUser.preferences.preferredGender === 'any' || waitingUser.preferences.preferredGender === payload.profile.gender;
            return mePrefersThem && theyPreferMe;
        });
        if (matchIndex !== -1) {
            const matchedItem = waitingQueue.splice(matchIndex, 1)[0];
            const partnerId = matchedItem.socketId;
            const partnerSocket = io.sockets.sockets.get(partnerId);
            // Create a unique room ID
            const roomId = `room_${partnerId}_${socket.id}`;
            // Join both to the room
            socket.join(roomId);
            partnerSocket.join(roomId);
            // Save their room assignment
            activeRooms.set(socket.id, roomId);
            activeRooms.set(partnerId, roomId);
            // Notify both clients with partner profiles
            socket.emit('match_success', { roomId, partnerId, partnerProfile: matchedItem.profile });
            partnerSocket.emit('match_success', { roomId, partnerId: socket.id, partnerProfile: payload.profile });
            console.log(`Matched ${socket.id} with ${partnerId} in ${roomId}`);
        }
        else {
            // Queue is empty or no match, wait
            waitingQueue.push({ socketId: socket.id, ...payload });
            console.log(`User ${socket.id} joined queue`);
        }
    });
    // Handle sending messages
    socket.on('send_message', (text) => {
        const roomId = activeRooms.get(socket.id);
        if (!roomId)
            return; // User not in a room
        const message = {
            id: Math.random().toString(36).substring(7),
            senderId: socket.id,
            text,
            timestamp: Date.now()
        };
        // Broadcast to the room, including the sender if we used io.to(roomId),
        // but typically we broadcast using socket.to(roomId) to EXCLUDE the sender
        // and let the client handle its own message. But to simplify state, we
        // will just send to the partner in the room.
        socket.to(roomId).emit('receive_message', message);
    });
    // Handle manual leave or disconnect
    const cleanupUser = () => {
        // Remove from queue if they are in it
        const index = waitingQueue.findIndex(item => item.socketId === socket.id);
        if (index !== -1) {
            waitingQueue.splice(index, 1);
        }
        // If they are in a room, notify partner and clean up room
        const roomId = activeRooms.get(socket.id);
        if (roomId) {
            socket.to(roomId).emit('partner_disconnected');
            // Remove all users from this room tracking
            for (const [sId, rId] of activeRooms.entries()) {
                if (rId === roomId) {
                    activeRooms.delete(sId);
                    // Force partner to leave the socket.io room
                    const pSocket = io.sockets.sockets.get(sId);
                    if (pSocket)
                        pSocket.leave(roomId);
                }
            }
        }
    };
    socket.on('leave_chat', () => {
        cleanupUser();
        console.log(`User ${socket.id} left chat`);
    });
    socket.on('disconnect', () => {
        cleanupUser();
        console.log(`User disconnected: ${socket.id}`);
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
