/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                            MIDI MACHINE - BOX                             ║
 * ║  Hardware device card with drag, label editing, channel editing, delete  ║
 * ║  Uses react-draggable for positioning + Radix UI for modals              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, memo } from 'react';
import Draggable from 'react-draggable';
import * as Dialog from '@radix-ui/react-dialog';

const Box = memo(
    ({
        id,
        label,
        channel,
        defaultX = 100,
        defaultY = 100,
        customLabel,
        onPositionChange,
        onLabelChange,
        onChannelChange,
        onDelete,
    }) => {
        /* ═══════════════════════════════════════════════════════════════════════
         *  STATE MANAGEMENT
         * ═══════════════════════════════════════════════════════════════════════ */

        const [isEditingLabel, setIsEditingLabel] = useState(false);
        const [isEditingChannel, setIsEditingChannel] = useState(false);
        const [tempLabel, setTempLabel] = useState('');
        const [tempChannel, setTempChannel] = useState('');
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
        const [isDragging, setIsDragging] = useState(false);

        const displayLabel = customLabel || label;

        /* ═══════════════════════════════════════════════════════════════════════
         *  LABEL EDITING
         * ═══════════════════════════════════════════════════════════════════════ */

        const startEditingLabel = () => {
            setIsEditingLabel(true);
            setTempLabel(displayLabel);
        };

        const saveLabel = () => {
            if (onLabelChange) onLabelChange(id, tempLabel);
            setIsEditingLabel(false);
        };

        const handleLabelKeyDown = (e) => {
            if (e.key === 'Enter') saveLabel();
            if (e.key === 'Escape') setIsEditingLabel(false);
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  CHANNEL EDITING
         * ═══════════════════════════════════════════════════════════════════════ */

        const startEditingChannel = () => {
            setIsEditingChannel(true);
            setTempChannel(channel.toString());
        };

        const saveChannel = () => {
            const chan = parseInt(tempChannel);
            if (!isNaN(chan) && chan >= 1 && chan <= 16) {
                if (onChannelChange) onChannelChange(id, chan);
            }
            setIsEditingChannel(false);
        };

        const handleChannelKeyDown = (e) => {
            if (e.key === 'Enter') saveChannel();
            if (e.key === 'Escape') setIsEditingChannel(false);
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  DRAG HANDLERS
         * ═══════════════════════════════════════════════════════════════════════ */

        const handleDragStart = () => setIsDragging(true);
        const handleDragStop = (e, data) => {
            setIsDragging(false);
            if (onPositionChange) onPositionChange(id, data.x, data.y);
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  STYLES - BOX
         * ═══════════════════════════════════════════════════════════════════════ */

        const styles = {
            box: {
                width: '210px',
                height: '105px',
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                boxShadow: isDragging
                    ? '0 0 50px rgba(255,0,255,0.4)'
                    : '0 4px 20px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDragging ? 'grabbing' : 'grab',
                transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                transition: 'box-shadow 0.2s, transform 0.2s, border 0.2s',
                border: isDragging ? '2px solid #ff00ff' : '1px solid #333',
                overflow: 'hidden',
                backdropFilter: 'blur(10px)',
                position: 'relative',
            },
            header: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '30px',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '0 8px',
            },
            deleteBtn: {
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ff4b4b',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                transition: 'background 0.2s',
            },
            label: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: '600',
                color: '#eee',
                cursor: 'text',
                marginBottom: '8px',
                textAlign: 'center',
                width: '80%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            },
            channelBadge: {
                fontSize: '11px',
                color: '#ff00ff',
                backgroundColor: 'rgba(255,0,255,0.1)',
                padding: '2px 10px',
                borderRadius: '10px',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                border: '1px solid rgba(255,0,255,0.2)',
                cursor: 'pointer',
            },
            input: {
                fontFamily: 'sans-serif',
                fontSize: '14px',
                textAlign: 'center',
                border: '1px solid #ff00ff',
                borderRadius: '4px',
                padding: '4px',
                width: '80%',
                background: '#000',
                color: '#fff',
                outline: 'none',
            },
            channelInput: {
                fontSize: '11px',
                color: '#ff00ff',
                backgroundColor: '#000',
                padding: '2px 10px',
                borderRadius: '10px',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                border: '1px solid #ff00ff',
                width: '40px',
                textAlign: 'center',
                outline: 'none',
            },
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  STYLES - DELETE DIALOG (Radix UI)
         * ═══════════════════════════════════════════════════════════════════════ */

        const dialogStyles = {
            overlay: {
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(5px)',
                zIndex: 20000,
            },
            content: {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '24px',
                width: '320px',
                textAlign: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                zIndex: 20001,
            },
            title: { margin: '0 0 12px 0', color: '#fff', fontSize: '18px' },
            description: { margin: '0 0 24px 0', color: '#888', fontSize: '14px' },
            buttonRow: { display: 'flex', gap: '12px' },
            cancelBtn: {
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                background: '#333',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
            },
            confirmBtn: {
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                background: '#ff4b4b',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
            },
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  RENDER
         * ═══════════════════════════════════════════════════════════════════════ */

        return (
            <>
                <Draggable
                    defaultPosition={{ x: defaultX, y: defaultY }}
                    onStart={handleDragStart}
                    onStop={handleDragStop}
                    cancel="input, button"
                >
                    <div style={styles.box}>
                        {/* ─────────────────────────────────────────────────────
                        HEADER - Delete Button
                    ───────────────────────────────────────────────────── */}
                        <div style={styles.header}>
                            <button
                                style={styles.deleteBtn}
                                onClick={() => setShowDeleteConfirm(true)}
                                onMouseOver={(e) =>
                                    (e.target.style.background = 'rgba(255,75,75,0.2)')
                                }
                                onMouseOut={(e) =>
                                    (e.target.style.background = 'rgba(255,255,255,0.1)')
                                }
                            >
                                ×
                            </button>
                        </div>

                        {/* ─────────────────────────────────────────────────────
                        LABEL - Device Name (double-click to edit)
                    ───────────────────────────────────────────────────── */}
                        {isEditingLabel ? (
                            <input
                                autoFocus
                                value={tempLabel}
                                onChange={(e) => setTempLabel(e.target.value)}
                                onBlur={saveLabel}
                                onKeyDown={handleLabelKeyDown}
                                style={styles.input}
                            />
                        ) : (
                            <span style={styles.label} onDoubleClick={startEditingLabel}>
                                {displayLabel}
                            </span>
                        )}

                        {/* ─────────────────────────────────────────────────────
                        CHANNEL BADGE (click to edit, 1-16)
                    ───────────────────────────────────────────────────── */}
                        {isEditingChannel ? (
                            <input
                                autoFocus
                                value={tempChannel}
                                onChange={(e) => setTempChannel(e.target.value)}
                                onBlur={saveChannel}
                                onKeyDown={handleChannelKeyDown}
                                style={styles.channelInput}
                            />
                        ) : (
                            <div style={styles.channelBadge} onClick={startEditingChannel}>
                                CH {channel}
                            </div>
                        )}
                    </div>
                </Draggable>

                {/* ─────────────────────────────────────────────────────────────
                DELETE CONFIRMATION DIALOG (Radix UI Portal)
            ───────────────────────────────────────────────────────────── */}
                <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <Dialog.Portal>
                        <Dialog.Overlay style={dialogStyles.overlay} />
                        <Dialog.Content style={dialogStyles.content}>
                            <Dialog.Title style={dialogStyles.title}>
                                Remove Instrument?
                            </Dialog.Title>
                            <Dialog.Description style={dialogStyles.description}>
                                Are you sure you want to remove this card?
                            </Dialog.Description>
                            <div style={dialogStyles.buttonRow}>
                                <Dialog.Close asChild>
                                    <button style={dialogStyles.cancelBtn}>Cancel</button>
                                </Dialog.Close>
                                <button
                                    style={dialogStyles.confirmBtn}
                                    onClick={() => {
                                        if (onDelete) onDelete(id);
                                        setShowDeleteConfirm(false);
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </>
        );
    }
);

Box.displayName = 'Box';

export default Box;
