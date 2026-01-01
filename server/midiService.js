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

/**
 * Send channel change notification (for hardware sync if available)
 * @param {string} deviceName 
 * @param {number} channel 
 */
function sendChannelChange(deviceName, channel) {
    console.log(`[midiService] Channel change: ${deviceName} -> CH ${channel}`);
    // In cloud mode, we simply log this. 
    // In hardware mode, this would send MIDI to the device.
    store.updateDeviceChannel && store.updateDeviceChannel(deviceName, channel);
}

/**
 * Send a test ping CC to a device
 * @param {string} deviceName 
 * @param {number} channel (1-16)
 * @param {number} cc 
 * @param {number} value 
 */
function sendPing(deviceName, channel, cc, value) {
    console.log(`[midiService] Ping: ${deviceName} CH${channel} CC${cc}=${value}`);
    // In cloud mode, this is a no-op for hardware.
    // Could be used to confirm connection or sync state.
}

module.exports = {
    init,
    handleClientMidi,
    getActiveDevices,
    sendChannelChange,
    sendPing
};
