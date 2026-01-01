/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       MIDI MACHINE - SYSTEM MONITOR                       ║
 * ║  Draggable debug/status panel showing sources and box counts             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo } from 'react';
import Draggable from 'react-draggable';

const SystemMonitor = memo(({ sources = [], boxCount = 0 }) => {
    /* ═══════════════════════════════════════════════════════════════════════
     *  STYLES
     * ═══════════════════════════════════════════════════════════════════════ */

    const styles = {
        container: {
            color: '#4ade80',
            fontSize: '11px',
            background: 'rgba(0,0,0,0.85)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(74, 222, 128, 0.2)',
            zIndex: 9999,
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: '1.6',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(10px)',
            cursor: 'grab',
            userSelect: 'none',
            minWidth: '180px',
        },
        title: {
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#6ee7b7',
            textTransform: 'uppercase',
            letterSpacing: '1px',
        },
        stat: {
            opacity: 0.8,
        },
        debug: {
            margin: '10px 0 0 0',
            fontSize: '9px',
            opacity: 0.6,
            maxHeight: '150px',
            overflow: 'auto',
            background: 'rgba(0,0,0,0.3)',
            padding: '8px',
            borderRadius: '4px',
            cursor: 'default',
        },
    };

    /* ═══════════════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════════════ */

    return (
        <Draggable
            defaultPosition={{ x: window.innerWidth - 250, y: window.innerHeight - 200 }}
            cancel="pre"
        >
            <div style={{ position: 'absolute' }}>
                <div style={styles.container}>
                    {/* ─────────────────────────────────────────────────────
                        TITLE
                    ───────────────────────────────────────────────────── */}
                    <div style={styles.title}>System Monitor</div>

                    {/* ─────────────────────────────────────────────────────
                        STATS
                    ───────────────────────────────────────────────────── */}
                    <div style={styles.stat}>Active Sources: {sources.length}</div>
                    <div style={styles.stat}>Active Boxes: {boxCount}</div>

                    {/* ─────────────────────────────────────────────────────
                        DEBUG JSON
                    ───────────────────────────────────────────────────── */}
                    {sources.length > 0 && (
                        <pre style={styles.debug}>{JSON.stringify(sources, null, 2)}</pre>
                    )}
                </div>
            </div>
        </Draggable>
    );
});

SystemMonitor.displayName = 'SystemMonitor';

export default SystemMonitor;
