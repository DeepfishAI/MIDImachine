/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          MIDI MACHINE - APP                               ║
 * ║  Main application component - manages MIDI state and renders UI          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import Canvas from './components/Canvas';
import SystemMonitor from './components/SystemMonitor';
import './App.css';

const SERVER_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';
const socket = io(SERVER_URL);

function App() {
    /* ═══════════════════════════════════════════════════════════════════════
     *  STATE
     * ═══════════════════════════════════════════════════════════════════════ */

    const [inputs, setInputs] = useState([]);
    const [midiAccess, setMidiAccess] = useState(null);
    const [midiStatus, setMidiStatus] = useState('Initializing...');
    const [totalMessages, setTotalMessages] = useState(0);
    const [boxCount, setBoxCount] = useState(0);
    const [sources, setSources] = useState([]);
    const [deletedIds, setDeletedIds] = useState(new Set());

    // Refs to avoid stale closures in callbacks
    const deletedIdsRef = useRef(deletedIds);
    useEffect(() => {
        deletedIdsRef.current = deletedIds;
    }, [deletedIds]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  MIDI HANDLERS (defined before useEffect to avoid hoisting issues)
     * ═══════════════════════════════════════════════════════════════════════ */

    const handleIncomingMidi = useCallback((data) => {
        const { deviceName, channel } = data;
        const sourceId = `${deviceName}_ch${channel}`;

        setSources((prev) => {
            if (prev.find((s) => s.id === sourceId)) return prev;
            return [...prev, { id: sourceId, label: deviceName, channel }];
        });
    }, []);

    const getMIDIMessage = useCallback(
        (message, deviceName) => {
            const [status, data1, data2] = message.data;
            const command = status & 0xf0;
            const channel = (status & 0x0f) + 1;

            setTotalMessages((prev) => prev + 1);

            if (command === 176 || command === 144 || command === 128) {
                const cc = data1;
                const val = data2;
                const name = deviceName || 'Unknown Device';

                socket.emit('midi:client:message', { deviceName: name, channel, cc, value: val });
                handleIncomingMidi({ deviceName: name, channel, cc, value: val });
            }
        },
        [handleIncomingMidi]
    );

    const onMIDIFailure = useCallback(() => {
        setMidiStatus('Access Denied/Failed');
    }, []);

    const onMIDISuccess = useCallback(
        (access) => {
            setMidiAccess(access);

            const refreshInputs = () => {
                const midiInputs = [];
                const newSources = [];

                for (const input of access.inputs.values()) {
                    midiInputs.push(input);
                    input.onmidimessage = (msg) => getMIDIMessage(msg, input.name);

                    const defaultSourceId = `${input.name}_ch1`;
                    newSources.push({
                        id: defaultSourceId,
                        label: input.name,
                        channel: 1,
                        isHardware: true,
                    });
                }

                setInputs(midiInputs);

                setSources((prev) => {
                    let hasNew = false;
                    const updated = [...prev];
                    const currentDeletedIds = deletedIdsRef.current;

                    newSources.forEach((ns) => {
                        const isDeleted = currentDeletedIds.has(ns.id);
                        const alreadyExists = updated.find((s) => s.id === ns.id);

                        if (!alreadyExists && !isDeleted) {
                            updated.push(ns);
                            hasNew = true;
                        }
                    });

                    return hasNew ? updated : prev;
                });
            };

            refreshInputs();

            // Store handler reference for cleanup
            const stateChangeHandler = () => refreshInputs();
            access.onstatechange = stateChangeHandler;

            setMidiStatus('Access Granted');
        },
        [getMIDIMessage]
    );

    /* ═══════════════════════════════════════════════════════════════════════
     *  EFFECTS
     * ═══════════════════════════════════════════════════════════════════════ */

    // Initial setup
    useEffect(() => {
        socket.on('connect', () => console.log('Connected to server'));
        socket.on('midi:update', (data) => handleIncomingMidi(data));

        if (navigator.requestMIDIAccess) {
            setMidiStatus('Requesting Permission...');
            navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
        } else {
            setMidiStatus('Web MIDI Not Supported');
        }

        return () => {
            socket.off('connect');
            socket.off('midi:update');
        };
    }, [handleIncomingMidi, onMIDISuccess, onMIDIFailure]);

    // Background polling for hardware changes
    useEffect(() => {
        const interval = setInterval(() => {
            if (navigator.requestMIDIAccess) {
                navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [onMIDISuccess, onMIDIFailure]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  CALLBACKS
     * ═══════════════════════════════════════════════════════════════════════ */

    const resetMidi = useCallback(() => {
        setDeletedIds(new Set());
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
        }
    }, [onMIDISuccess, onMIDIFailure]);

    const removeSource = useCallback((id) => {
        setDeletedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setSources((prev) => prev.filter((s) => s.id !== id));
    }, []);

    const updateSourceChannel = useCallback(
        (id, newChannel) => {
            setSources((prev) =>
                prev.map((s) => {
                    if (s.id === id) {
                        if (midiAccess) {
                            const outputs = Array.from(midiAccess.outputs.values());
                            const output = outputs.find((o) => o.name === s.label);
                            if (output) {
                                output.send([176 + (s.channel - 1), 12, newChannel - 1]);
                            }
                        }
                        return { ...s, channel: newChannel };
                    }
                    return s;
                })
            );
        },
        [midiAccess]
    );

    // Bridge for child components (set in effect to satisfy linter)
    useEffect(() => {
        window.appUpdateChannel = updateSourceChannel;
    }, [updateSourceChannel]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════════════ */

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                position: 'fixed',
                top: 0,
                left: 0,
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <Header
                midiStatus={midiStatus}
                socketConnected={socket.connected}
                inputCount={inputs.length}
                totalMessages={totalMessages}
                boxCount={boxCount}
                onRescan={resetMidi}
            />

            {/* Main Canvas */}
            <Canvas
                sources={sources}
                onRemove={removeSource}
                onChannelChange={updateSourceChannel}
                onBoxCountChange={setBoxCount}
            />

            {/* System Monitor */}
            <SystemMonitor sources={sources} boxCount={boxCount} />
        </div>
    );
}

export default App;
