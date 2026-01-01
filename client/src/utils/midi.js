/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      MIDI MACHINE - UTILITIES                             ║
 * ║  Channel conflict detection, base-name pairing, config persistence        ║
 * ║  Ported from MIDImanager 2.4 Python CLI                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// CONFIG PERSISTENCE (localStorage)
// ============================================================================

const STORAGE_KEY = 'midimachine_config';

export function loadConfig() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load config:', e);
    }
    return {
        channelMap: {},      // { deviceBase: channel_0based }
        renames: {},         // { deviceBase: displayName }
        udpEnabled: true
    };
}

export function saveConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        return true;
    } catch (e) {
        console.error('Failed to save config:', e);
        return false;
    }
}

// ============================================================================
// BASE NAME PAIRING (Group "Device 1" and "Device 2" as same hardware)
// ============================================================================

const BASE_PATTERN = /\s+\d+$/;

export function baseName(deviceName) {
    if (!deviceName) return '';
    return deviceName.trim().toLowerCase().replace(BASE_PATTERN, '');
}

export function pairDevices(sources) {
    const buckets = {};

    sources.forEach(source => {
        const base = baseName(source.label);
        if (!buckets[base]) {
            buckets[base] = {
                name: base,
                displayName: source.label,  // Use first device's name
                channels: new Set(),
                sources: []
            };
        }
        buckets[base].channels.add(source.channel);
        buckets[base].sources.push(source);
    });

    return Object.values(buckets);
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

export function findChannelConflicts(sources) {
    // Group sources by channel
    const byChannel = {};

    sources.forEach(source => {
        const ch = source.channel;
        if (!byChannel[ch]) {
            byChannel[ch] = [];
        }
        byChannel[ch].push(source);
    });

    // Return only channels with 2+ devices
    const conflicts = {};
    for (const [ch, devices] of Object.entries(byChannel)) {
        // Only consider conflicts if different BASE devices share same channel
        const uniqueBases = new Set(devices.map(d => baseName(d.label)));
        if (uniqueBases.size > 1) {
            conflicts[ch] = devices;
        }
    }

    return conflicts;
}

export function hasConflicts(sources) {
    return Object.keys(findChannelConflicts(sources)).length > 0;
}

export function getConflictSummary(sources) {
    const conflicts = findChannelConflicts(sources);
    const conflictCount = Object.keys(conflicts).length;
    const deviceCount = Object.values(conflicts).reduce((sum, arr) => sum + arr.length, 0);

    return {
        hasConflicts: conflictCount > 0,
        conflictCount,
        deviceCount,
        conflicts
    };
}

// ============================================================================
// CHANNEL OPERATIONS
// ============================================================================

export function isChannelAvailable(sources, channel, excludeSourceId = null) {
    return !sources.some(s =>
        s.channel === channel &&
        s.id !== excludeSourceId &&
        baseName(s.label) !== baseName(sources.find(x => x.id === excludeSourceId)?.label || '')
    );
}

export function getNextAvailableChannel(sources, preferredChannel = 1) {
    const usedChannels = new Set(sources.map(s => s.channel));

    // Try preferred channel first
    if (!usedChannels.has(preferredChannel)) {
        return preferredChannel;
    }

    // Find first available 1-16
    for (let ch = 1; ch <= 16; ch++) {
        if (!usedChannels.has(ch)) {
            return ch;
        }
    }

    return preferredChannel; // All taken, allow conflict
}

// ============================================================================
// SOCKET/UDP SYNC
// ============================================================================

export function sendChannelUpdate(socket, deviceName, channel) {
    if (socket && socket.connected) {
        socket.emit('midi:channel:update', {
            deviceName,
            channel
        });
        return true;
    }
    return false;
}

export function sendPingTest(socket, deviceName, channel) {
    if (socket && socket.connected) {
        // Send test CC7 (volume) = 64
        socket.emit('midi:ping', {
            deviceName,
            channel,
            cc: 7,
            value: 64
        });
        return true;
    }
    return false;
}
