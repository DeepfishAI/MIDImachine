import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

// Connect to backend (relative path for production, localhost for dev)
// Vitest/Vite proxy usually handles /socket.io in dev if configured, 
// or we assume localhost:3000 for dev.
const SERVER_URL = import.meta.env.PROD ? window.location.origin : "http://localhost:3000";
const socket = io(SERVER_URL);

function App() {
  const [inputs, setInputs] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [messages, setMessages] = useState({}); // { ch_cc: val }

  useEffect(() => {
    // 1. Socket Locals
    socket.on('connect', () => console.log('Connected to server'));

    socket.on('state:full', (state) => {
      // Hydrate initial state if we want persistence
      // For now, we prefer showing Real-time data
    });

    socket.on('midi:update', (data) => {
      // Update local viz from Server broadcast (mirroring what we sent + others)
      // Key: ${data.channel}_${data.cc}
      setMessages(prev => ({
        ...prev,
        [`${data.channel}_${data.cc}`]: data.value
      }));
    });

    // 2. Browser MIDI Access
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

    return () => {
      socket.off('connect');
      socket.off('midi:update');
    };
  }, []);

  function onMIDISuccess(midiAccess) {
    const midiInputs = [];
    for (const input of midiAccess.inputs.values()) {
      midiInputs.push(input);
      input.onmidimessage = getMIDIMessage;
    }
    setInputs(midiInputs);
    // Auto select first?
    if (midiInputs.length > 0) setActiveDevice(midiInputs[0].name);

    midiAccess.onstatechange = (e) => {
      console.log("MIDI State Change", e.port.name, e.port.state);
      // Refresh inputs
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
    const type = command === 176 ? 'CC' : command === 144 ? 'NoteOn' : 'Other';

    // Only handle CC for now as per requirements
    if (command === 176) {
      const cc = data1;
      const val = data2;

      // Emit to Server
      // We get the device name from the input object usually, but here 'message.target.name'
      const deviceName = message.target.name;

      socket.emit('midi:client:message', {
        deviceName,
        channel,
        cc,
        value: val
      });
    }
  }

  return (
    <div className="container">
      <h1>MIDImachine</h1>

      <div className="status-bar">
        <span>Server: {socket.connected ? 'OK' : 'Disconnected'}</span>
        <span> | </span>
        <span>Found {inputs.length} Devices</span>
      </div>

      <div className="device-list">
        {inputs.map(input => (
          <div key={input.id} className="device-card">
            <h3>{input.name}</h3>
            <p>Manufacturer: {input.manufacturer}</p>
            <div className="led-indicator active"></div>
          </div>
        ))}
        {inputs.length === 0 && <p className="no-devices">No MIDI Devices Detected</p>}
      </div>

      <div className="monitor-grid">
        {/* Simple visualization of last 10 CCs or just a grid of values */}
        {Object.entries(messages).map(([key, val]) => {
          const [ch, cc] = key.split('_');
          return (
            <div key={key} className="cc-knob">
              <div className="knob-label">CH {ch} | CC {cc}</div>
              <div className="knob-value">{val}</div>
              <div className="knob-bar" style={{ height: `${(val / 127) * 100}%` }}></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default App
