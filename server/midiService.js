const store = require('./store');

/**
 * Initialize MIDI Service
 * @param {object} io - Socket.io instance
 */
function init(io) {
    console.log("MIDI Service Initialized (Cloud Mode)");
}

/**
 * Handle MIDI message received from a connected client (Browser MIDI)
 * @param {object} data - { deviceName, channel, cc, value }
 * @param {object} io - Socket.io instance
 */
function handleClientMidi(data, io) {
    const { deviceName, channel, cc, value } = data;

    if (!deviceName || channel === undefined || cc === undefined || value === undefined) {
        return;
    }

    // Update Store
    store.updateCC(deviceName, channel, cc, value);

    // Broadcast update to ALL OTHER clients (e.g. valid monitor)
    // We use io.emit to send to everyone including sender, or socket.broadcast to others.
    // For a monitor app, seeing your own data loopback is fine/good confirmation.
    io.emit('midi:update', {
        deviceName,
        channel,
        cc,
        value
    });
}

/**
 * In cloud mode, 'available devices' are what we have in memory from clients.
 */
function getActiveDevices() {
    return Object.keys(store.getState().devices || {});
}

module.exports = {
    init,
    handleClientMidi,
    getActiveDevices
};
