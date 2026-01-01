/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        MIDI MACHINE - DRAGGABLE BOXES                     ║
 * ║  Container component managing hardware device cards in the workspace      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Box from './Box';

const DraggableBoxes = ({ sources = [], onRemove, onChannelChange }) => {
    /* ═══════════════════════════════════════════════════════════════════════
     *  STATE MANAGEMENT
     * ═══════════════════════════════════════════════════════════════════════ */

    const [boxStates, setBoxStates] = useState({}); // Position state: { [id]: { x, y, customLabel } }
    const [dragState, setDragState] = useState(null); // Active drag: { id, offsetX, offsetY }

    /* ═══════════════════════════════════════════════════════════════════════
     *  SOURCE SYNCHRONIZATION
     *  - Initialize positions for new hardware sources
     *  - Cleanup positions when sources are removed
     * ═══════════════════════════════════════════════════════════════════════ */

    useEffect(() => {
        setBoxStates((prev) => {
            const next = { ...prev };
            let hasChanges = false;

            // Add new sources
            sources.forEach((source, index) => {
                if (!next[source.id]) {
                    next[source.id] = {
                        x: 50 + ((index * 20) % 500),
                        y: 100 + ((index * 80) % 500),
                        customLabel: null,
                    };
                    hasChanges = true;
                }
            });

            // Cleanup removed sources
            const currentIds = new Set(sources.map((s) => s.id));
            Object.keys(next).forEach((id) => {
                if (!currentIds.has(id)) {
                    delete next[id];
                    hasChanges = true;
                }
            });

            return hasChanges ? next : prev;
        });
    }, [sources]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  DRAG HANDLING
     *  - Track mouse movement during drag
     *  - Update box positions in real-time
     * ═══════════════════════════════════════════════════════════════════════ */

    const dragRef = useRef(dragState);

    // Update ref in effect to avoid updating during render
    useEffect(() => {
        dragRef.current = dragState;
    }, [dragState]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            const currentDrag = dragRef.current;
            if (!currentDrag) return;
            const { id, offsetX, offsetY } = currentDrag;
            setBoxStates((prev) => ({
                ...prev,
                [id]: {
                    ...prev[id],
                    x: e.clientX - offsetX,
                    y: e.clientY - offsetY,
                },
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

    /* ═══════════════════════════════════════════════════════════════════════
     *  EVENT CALLBACKS (Memoized)
     *  - Prevent unnecessary Box re-renders
     * ═══════════════════════════════════════════════════════════════════════ */

    const handleMouseDown = useCallback(
        (e, id) => {
            if (e.target.closest('button') || e.target.closest('input')) return;
            const boxState = boxStates[id];
            if (!boxState) return;
            const offsetX = e.clientX - boxState.x;
            const offsetY = e.clientY - boxState.y;
            setDragState({ id, offsetX, offsetY });
        },
        [boxStates]
    );

    const handleLabelChange = useCallback((id, newLabel) => {
        setBoxStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], customLabel: newLabel },
        }));
    }, []);

    const handleChannelChange = useCallback(
        (id, newChannel) => {
            if (onChannelChange) {
                onChannelChange(id, newChannel);
            } else if (window.appUpdateChannel) {
                window.appUpdateChannel(id, newChannel);
            }
        },
        [onChannelChange]
    );

    const handleDelete = useCallback(
        (id) => {
            if (onRemove) onRemove(id);
        },
        [onRemove]
    );

    /* ═══════════════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════════════ */

    return (
        <div
            style={{
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* ─────────────────────────────────────────────────────────────
                STATUS BOX - System Monitor (Bottom Right)
                Shows active sources count and debug JSON
            ───────────────────────────────────────────────────────────── */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 15,
                    right: 15,
                    color: '#4ade80',
                    fontSize: '11px',
                    background: 'rgba(0,0,0,0.85)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    fontFamily: 'JetBrains Mono, monospace',
                    lineHeight: '1.6',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div
                    style={{
                        fontWeight: 'bold',
                        marginBottom: '8px',
                        color: '#6ee7b7',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                    }}
                >
                    System Monitor
                </div>
                <div style={{ opacity: 0.8 }}>Active Sources: {sources.length}</div>
                <div style={{ opacity: 0.8 }}>Active Boxes: {Object.keys(boxStates).length}</div>
                {sources.length > 0 && (
                    <pre
                        style={{
                            margin: '10px 0 0 0',
                            fontSize: '9px',
                            opacity: 0.6,
                            maxHeight: '150px',
                            overflow: 'auto',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '8px',
                            borderRadius: '4px',
                        }}
                    >
                        {JSON.stringify(sources, null, 2)}
                    </pre>
                )}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                HARDWARE FLOATING BOXES
                Each Box represents a MIDI device/channel
            ───────────────────────────────────────────────────────────── */}
            {sources.map((source) => {
                const state = boxStates[source.id];
                if (!state) return null;

                return (
                    <Box
                        key={source.id}
                        id={source.id}
                        label={source.label}
                        channel={source.channel}
                        x={state.x}
                        y={state.y}
                        customLabel={state.customLabel}
                        isDragging={dragState?.id === source.id}
                        onMouseDown={handleMouseDown}
                        onLabelChange={handleLabelChange}
                        onChannelChange={handleChannelChange}
                        onDelete={handleDelete}
                    />
                );
            })}
        </div>
    );
};

export default DraggableBoxes;
