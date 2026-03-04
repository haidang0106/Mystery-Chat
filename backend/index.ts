import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
    JoinQueuePayload
} from '../shared/types';

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(server, {
    cors: {
        origin: '*', // Allow all for dev
        methods: ['GET', 'POST']
    }
});

// A waiting queue for users who want to find a partner
interface QueueItem extends JoinQueuePayload {
    socketId: string;
}
const waitingQueue: QueueItem[] = [];
// A dictionary mapping socketId to the roomId they are in
const activeRooms: Map<string, string> = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle joining the matching queue
    socket.on('join_queue', (payload) => {
        // If they are already in the queue, ignore
        if (waitingQueue.some(item => item.socketId === socket.id)) return;

        // Find a matching partner
        const matchIndex = waitingQueue.findIndex(waitingUser => {
            const partnerSocket = io.sockets.sockets.get(waitingUser.socketId);
            if (!partnerSocket) return false;

            // Check gender preferences
            const mePrefersThem = payload.preferences.preferredGender === 'any' || payload.preferences.preferredGender === waitingUser.profile.gender;
            const theyPreferMe = waitingUser.preferences.preferredGender === 'any' || waitingUser.preferences.preferredGender === payload.profile.gender;

            return mePrefersThem && theyPreferMe;
        });

        if (matchIndex !== -1) {
            const matchedItem = waitingQueue.splice(matchIndex, 1)[0];
            const partnerId = matchedItem.socketId;

            const partnerSocket = io.sockets.sockets.get(partnerId)!;

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
        } else {
            // Queue is empty or no match, wait
            waitingQueue.push({ socketId: socket.id, ...payload });
            console.log(`User ${socket.id} joined queue`);
        }
    });

    // Handle sending messages
    socket.on('send_message', (text: string) => {
        const roomId = activeRooms.get(socket.id);
        if (!roomId) return; // User not in a room

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
                    if (pSocket) pSocket.leave(roomId);
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
