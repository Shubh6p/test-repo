const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const setupSocketHandlers = require('./socketHandlers');

require('dotenv').config();

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
}));

const io = new Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e7, // 10MB — supports relay chunk packets
});

setupSocketHandlers(io);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../client/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║   Klick Share Signaling Server        ║
  ║   Running on port ${PORT}                ║
  ║   Client URL: ${CLIENT_URL}  ║
  ╚═══════════════════════════════════════╝
  `);
});