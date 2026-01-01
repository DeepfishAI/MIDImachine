import React, { useState, useEffect, useRef } from 'react';

// sources = [{ id: 'unique_string', label: 'Device Name', channel: 1 }]
const DraggableBoxes = ({ sources = [] }) => {
    // --- State ---
    // boxStates: { [id]: { x, y, customLabel } }
    const [boxStates, setBoxStates] = useState({});
    const [dragState, setDragState] = useState(null); // { id, offsetX, offsetY }
    const [editingId, setEditingId] = useState(null);
    const [tempLabel, setTempLabel] = useState('');

    // Initialize new boxes with default positions
    useEffect(() => {
        setBoxStates(prev => {
            const next = { ...prev };
            let hasChanges = false;

            sources.forEach((source, index) => {
                if (!next[source.id]) {
                    // New box found! Assign default position
                    // Stagger them so they don't stack perfectly
                    next[source.id] = {
                        x: 50 + (index * 20) % 500,
                        y: 100 + (index * 80) % 500,
                        customLabel: null // Use source.label by default
                    };
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });
    }, [sources]);

    // --- Refs ---
    const dragRef = useRef(dragState);
    dragRef.current = dragState;

    // --- Event Handlers ---

    const handleMouseDown = (e, id) => {
        if (editingId === id) return;

        // Get current pos from state
        const boxState = boxStates[id];
        if (!boxState) return;

        const offsetX = e.clientX - boxState.x;
        const offsetY = e.clientY - boxState.y;

        setDragState({ id, offsetX, offsetY });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            const currentDrag = dragRef.current;
            if (!currentDrag) return;

            const { id, offsetX, offsetY } = currentDrag;

            setBoxStates(prev => ({
                ...prev,
                [id]: {
                    ...prev[id],
                    x: e.clientX - offsetX,
                    y: e.clientY - offsetY
                }
            }));
        };

        const handleMouseUp = () => {
            setDragState(null);
        };

        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState]);

    // --- Editing Handlers ---

    const startEditing = (id, currentLabel) => {
        setEditingId(id);
        setTempLabel(currentLabel);
    };

    const saveLabel = () => {
        if (editingId !== null) {
            setBoxStates(prev => ({
                ...prev,
                [editingId]: { ...prev[editingId], customLabel: tempLabel }
            }));
            setEditingId(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') saveLabel();
    };

    // --- Channel Scroll Handler ---
    const handleChannelScroll = (e, sourceId, currentChannel) => {
        e.preventDefault();
        e.stopPropagation();

        // Scroll up = increase channel, scroll down = decrease
        const delta = e.deltaY < 0 ? 1 : -1;
        const newChannel = Math.max(1, Math.min(16, currentChannel + delta));

        if (newChannel !== currentChannel && window.appUpdateChannel) {
            window.appUpdateChannel(sourceId, newChannel);
        }
    };

    // --- Styles ---

    const styles = {
        container: {
            width: '100%',
            height: '100vh',
            position: 'relative',
            overflow: 'hidden',
        },
        box: (isDragging) => ({
            position: 'absolute',
            width: '300px',
            height: '150px',
            backgroundColor: '#ff00ff', // BRIGHT MAGENTA
            borderRadius: '12px',
            boxShadow: '0 0 50px rgba(255,0,255,0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: isDragging ? 'scale(1.02)' : 'scale(1)',
            transition: 'box-shadow 0.1s, transform 0.1s',
            zIndex: isDragging ? 10000 : 5000, // VERY HIGH Z-INDEX
            border: '5px solid #00ff00' // BRIGHT GREEN BORDER
        }),
        label: {
            fontFamily: 'sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            color: '#333',
            cursor: 'text',
            marginBottom: '4px',
            textAlign: 'center',
            maxWidth: '90%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        channelBadge: {
            fontSize: '11px',
            color: '#ff00ff',
            backgroundColor: 'rgba(255,0,255,0.15)',
            padding: '4px 12px',
            borderRadius: '10px',
            fontFamily: 'monospace',
            cursor: 'ns-resize',
            userSelect: 'none',
            border: '1px solid rgba(255,0,255,0.3)',
            transition: 'background 0.2s, transform 0.1s',
        },
        input: {
            fontFamily: 'sans-serif',
            fontSize: '14px',
            textAlign: 'center',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '4px',
            width: '80%',
            outline: 'none',
        }
    };

    return (
        <div style={styles.container}>
            {/* System Monitor */}
            <div style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                color: '#4ade80', // Softer green
                fontSize: '11px',
                background: 'rgba(0,0,0,0.85)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                pointerEvents: 'none',
                zIndex: 9999,
                fontFamily: 'monospace',
                lineHeight: '1.6',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#6ee7b7' }}>System Monitor</div>
                <div style={{ opacity: 0.9 }}>Active Sources: {sources.length}</div>
                <div style={{ opacity: 0.9 }}>Active Boxes: {Object.keys(boxStates).length}</div>
                {sources.length > 0 && (
                    <pre style={{
                        margin: '8px 0 0 0',
                        fontSize: '9px',
                        opacity: 0.7,
                        maxHeight: '200px',
                        overflow: 'auto'
                    }}>{JSON.stringify(sources, null, 2)}</pre>
                )}
            </div>

            {sources.map((source, index) => {
                const isDragging = dragState?.id === source.id;
                const isEditing = editingId === source.id;

                // Get state if it exists, otherwise use defaults
                const state = boxStates[source.id];
                const displayLabel = state?.customLabel || source.label;

                // DIRECT POSITION CALCULATION - no dependency on boxStates
                const x = state?.x ?? (100 + (index * 50));
                const y = state?.y ?? (150 + (index * 200));

                return (
                    <div
                        key={source.id}
                        style={{
                            ...styles.box(isDragging),
                            left: `${x}px`,
                            top: `${y}px`,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, source.id)}
                    >
                        {isEditing ? (
                            <input
                                autoFocus
                                value={tempLabel}
                                onChange={(e) => setTempLabel(e.target.value)}
                                onBlur={saveLabel}
                                onKeyDown={handleKeyDown}
                                style={styles.input}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                style={styles.label}
                                onDoubleClick={() => startEditing(source.id, displayLabel)}
                            >
                                {displayLabel}
                            </span>
                        )}

                        <div
                            style={styles.channelBadge}
                            onWheel={(e) => handleChannelScroll(e, source.id, source.channel)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Scroll to change channel (1-16)"
                        >
                            CH {source.channel}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DraggableBoxes;
