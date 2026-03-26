const RoomManager = require('./roomManager');
const roomManager = new RoomManager();

function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`[Connect] ${socket.id}`);

        // SENDER: Create a room
        socket.on('create-room', (fileInfo, callback) => {
            try {
                if (!fileInfo || !fileInfo.name || !fileInfo.size) {
                    return callback({
                        success: false,
                        error: 'Invalid file info'
                    });
                }

                const roomId = roomManager.createRoom(socket.id, fileInfo);
                socket.join(roomId);

                callback({ success: true, roomId });
            } catch (err) {
                console.error('[create-room error]', err);
                callback({ success: false, error: 'Server error' });
            }
        });

        // RECEIVER: Join a room
        socket.on('join-room', (roomId, callback) => {
            try {
                const result = roomManager.joinRoom(socket.id, roomId);

                if (!result.success) {
                    const messages = {
                        'ROOM_NOT_FOUND': 'Room not found. Check your code.',
                        'ROOM_FULL': 'Room already has a receiver.',
                        'CANNOT_JOIN_OWN_ROOM': 'You cannot join your own room.'
                    };
                    return callback({
                        success: false,
                        error: messages[result.error] || 'Unknown error'
                    });
                }

                const normalizedId = roomManager.normalizeRoomId(roomId);
                socket.join(normalizedId);

                io.to(result.senderId).emit('peer-joined', {
                    receiverId: socket.id
                });

                callback({
                    success: true,
                    fileInfo: result.fileInfo
                });
            } catch (err) {
                console.error('[join-room error]', err);
                callback({ success: false, error: 'Server error' });
            }
        });

        // WebRTC Signaling: Offer
        socket.on('signal-offer', (data) => {
            const roomInfo = roomManager.getRoomBySocket(socket.id);
            if (!roomInfo) return;

            const targetId = roomInfo.sender === socket.id
                ? roomInfo.receiver
                : roomInfo.sender;

            if (targetId) {
                io.to(targetId).emit('signal-offer', {
                    offer: data.offer,
                    senderId: socket.id
                });
            }
        });

        // WebRTC Signaling: Answer
        socket.on('signal-answer', (data) => {
            const roomInfo = roomManager.getRoomBySocket(socket.id);
            if (!roomInfo) return;

            const targetId = roomInfo.sender === socket.id
                ? roomInfo.receiver
                : roomInfo.sender;

            if (targetId) {
                io.to(targetId).emit('signal-answer', {
                    answer: data.answer,
                    senderId: socket.id
                });
            }
        });

        // WebRTC Signaling: ICE Candidate
        socket.on('signal-ice-candidate', (data) => {
            const roomInfo = roomManager.getRoomBySocket(socket.id);
            if (!roomInfo) return;

            const targetId = roomInfo.sender === socket.id
                ? roomInfo.receiver
                : roomInfo.sender;

            if (targetId) {
                io.to(targetId).emit('signal-ice-candidate', {
                    candidate: data.candidate,
                    senderId: socket.id
                });
            }
        });

        // Transfer Status
        socket.on('transfer-complete', () => {
            const roomInfo = roomManager.getRoomBySocket(socket.id);
            if (!roomInfo) return;

            const targetId = roomInfo.sender === socket.id
                ? roomInfo.receiver
                : roomInfo.sender;

            if (targetId) {
                io.to(targetId).emit('transfer-complete');
            }
        });

        // Disconnect
        socket.on('disconnect', (reason) => {
            console.log(`[Disconnect] ${socket.id} (${reason})`);

            const result = roomManager.handleDisconnect(socket.id);
            if (result && result.peerId) {
                io.to(result.peerId).emit('peer-disconnected', {
                    reason: 'Peer disconnected'
                });
            }
        });

        // Health Check
        socket.on('ping-server', (callback) => {
            callback({
                status: 'ok',
                stats: roomManager.getStats()
            });
        });
    });
}

module.exports = setupSocketHandlers;