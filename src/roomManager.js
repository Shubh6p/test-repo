const { generateRoomId } = require('./utils');

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.socketToRoom = new Map();
        this.startCleanupInterval();
    }

    createRoom(socketId, fileInfo) {
        let roomId;
        do {
            roomId = generateRoomId();
        } while (this.rooms.has(roomId));

        const roomData = {
            sender: socketId,
            receiver: null,
            fileInfo: fileInfo,
            createdAt: Date.now(),
            status: 'waiting'
        };

        this.rooms.set(roomId, roomData);
        this.socketToRoom.set(socketId, roomId);

        console.log(`[Room ${roomId}] Created by ${socketId}`);
        console.log(`  File: ${fileInfo.name} (${fileInfo.size} bytes)`);

        return roomId;
    }

    joinRoom(socketId, roomId) {
        roomId = this.normalizeRoomId(roomId);

        if (!this.rooms.has(roomId)) {
            return { success: false, error: 'ROOM_NOT_FOUND' };
        }

        const room = this.rooms.get(roomId);

        if (room.receiver !== null) {
            return { success: false, error: 'ROOM_FULL' };
        }

        if (room.sender === socketId) {
            return { success: false, error: 'CANNOT_JOIN_OWN_ROOM' };
        }

        room.receiver = socketId;
        room.status = 'connected';
        this.socketToRoom.set(socketId, roomId);

        console.log(`[Room ${roomId}] Receiver ${socketId} joined`);

        return {
            success: true,
            fileInfo: room.fileInfo,
            senderId: room.sender
        };
    }

    handleDisconnect(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return null;

        const room = this.rooms.get(roomId);
        if (!room) return null;

        let peerId = null;
        if (room.sender === socketId) {
            peerId = room.receiver;
        } else if (room.receiver === socketId) {
            peerId = room.sender;
        }

        this.socketToRoom.delete(socketId);
        if (peerId) {
            this.socketToRoom.delete(peerId);
        }
        this.rooms.delete(roomId);

        console.log(`[Room ${roomId}] Destroyed (${socketId} disconnected)`);

        return { roomId, peerId };
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getRoomBySocket(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId) return null;
        return { roomId, ...this.rooms.get(roomId) };
    }

    normalizeRoomId(input) {
        let cleaned = input.replace(/\s/g, '').toUpperCase();
        if (cleaned.length === 6 && !cleaned.includes('-')) {
            cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3);
        }
        return cleaned;
    }

    startCleanupInterval() {
        setInterval(() => {
            const now = Date.now();
            const THIRTY_MINUTES = 30 * 60 * 1000;

            for (const [roomId, room] of this.rooms) {
                if (now - room.createdAt > THIRTY_MINUTES) {
                    console.log(`[Room ${roomId}] Auto-cleaned (stale)`);
                    if (room.sender) this.socketToRoom.delete(room.sender);
                    if (room.receiver) this.socketToRoom.delete(room.receiver);
                    this.rooms.delete(roomId);
                }
            }
        }, 5 * 60 * 1000);
    }

    getStats() {
        return {
            activeRooms: this.rooms.size,
            connectedUsers: this.socketToRoom.size
        };
    }
}

module.exports = RoomManager;