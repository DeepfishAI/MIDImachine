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
            width: '180px',
            height: '90px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: isDragging
                ? '0 10px 20px rgba(0,0,0,0.15)'
                : '0 2px 5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: isDragging ? 'scale(1.02)' : 'scale(1)',
            transition: 'box-shadow 0.1s, transform 0.1s',
            zIndex: isDragging ? 100 : 1,
            border: '1px solid #eee'
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
            color: '#888',
            backgroundColor: '#f0f0f0',
            padding: '2px 8px',
            borderRadius: '10px',
            fontFamily: 'monospace'
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
            {sources.map(source => {
                // If we haven't initialized state for this source yet, skip render (will catch up in effect)
                const state = boxStates[source.id];
                if (!state) return null;

                const isDragging = dragState?.id === source.id;
                const isEditing = editingId === source.id;
                const displayLabel = state.customLabel || source.label;

                return (
                    <div
                        key={source.id}
                        style={{
                            ...styles.box(isDragging),
                            left: state.x,
                            top: state.y,
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

                        <div style={styles.channelBadge}>
                            CH {source.channel}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DraggableBoxes;
