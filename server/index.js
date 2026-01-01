require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const midiService = require('./midiService');
const store = require('./store');

const app = express();
const server = http.createServer(app);

// Use FrontEnd URL from Env or default
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Serve Static Files in Production
if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Handle SPA routing
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
            return next();
        }
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}


app.use(cors({
    origin: "*", // Allow all for now in dev/railway, or restrict to FRONTEND_URL
    methods: ["GET", "POST"]
}));

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send state
    socket.emit('state:full', store.getState());

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    // Receive MIDI data FROM client (Browser API)
    socket.on('midi:client:message', (data) => {
        midiService.handleClientMidi(data, io);
    });

    // Handle channel update from client
    socket.on('midi:channel:update', (data) => {
        const { deviceName, channel } = data;
        console.log(`Channel update: ${deviceName} -> CH ${channel}`);
        // Broadcast to other clients
        socket.broadcast.emit('midi:channel:updated', data);
        // Could also send to hardware via midiService if needed
        midiService.sendChannelChange && midiService.sendChannelChange(deviceName, channel);
    });

    // Handle ping/test CC
    socket.on('midi:ping', (data) => {
        const { deviceName, channel, cc, value } = data;
        console.log(`Ping: ${deviceName} CH${channel} CC${cc}=${value}`);
        midiService.sendPing && midiService.sendPing(deviceName, channel, cc, value);
    });
});

app.get('/api/state', (req, res) => {
    res.json(store.getState());
});

app.get('/', (req, res) => {
    res.send('MIDImachine Backend Active');
});

midiService.init(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`MIDImachine Server running on port ${PORT}`);
});
