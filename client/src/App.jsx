/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          MIDI MACHINE - APP                               ║
 * ║  Main application component - manages MIDI state and renders UI          ║
 * ║  Uses Radix Toast for notifications                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import * as Toast from '@radix-ui/react-toast';
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

    // Toast state
    const [toasts, setToasts] = useState([]);

    // Refs to avoid stale closures in callbacks
    const deletedIdsRef = useRef(deletedIds);
    useEffect(() => {
        deletedIdsRef.current = deletedIds;
    }, [deletedIds]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  TOAST NOTIFICATIONS
     * ═══════════════════════════════════════════════════════════════════════ */

    const showToast = useCallback((title, description, type = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, title, description, type }]);
        // Auto-remove after 4 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    /* ═══════════════════════════════════════════════════════════════════════
     *  MIDI HANDLERS
     * ═══════════════════════════════════════════════════════════════════════ */

    const handleIncomingMidi = useCallback(
        (data) => {
            const { deviceName, channel } = data;
            const sourceId = `${deviceName}_ch${channel}`;

            setSources((prev) => {
                if (prev.find((s) => s.id === sourceId)) return prev;
                // Show toast for new device
                showToast('🎹 New MIDI Source', `${deviceName} CH${channel}`, 'success');
                return [...prev, { id: sourceId, label: deviceName, channel }];
            });
        },
        [showToast]
    );

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
        showToast('❌ MIDI Error', 'Access denied or failed', 'error');
    }, [showToast]);

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

            const stateChangeHandler = () => refreshInputs();
            access.onstatechange = stateChangeHandler;

            setMidiStatus('Access Granted');
        },
        [getMIDIMessage]
    );

    /* ═══════════════════════════════════════════════════════════════════════
     *  EFFECTS
     * ═══════════════════════════════════════════════════════════════════════ */

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to server');
            showToast('☁️ Connected', 'Server connection established', 'success');
        });
        socket.on('midi:update', (data) => handleIncomingMidi(data));

        if (navigator.requestMIDIAccess) {
            setMidiStatus('Requesting Permission...');
            navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
        } else {
            setMidiStatus('Web MIDI Not Supported');
            showToast('⚠️ Not Supported', 'Web MIDI API unavailable', 'error');
        }

        return () => {
            socket.off('connect');
            socket.off('midi:update');
        };
    }, [handleIncomingMidi, onMIDISuccess, onMIDIFailure, showToast]);

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
        showToast('🔄 Rescanning', 'Looking for MIDI devices...', 'info');
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
        }
    }, [onMIDISuccess, onMIDIFailure, showToast]);

    const removeSource = useCallback(
        (id) => {
            const source = sources.find((s) => s.id === id);
            setDeletedIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
            });
            setSources((prev) => prev.filter((s) => s.id !== id));
            if (source) {
                showToast('🗑️ Removed', source.label, 'info');
            }
        },
        [sources, showToast]
    );

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

    useEffect(() => {
        window.appUpdateChannel = updateSourceChannel;
    }, [updateSourceChannel]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  TOAST STYLES
     * ═══════════════════════════════════════════════════════════════════════ */

    const toastStyles = {
        viewport: {
            position: 'fixed',
            bottom: 20,
            left: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '320px',
            maxWidth: '100vw',
            zIndex: 50000,
            listStyle: 'none',
            margin: 0,
            padding: 0,
        },
        root: {
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
        },
        title: {
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            margin: 0,
        },
        description: {
            color: '#888',
            fontSize: '12px',
            margin: 0,
        },
    };

    /* ═══════════════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════════════ */

    return (
        <Toast.Provider swipeDirection="left">
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

            {/* Toast Notifications */}
            {toasts.map((toast) => (
                <Toast.Root key={toast.id} style={toastStyles.root}>
                    <Toast.Title style={toastStyles.title}>{toast.title}</Toast.Title>
                    <Toast.Description style={toastStyles.description}>
                        {toast.description}
                    </Toast.Description>
                </Toast.Root>
            ))}

            <Toast.Viewport style={toastStyles.viewport} />
        </Toast.Provider>
    );
}

export default App;
