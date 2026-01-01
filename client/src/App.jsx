/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          MIDI MACHINE - APP                               ║
 * ║  Main application with channel management, conflict detection,           ║
 * ║  config persistence, and socket.io sync                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import DraggableBoxes from './components/DraggableBoxes';
import {
  loadConfig,
  saveConfig,
  findChannelConflicts,
  getConflictSummary,
  sendChannelUpdate,
  baseName
} from './utils/midi';
import './App.css';

const SERVER_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';
const socket = io(SERVER_URL);

function App() {
  // ========================================================================
  // STATE
  // ========================================================================

  const [inputs, setInputs] = useState([]);
  const [sources, setSources] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [config, setConfig] = useState(() => loadConfig());

  // ========================================================================
  // DERIVED STATE
  // ========================================================================

  const conflictSummary = useMemo(() => getConflictSummary(sources), [sources]);

  // ========================================================================
  // CONFIG PERSISTENCE
  // ========================================================================

  const saveCurrentConfig = useCallback(() => {
    const channelMap = {};
    sources.forEach(s => {
      channelMap[baseName(s.label)] = s.channel;
    });
    const newConfig = { ...config, channelMap };
    setConfig(newConfig);
    saveConfig(newConfig);
  }, [sources, config]);

  // Auto-save config when sources change
  useEffect(() => {
    if (sources.length > 0) {
      saveCurrentConfig();
    }
  }, [sources]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========================================================================
  // MIDI HANDLERS
  // ========================================================================

  const handleIncomingMidi = useCallback((data) => {
    const { deviceName, channel } = data;
    const sourceId = `${deviceName}_ch${channel}`;

    setSources(prev => {
      if (prev.find(s => s.id === sourceId)) return prev;

      // Check if we have a saved channel for this device base
      const base = baseName(deviceName);
      const savedChannel = config.channelMap[base];
      const finalChannel = savedChannel !== undefined ? savedChannel : channel;

      return [...prev, {
        id: sourceId,
        label: deviceName,
        channel: finalChannel
      }];
    });
  }, [config.channelMap]);

  const getMIDIMessage = useCallback((message, deviceName) => {
    const [status, data1, data2] = message.data;
    const command = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    setTotalMessages(prev => prev + 1);

    if (command === 176 || command === 144 || command === 128) {
      const cc = data1;
      const val = data2;
      const name = deviceName || 'Unknown Device';

      socket.emit('midi:client:message', {
        deviceName: name,
        channel,
        cc,
        value: val
      });

      handleIncomingMidi({ deviceName: name, channel, cc, value: val });
    }
  }, [handleIncomingMidi]);

  const onMIDIFailure = useCallback(() => {
    console.error('Could not access MIDI devices');
  }, []);

  const onMIDISuccess = useCallback((midiAccess) => {
    const midiInputs = [];
    for (const input of midiAccess.inputs.values()) {
      midiInputs.push(input);
      input.onmidimessage = (msg) => getMIDIMessage(msg, input.name);
    }
    setInputs(midiInputs);

    midiAccess.onstatechange = () => {
      const newInputs = [];
      for (const input of midiAccess.inputs.values()) {
        newInputs.push(input);
        input.onmidimessage = (msg) => getMIDIMessage(msg, input.name);
      }
      setInputs(newInputs);
    };
  }, [getMIDIMessage]);

  // ========================================================================
  // CHANNEL UPDATE (exposed to children)
  // ========================================================================

  const updateSourceChannel = useCallback((sourceId, newChannel) => {
    setSources(prev => prev.map(s => {
      if (s.id === sourceId) {
        // Send update via socket
        sendChannelUpdate(socket, s.label, newChannel);
        return { ...s, channel: newChannel };
      }
      return s;
    }));
  }, []);

  // Expose to window for child components
  useEffect(() => {
    window.appUpdateChannel = updateSourceChannel;
  }, [updateSourceChannel]);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  useEffect(() => {
    socket.on('connect', () => console.log('Connected to server'));
    socket.on('midi:update', handleIncomingMidi);

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    return () => {
      socket.off('connect');
      socket.off('midi:update');
    };
  }, [handleIncomingMidi, onMIDISuccess, onMIDIFailure]);

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const rescan = useCallback(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }
  }, [onMIDISuccess, onMIDIFailure]);

  const removeSource = useCallback((id) => {
    setSources(prev => prev.filter(s => s.id !== id));
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden'
    }}>
      {/* Header Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '40px',
        padding: '8px 20px',
        background: 'rgba(0,0,0,0.9)',
        color: '#fff',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: conflictSummary.hasConflicts
          ? '2px solid #ff4b4b'
          : '1px solid #333',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#0f0' }}>MIDImachine</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {socket.connected ? '● Connected' : '○ Connecting...'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.8rem' }}>
          {conflictSummary.hasConflicts && (
            <span style={{
              color: '#ff4b4b',
              background: 'rgba(255,75,75,0.2)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              ⚠ {conflictSummary.deviceCount} conflicts
            </span>
          )}
          <span style={{ opacity: 0.7 }}>
            {inputs.length} Devices | {sources.length} Sources | {totalMessages} Rx
          </span>
          <button
            onClick={rescan}
            style={{
              background: '#333',
              border: '1px solid #555',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            Rescan
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <DraggableBoxes
        sources={sources}
        conflicts={conflictSummary.conflicts}
        onRemove={removeSource}
      />

      {/* Empty State */}
      {sources.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#666',
          textAlign: 'center',
          pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
            Waiting for MIDI CC data...
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>
            Turn a knob on your controller to create a box
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '12px' }}>
            {totalMessages} messages received
          </div>
        </div>
      )}

      {/* System Monitor */}
      <div style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        color: '#4ade80',
        fontSize: '11px',
        background: 'rgba(0,0,0,0.85)',
        padding: '10px 12px',
        borderRadius: '6px',
        border: conflictSummary.hasConflicts
          ? '1px solid rgba(255,75,75,0.5)'
          : '1px solid rgba(74,222,128,0.3)',
        pointerEvents: 'none',
        zIndex: 9999,
        maxWidth: '280px'
      }}>
        <div>Sources: {sources.length} | HW: {inputs.length}</div>
        {conflictSummary.hasConflicts && (
          <div style={{ color: '#ff4b4b', marginTop: '4px' }}>
            ⚠ {Object.keys(conflictSummary.conflicts).length} channel conflicts
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
