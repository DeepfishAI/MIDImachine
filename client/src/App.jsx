import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import DraggableBoxes from './components/DraggableBoxes'
import './App.css'

const SERVER_URL = import.meta.env.PROD ? window.location.origin : "http://localhost:3000";
const socket = io(SERVER_URL);

function App() {
  const [inputs, setInputs] = useState([]);

  // Track active MIDI sources: { id: "DeviceName_Ch1", label: "DeviceName", channel: 1 }
  const [sources, setSources] = useState([]);

  // Track messages for visual feedback (optional, maybe passed to boxes later)
  const [messages, setMessages] = useState({});

  useEffect(() => {
    // --- Socket handlers ---
    socket.on('connect', () => console.log('Connected to server'));

    socket.on('midi:update', (data) => {
      handleIncomingMidi(data);
    });

    // --- Browser MIDI Access ---
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
      console.error("Web MIDI API not supported in this environment");
    }

    return () => {
      socket.off('connect');
      socket.off('midi:update');
    };
  }, []);

  function handleIncomingMidi(data) {
    const { deviceName, channel, cc, value } = data;

    // 1. Update Values
    setMessages(prev => ({
      ...prev,
      [`${deviceName}_${channel}_${cc}`]: value
    }));

    // 2. Discover Source (Box)
    // Unique ID for a "Box" is Device + Channel
    const sourceId = `${deviceName}_ch${channel}`;

    setSources(prev => {
      // Check if already exists
      if (prev.find(s => s.id === sourceId)) return prev;

      // Add new source
      return [...prev, {
        id: sourceId,
        label: deviceName,
        channel: channel
      }];
    });
  }

  function onMIDISuccess(midiAccess) {
    const midiInputs = [];
    for (const input of midiAccess.inputs.values()) {
      midiInputs.push(input);
      input.onmidimessage = getMIDIMessage;
    }
    setInputs(midiInputs);

    midiAccess.onstatechange = (e) => {
      // Refresh
      const newInputs = [];
      for (const input of midiAccess.inputs.values()) newInputs.push(input);
      setInputs(newInputs);
    };
  }

  function onMIDIFailure() {
    console.error('Could not access your MIDI devices.');
  }

  function getMIDIMessage(message) {
    const [status, data1, data2] = message.data;
    const command = status & 0xF0;
    const channel = (status & 0x0F) + 1;

    // Only handle CC (176) and NoteOn (144) for discovery (though app spec said CC)
    if (command === 176 || command === 144) {
      const cc = data1; // or Note Number
      const val = data2; // Velocity or Value
      const deviceName = message.currentTarget.name; // message.target might be null in some implementations, use currentTarget or fallback

      // Emit to Server
      socket.emit('midi:client:message', {
        deviceName,
        channel,
        cc,
        value: val
      });

      // Also handle locally immediately for low latency UI
      handleIncomingMidi({ deviceName, channel, cc, value: val });
    }
  }

  return (
    <>
      {/* Overlay Status Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        padding: '10px 20px',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        pointerEvents: 'none' // Let clicks pass through to canvas
      }}>
        <div style={{ fontWeight: 'bold' }}>MIDImachine</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          {socket.connected ? 'Server Connected' : 'Connecting...'} | {inputs.length} Devices Found
        </div>
      </div>

      {/* Main Canvas Area */}
      <DraggableBoxes sources={sources} />

      {/* Helper for empty state */}
      {sources.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#888',
          textAlign: 'center',
          pointerEvents: 'none',
          fontFamily: 'sans-serif'
        }}>
          Waiting for MIDI CC data...<br />
          Turn a knob on your controller to create a box.
        </div>
      )}
    </>
  )
}

export default App
