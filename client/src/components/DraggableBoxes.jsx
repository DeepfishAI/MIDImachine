/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     MIDI MACHINE - DRAGGABLE BOXES                        ║
 * ║  Renders device cards with drag, edit, channel control, conflict warnings ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';

const DraggableBoxes = ({ sources = [], conflicts = {}, onRemove }) => {
    // ========================================================================
    // STATE
    // ========================================================================

    const [boxStates, setBoxStates] = useState({});
    const [dragState, setDragState] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [tempLabel, setTempLabel] = useState('');

    // ========================================================================
    // DERIVED: Check if a source has conflict
    // ========================================================================

    const conflictingIds = useMemo(() => {
        const ids = new Set();
        Object.values(conflicts).forEach(deviceList => {
            deviceList.forEach(d => ids.add(d.id));
        });
        return ids;
    }, [conflicts]);

    // ========================================================================
    // INIT: Assign positions to new boxes
    // ========================================================================

    useEffect(() => {
        setBoxStates(prev => {
            const next = { ...prev };
            let hasChanges = false;

            sources.forEach((source, index) => {
                if (!next[source.id]) {
                    next[source.id] = {
                        x: 80 + (index * 30) % 500,
                        y: 120 + (index * 80) % 400,
                        customLabel: null
                    };
                    hasChanges = true;
                }
            });

            // Cleanup removed sources
            const currentIds = new Set(sources.map(s => s.id));
            Object.keys(next).forEach(id => {
                if (!currentIds.has(id)) {
                    delete next[id];
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });
    }, [sources]);

    // ========================================================================
    // DRAG LOGIC
    // ========================================================================

    const dragRef = useRef(dragState);
    dragRef.current = dragState;

    const handleMouseDown = (e, id) => {
        if (editingId === id) return;
        const boxState = boxStates[id];
        if (!boxState) return;

        setDragState({
            id,
            offsetX: e.clientX - boxState.x,
            offsetY: e.clientY - boxState.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            const currentDrag = dragRef.current;
            if (!currentDrag) return;

            setBoxStates(prev => ({
                ...prev,
                [currentDrag.id]: {
                    ...prev[currentDrag.id],
                    x: e.clientX - currentDrag.offsetX,
                    y: e.clientY - currentDrag.offsetY
                }
            }));
        };

        const handleMouseUp = () => setDragState(null);

        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState]);

    // ========================================================================
    // LABEL EDITING
    // ========================================================================

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
        if (e.key === 'Escape') setEditingId(null);
    };

    // ========================================================================
    // CHANNEL SCROLL
    // ========================================================================

    const handleChannelScroll = (e, sourceId, currentChannel) => {
        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY < 0 ? 1 : -1;
        const newChannel = Math.max(1, Math.min(16, currentChannel + delta));

        if (newChannel !== currentChannel && window.appUpdateChannel) {
            window.appUpdateChannel(sourceId, newChannel);
        }
    };

    // ========================================================================
    // STYLES
    // ========================================================================

    const styles = {
        container: {
            width: '100%',
            height: '100vh',
            position: 'relative',
            overflow: 'hidden',
            paddingTop: '50px'
        },
        box: (isDragging, hasConflict) => ({
            position: 'absolute',
            width: '220px',
            height: '100px',
            backgroundColor: hasConflict ? '#2a1a1a' : '#1a1a1a',
            borderRadius: '12px',
            boxShadow: isDragging
                ? '0 0 40px rgba(255,0,255,0.5)'
                : hasConflict
                    ? '0 0 20px rgba(255,75,75,0.3)'
                    : '0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: isDragging ? 'scale(1.02)' : 'scale(1)',
            transition: 'box-shadow 0.15s, transform 0.15s',
            border: hasConflict
                ? '2px solid #ff4b4b'
                : isDragging
                    ? '2px solid #ff00ff'
                    : '1px solid #333',
            zIndex: isDragging ? 10000 : 5000
        }),
        deleteBtn: {
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(255,75,75,0.1)',
            border: 'none',
            color: '#ff4b4b',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        label: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            color: '#eee',
            cursor: 'text',
            marginBottom: '8px',
            textAlign: 'center',
            maxWidth: '90%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        channelBadge: (hasConflict) => ({
            fontSize: '12px',
            color: hasConflict ? '#ff4b4b' : '#ff00ff',
            backgroundColor: hasConflict
                ? 'rgba(255,75,75,0.2)'
                : 'rgba(255,0,255,0.15)',
            padding: '4px 14px',
            borderRadius: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            cursor: 'ns-resize',
            userSelect: 'none',
            border: hasConflict
                ? '1px solid rgba(255,75,75,0.4)'
                : '1px solid rgba(255,0,255,0.3)',
            transition: 'all 0.15s'
        }),
        conflictBadge: {
            position: 'absolute',
            top: '8px',
            left: '8px',
            background: 'rgba(255,75,75,0.9)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '4px'
        },
        input: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            textAlign: 'center',
            border: '1px solid #ff00ff',
            borderRadius: '6px',
            padding: '6px',
            width: '80%',
            background: '#000',
            color: '#fff',
            outline: 'none'
        }
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <div style={styles.container}>
            {sources.map((source, index) => {
                const state = boxStates[source.id];
                if (!state) return null;

                const isDragging = dragState?.id === source.id;
                const isEditing = editingId === source.id;
                const displayLabel = state.customLabel || source.label;
                const hasConflict = conflictingIds.has(source.id);

                return (
                    <div
                        key={source.id}
                        style={{
                            ...styles.box(isDragging, hasConflict),
                            left: state.x,
                            top: state.y
                        }}
                        onMouseDown={(e) => handleMouseDown(e, source.id)}
                    >
                        {/* Conflict Warning Badge */}
                        {hasConflict && (
                            <div style={styles.conflictBadge}>⚠ CONFLICT</div>
                        )}

                        {/* Delete Button */}
                        {onRemove && (
                            <button
                                style={styles.deleteBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(source.id);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                ×
                            </button>
                        )}

                        {/* Label */}
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
                                title="Double-click to rename"
                            >
                                {displayLabel}
                            </span>
                        )}

                        {/* Channel Badge with scroll */}
                        <div
                            style={styles.channelBadge(hasConflict)}
                            onWheel={(e) => handleChannelScroll(e, source.id, source.channel)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={hasConflict
                                ? "⚠ Channel conflict! Scroll to change (1-16)"
                                : "Scroll to change channel (1-16)"}
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
