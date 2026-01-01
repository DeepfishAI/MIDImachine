// In-memory store for MIDI device states
// Structure:
// {
//   "Device Name": {
//     "1 (channel)": {
//       "7 (cc number)": 127 (value)
//     }
//   }
// }

const state = {
    devices: {}
};

/**
 * Update a CC value for a specific device and channel
 * @param {string} deviceName 
 * @param {number} channel (1-16)
 * @param {number} cc (0-127)
 * @param {number} value (0-127)
 */
function updateCC(deviceName, channel, cc, value) {
    if (!state.devices[deviceName]) {
        state.devices[deviceName] = {};
    }
    if (!state.devices[deviceName][channel]) {
        state.devices[deviceName][channel] = {};
    }
    state.devices[deviceName][channel][cc] = value;
}

/**
 * Get the full state
 */
function getState() {
    return state;
}

/**
 * Clear/Reset state
 */
function resetState() {
    state.devices = {};
}

module.exports = {
    updateCC,
    getState,
    resetState
};
