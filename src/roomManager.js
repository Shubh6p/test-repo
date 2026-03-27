const { generateRoomId } = require('./utils');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> { senderSocket, receiverSocket, senderSession, receiverSession, fileInfo, createdAt, lastActivity, lastTransferAt }
        this.socketToRoom = new Map(); // socketId -> roomId
        this.startCleanupInterval();
    }

    createRoom(socketId, sessionId, fileInfo) {
        let roomId;
        do {
            roomId = generateRoomId();
        } while (this.rooms.has(roomId));

        const roomData = {
            sender: socketId,
            senderSession: sessionId,
            receiver: null,
            receiverSession: null,
            fileInfo: fileInfo || null,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            lastTransferAt: Date.now(),
            status: 'waiting'
        };

        this.rooms.set(roomId, roomData);
        this.socketToRoom.set(socketId, roomId);

        console.log(`[Room ${roomId}] Created by ${socketId} (session ${sessionId})`);
        return roomId;
    }

    joinRoom(socketId, sessionId, roomId) {
        roomId = this.normalizeRoomId(roomId);
        if (!this.rooms.has(roomId)) return { success: false, error: 'ROOM_NOT_FOUND' };

        const room = this.rooms.get(roomId);
        if (room.receiverSession && room.receiverSession !== sessionId) {
            return { success: false, error: 'ROOM_FULL' };
        }

        room.receiver = socketId;
        room.receiverSession = sessionId;
        room.status = 'connected';
        room.lastActivity = Date.now();
        this.socketToRoom.set(socketId, roomId);

        console.log(`[Room ${roomId}] Receiver ${socketId} joined (session ${sessionId})`);
        return { success: true, fileInfo: room.fileInfo, senderId: room.sender };
    }

    reconnectRoom(socketId, sessionId, roomId) {
        roomId = this.normalizeRoomId(roomId);
        if (!this.rooms.has(roomId)) return { success: false, error: 'SESSION_EXPIRED' };

        const room = this.rooms.get(roomId);
        let role = null;

        if (room.senderSession === sessionId) {
            room.sender = socketId;
            role = 'sender';
        } else if (room.receiverSession === sessionId) {
            room.receiver = socketId;
            role = 'receiver';
        } else {
            return { success: false, error: 'UNAUTHORIZED_SESSION' };
        }

        room.lastActivity = Date.now();
        this.socketToRoom.set(socketId, roomId);
        console.log(`[Room ${roomId}] ${role} reconnected with socket ${socketId}`);

        return { 
            success: true, 
            role, 
            peerId: role === 'sender' ? room.receiver : room.sender,
            fileInfo: room.fileInfo
        };
    }

    handleDisconnect(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return null;

        const room = this.rooms.get(roomId);
        if (!room) return null;

        let peerId = null;
        if (room.sender === socketId) {
            room.sender = null;
            peerId = room.receiver;
        } else if (room.receiver === socketId) {
            room.receiver = null;
            peerId = room.sender;
        }

        room.lastActivity = Date.now();
        this.socketToRoom.delete(socketId);
        
        console.log(`[Room ${roomId}] Socket ${socketId} disconnected. Room kept for potential reconnection.`);
        return { roomId, peerId };
    }

    updateActivity(socketId, isTransfer = false) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (!room) return;

        const now = Date.now();
        room.lastActivity = now;
        if (isTransfer) {
            room.lastTransferAt = now;
        }
    }

    getRoomBySocket(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return null;
        return { roomId, ...this.rooms.get(roomId) };
    }

    normalizeRoomId(input) {
        if (!input) return '';
        let cleaned = input.replace(/\s/g, '').toUpperCase();
        if (cleaned.length === 6 && !cleaned.includes('-')) {
            cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3);
        }
        return cleaned;
    }

    startCleanupInterval() {
        setInterval(() => {
            const now = Date.now();
            const GRACE_PERIOD = 60 * 1000; // 60s for refresh
            const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5m of no file activity

            for (const [roomId, room] of this.rooms) {
                // Scenario A: No sockets connected for too long (refresh failed)
                const noSockets = !room.sender && !room.receiver;
                if (noSockets && (now - room.lastActivity > GRACE_PERIOD)) {
                    console.log(`[Room ${roomId}] Cleaned up (refresh grace period expired)`);
                    this.rooms.delete(roomId);
                    continue;
                }

                // Scenario B: No transfer activity for 5 minutes
                if (now - room.lastTransferAt > INACTIVITY_TIMEOUT) {
                    console.log(`[Room ${roomId}] Cleaned up (5-minute inactivity timeout)`);
                    if (room.sender) this.socketToRoom.delete(room.sender);
                    if (room.receiver) this.socketToRoom.delete(room.receiver);
                    this.rooms.delete(roomId);
                }
            }
        }, 10 * 1000); // Check every 10 seconds
    }

    getStats() {
        return {
            activeRooms: this.rooms.size,
            connectedSockets: this.socketToRoom.size
        };
    }
}

module.exports = RoomManager;