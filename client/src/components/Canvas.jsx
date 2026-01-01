/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          MIDI MACHINE - CANVAS                            ║
 * ║  Main workspace area that renders and manages hardware Box positions      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import Box from './Box';

const Canvas = memo(({ sources = [], onRemove, onChannelChange, onBoxCountChange }) => {
    /* ═══════════════════════════════════════════════════════════════════════
     *  STATE MANAGEMENT
     * ═══════════════════════════════════════════════════════════════════════ */

    const [boxStates, setBoxStates] = useState({}); // { [id]: { x, y, customLabel } }

    /* ═══════════════════════════════════════════════════════════════════════
     *  SOURCE SYNCHRONIZATION
     *  - Compute which sources need initialization
     *  - Uses useMemo to derive new sources without triggering re-renders
     * ═══════════════════════════════════════════════════════════════════════ */

    // Derive sources that need positions
    const sourceIds = useMemo(() => sources.map((s) => s.id), [sources]);

    // Sync boxStates with sources when source list changes
    const syncedBoxStates = useMemo(() => {
        const next = { ...boxStates };
        let hasChanges = false;

        // Add new sources
        sources.forEach((source, index) => {
            if (!next[source.id]) {
                next[source.id] = {
                    x: 80 + ((index * 30) % 400),
                    y: 80 + ((index * 50) % 300),
                    customLabel: null,
                };
                hasChanges = true;
            }
        });

        // Cleanup removed sources
        const currentIds = new Set(sourceIds);
        Object.keys(next).forEach((id) => {
            if (!currentIds.has(id)) {
                delete next[id];
                hasChanges = true;
            }
        });

        return hasChanges ? next : boxStates;
    }, [sources, sourceIds, boxStates]);

    // Update state if synced version differs
    useEffect(() => {
        if (syncedBoxStates !== boxStates) {
            setBoxStates(syncedBoxStates);
        }
    }, [syncedBoxStates, boxStates]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  BOX COUNT REPORTING
     * ═══════════════════════════════════════════════════════════════════════ */

    useEffect(() => {
        if (onBoxCountChange) {
            onBoxCountChange(Object.keys(boxStates).length);
        }
    }, [boxStates, onBoxCountChange]);

    /* ═══════════════════════════════════════════════════════════════════════
     *  EVENT CALLBACKS (Memoized)
     *  - Prevent unnecessary Box re-renders
     * ═══════════════════════════════════════════════════════════════════════ */

    const handlePositionChange = useCallback((id, x, y) => {
        setBoxStates((prev) => ({
            ...prev,
            [id]: { ...prev[id], x, y },
        }));
    }, []);

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
     *  STYLES
     * ═══════════════════════════════════════════════════════════════════════ */

    const styles = {
        container: {
            width: '100%',
            height: '100vh',
            position: 'relative',
            overflow: 'hidden',
            paddingTop: '50px',
        },
        emptyState: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#888',
            textAlign: 'center',
            pointerEvents: 'none',
            fontFamily: 'Inter, sans-serif',
        },
    };

    /* ═══════════════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════════════ */

    return (
        <div style={styles.container}>
            {/* ─────────────────────────────────────────────────────────────
                EMPTY STATE - No Hardware Detected
            ───────────────────────────────────────────────────────────── */}
            {sources.length === 0 && (
                <div style={styles.emptyState}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>🎹</div>
                    Waiting for MIDI CC data...
                    <br />
                    Turn a knob on your controller to create a box.
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                HARDWARE FLOATING BOXES
                Each Box = one MIDI device/channel (uses react-draggable)
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
                        defaultX={state.x}
                        defaultY={state.y}
                        customLabel={state.customLabel}
                        onPositionChange={handlePositionChange}
                        onLabelChange={handleLabelChange}
                        onChannelChange={handleChannelChange}
                        onDelete={handleDelete}
                    />
                );
            })}
        </div>
    );
});

Canvas.displayName = 'Canvas';

export default Canvas;
