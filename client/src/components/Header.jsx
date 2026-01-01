/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                          MIDI MACHINE - HEADER                            ║
 * ║  Top status bar with MIDI info, connection status, and controls          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo } from 'react';

const Header = memo(
    ({
        midiStatus = 'Unknown',
        socketConnected = false,
        inputCount = 0,
        totalMessages = 0,
        boxCount = 0,
        onRescan,
    }) => {
        /* ═══════════════════════════════════════════════════════════════════════
         *  STYLES
         * ═══════════════════════════════════════════════════════════════════════ */

        const styles = {
            container: {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                padding: '10px 20px',
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                zIndex: 10000,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                boxSizing: 'border-box',
            },
            title: {
                fontWeight: 'bold',
                color: '#0f0',
                fontFamily: 'JetBrains Mono, monospace',
            },
            stats: {
                fontSize: '0.8rem',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                fontFamily: 'JetBrains Mono, monospace',
            },
            stat: {
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
            },
            indicator: (active) => ({
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: active ? '#4ade80' : '#ff4b4b',
                boxShadow: active ? '0 0 8px #4ade80' : 'none',
            }),
            rescanBtn: {
                padding: '4px 12px',
                fontSize: '11px',
                background: '#222',
                color: '#0f0',
                border: '1px solid #0f0',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                transition: 'all 0.2s',
            },
        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  RENDER
         * ═══════════════════════════════════════════════════════════════════════ */

        return (
            <div style={styles.container}>
                {/* ─────────────────────────────────────────────────────────────
                TITLE
            ───────────────────────────────────────────────────────────── */}
                <div style={styles.title}>MIDImachine v2</div>

                {/* ─────────────────────────────────────────────────────────────
                STATUS INDICATORS + RESCAN BUTTON
            ───────────────────────────────────────────────────────────── */}
                <div style={styles.stats}>
                    {/* MIDI Status */}
                    <div style={styles.stat}>
                        <span style={styles.indicator(midiStatus === 'Access Granted')} />
                        MIDI: {midiStatus}
                    </div>

                    {/* Cloud Connection */}
                    <div style={styles.stat}>
                        <span style={styles.indicator(socketConnected)} />
                        Cloud: {socketConnected ? 'Connected' : 'Reconnecting...'}
                    </div>

                    {/* Stats */}
                    <span>{inputCount} HW Ports</span>
                    <span>Rx: {totalMessages}</span>
                    <span>Boxes: {boxCount}</span>

                    {/* Rescan Button */}
                    <button
                        style={styles.rescanBtn}
                        onClick={onRescan}
                        onMouseOver={(e) => {
                            e.target.style.background = '#0f0';
                            e.target.style.color = '#000';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = '#222';
                            e.target.style.color = '#0f0';
                        }}
                    >
                        Rescan
                    </button>
                </div>
            </div>
        );
    }
);

Header.displayName = 'Header';

export default Header;
