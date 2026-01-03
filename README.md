# MIDImachine

**CLI tool for controlling MIDI hardware via Control Change (CC) messages.**

Zero dependencies - uses Windows native WinMM API.

## Install

```bash
cd C:\REPOS\MIDImachine
python midi_cli.py
```

## Quick Start

```bash
# List all MIDI devices
python midi_cli.py --list

# Interactive mode
python midi_cli.py

# Direct CC send
python midi_cli.py -d 1 --cc 74 -v 100
```

## Interactive Commands

### Shorthand (Fast)
```
CH=3          Set channel to 3
CC74=100      Send CC74 = 100
VOL=80        Volume (CC7)
PAN=64        Pan (CC10)
PC=5          Program Change
MOD=50        Modulation (CC1)
CUT=100       Filter Cutoff (CC74)
RES=60        Resonance (CC71)
```

### Quick Device Switch
```
set1 ch3      Switch to device 1, channel 3
set2          Switch to device 2 only
```

### Full Commands
| Command | Description |
|---------|-------------|
| `cc <cc#> <value>` | Send Control Change |
| `note <note> <vel>` | Send Note |
| `pc <program>` | Program Change |
| `bend <0-16383>` | Pitch Bend |
| `nrpn <param> <value>` | Non-Registered Parameter |
| `sysex F0 xx xx F7` | System Exclusive |
| `sweep <cc> <start> <end>` | Sweep CC over 2 sec |
| `lfo <cc> <min> <max> <hz>` | Software LFO |
| `panic` | All Notes Off |

### Presets
```
save mypreset     Save current CC state
load mypreset     Load and apply preset
presets           List saved presets
```

### Scripts
```
script example.txt    Run automation script
```

## Detected Devices

Run `python midi_cli.py --list` to see your devices:
- `[0]` Microsoft GS Wavetable Synth
- `[1]` Launchkey MK4 49 MIDI
- `[2]` MIDIOUT2 (Launchkey MK4 49 MIDI)
- `[3]` Arturia MiniLab mkII

## License

MIT
