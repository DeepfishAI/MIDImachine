/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                            MIDI MACHINE - BOX                             ║
 * ║  Hardware device card with drag, label editing, channel editing, delete  ║
 * ║  Uses: react-draggable, Radix Dialog, ContextMenu, DropdownMenu, Tooltip ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, memo } from 'react';
import Draggable from 'react-draggable';
import * as Dialog from '@radix-ui/react-dialog';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';

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
        const [tempLabel, setTempLabel] = useState('');
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
         *  CHANNEL CHANGE (via dropdown)
         * ═══════════════════════════════════════════════════════════════════════ */

        const handleChannelSelect = (newChannel) => {
            if (onChannelChange) onChannelChange(id, newChannel);
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
         *  STYLES
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
            // Context Menu Styles
            contextMenu: {
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '4px',
                minWidth: '160px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                zIndex: 30000,
            },
            contextMenuItem: {
                padding: '8px 12px',
                fontSize: '13px',
                color: '#eee',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                outline: 'none',
            },
            contextMenuItemDanger: {
                color: '#ff4b4b',
            },
            // Dropdown Menu Styles
            dropdownContent: {
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '4px',
                minWidth: '80px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                zIndex: 30000,
            },
            dropdownItem: {
                padding: '6px 12px',
                fontSize: '12px',
                color: '#eee',
                borderRadius: '4px',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'monospace',
            },
            // Tooltip Styles
            tooltipContent: {
                background: '#333',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            },
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  DIALOG STYLES
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
                {/* ─────────────────────────────────────────────────────────────
                    CONTEXT MENU - Right-click actions
                ───────────────────────────────────────────────────────────── */}
                <ContextMenu.Root>
                    <ContextMenu.Trigger asChild>
                        <div style={{ position: 'absolute' }}>
                            <Draggable
                                defaultPosition={{ x: defaultX, y: defaultY }}
                                onStart={handleDragStart}
                                onStop={handleDragStop}
                                cancel="input, button"
                            >
                                <div style={styles.box}>
                                    {/* HEADER - Delete Button */}
                                    <div style={styles.header}>
                                        <Tooltip.Provider>
                                            <Tooltip.Root>
                                                <Tooltip.Trigger asChild>
                                                    <button
                                                        style={styles.deleteBtn}
                                                        onClick={() => setShowDeleteConfirm(true)}
                                                    >
                                                        ×
                                                    </button>
                                                </Tooltip.Trigger>
                                                <Tooltip.Portal>
                                                    <Tooltip.Content
                                                        style={styles.tooltipContent}
                                                        sideOffset={5}
                                                    >
                                                        Remove card
                                                    </Tooltip.Content>
                                                </Tooltip.Portal>
                                            </Tooltip.Root>
                                        </Tooltip.Provider>
                                    </div>

                                    {/* LABEL - Device Name */}
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
                                        <Tooltip.Provider>
                                            <Tooltip.Root>
                                                <Tooltip.Trigger asChild>
                                                    <span
                                                        style={styles.label}
                                                        onDoubleClick={startEditingLabel}
                                                    >
                                                        {displayLabel}
                                                    </span>
                                                </Tooltip.Trigger>
                                                <Tooltip.Portal>
                                                    <Tooltip.Content
                                                        style={styles.tooltipContent}
                                                        sideOffset={5}
                                                    >
                                                        Double-click to rename
                                                    </Tooltip.Content>
                                                </Tooltip.Portal>
                                            </Tooltip.Root>
                                        </Tooltip.Provider>
                                    )}

                                    {/* CHANNEL DROPDOWN */}
                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger asChild>
                                            <div style={styles.channelBadge}>CH {channel}</div>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Portal>
                                            <DropdownMenu.Content
                                                style={styles.dropdownContent}
                                                sideOffset={5}
                                            >
                                                {[...Array(16)].map((_, i) => (
                                                    <DropdownMenu.Item
                                                        key={i + 1}
                                                        style={{
                                                            ...styles.dropdownItem,
                                                            background:
                                                                channel === i + 1
                                                                    ? 'rgba(255,0,255,0.2)'
                                                                    : 'transparent',
                                                        }}
                                                        onSelect={() => handleChannelSelect(i + 1)}
                                                    >
                                                        CH {i + 1}
                                                    </DropdownMenu.Item>
                                                ))}
                                            </DropdownMenu.Content>
                                        </DropdownMenu.Portal>
                                    </DropdownMenu.Root>
                                </div>
                            </Draggable>
                        </div>
                    </ContextMenu.Trigger>

                    {/* Context Menu Content */}
                    <ContextMenu.Portal>
                        <ContextMenu.Content style={styles.contextMenu}>
                            <ContextMenu.Item
                                style={styles.contextMenuItem}
                                onSelect={startEditingLabel}
                            >
                                ✏️ Rename
                            </ContextMenu.Item>
                            <ContextMenu.Sub>
                                <ContextMenu.SubTrigger style={styles.contextMenuItem}>
                                    🎛️ Channel →
                                </ContextMenu.SubTrigger>
                                <ContextMenu.Portal>
                                    <ContextMenu.SubContent style={styles.contextMenu}>
                                        {[...Array(16)].map((_, i) => (
                                            <ContextMenu.Item
                                                key={i + 1}
                                                style={{
                                                    ...styles.contextMenuItem,
                                                    background:
                                                        channel === i + 1
                                                            ? 'rgba(255,0,255,0.2)'
                                                            : 'transparent',
                                                }}
                                                onSelect={() => handleChannelSelect(i + 1)}
                                            >
                                                CH {i + 1}
                                            </ContextMenu.Item>
                                        ))}
                                    </ContextMenu.SubContent>
                                </ContextMenu.Portal>
                            </ContextMenu.Sub>
                            <ContextMenu.Separator
                                style={{ height: 1, background: '#333', margin: '4px 0' }}
                            />
                            <ContextMenu.Item
                                style={{
                                    ...styles.contextMenuItem,
                                    ...styles.contextMenuItemDanger,
                                }}
                                onSelect={() => setShowDeleteConfirm(true)}
                            >
                                🗑️ Remove
                            </ContextMenu.Item>
                        </ContextMenu.Content>
                    </ContextMenu.Portal>
                </ContextMenu.Root>

                {/* ─────────────────────────────────────────────────────────────
                    DELETE CONFIRMATION DIALOG
                ───────────────────────────────────────────────────────────── */}
                <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <Dialog.Portal>
                        <Dialog.Overlay style={dialogStyles.overlay} />
                        <Dialog.Content style={dialogStyles.content}>
                            <Dialog.Title style={dialogStyles.title}>
                                Remove Instrument?
                            </Dialog.Title>
                            <Dialog.Description style={dialogStyles.description}>
                                Are you sure you want to remove "{displayLabel}"?
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
