# MIDImachine

CLI tool for controlling MIDI hardware via Control Change (CC) messages.

## Install

```bash
pip install -r requirements.txt
```

## Usage

### Interactive Mode
```bash
python midi_cli.py
```

### List Devices
```bash
python midi_cli.py --list
```

### Direct Commands
```bash
# Send CC74 (filter cutoff) = 100 to device 0
python midi_cli.py -d 0 --cc 74 -v 100

# Shortcut for filter cutoff
python midi_cli.py -d 0 --cutoff 80

# Send to specific channel
python midi_cli.py -d 0 --cc 7 -v 64 -c 2
```

## Interactive Commands

| Command | Description |
|---------|-------------|
| `cc <cc#> <value>` | Send Control Change |
| `cutoff <0-127>` | Filter Cutoff (CC74) |
| `resonance <0-127>` | Filter Resonance (CC71) |
| `attack <0-127>` | Attack Time (CC73) |
| `release <0-127>` | Release Time (CC72) |
| `volume <0-127>` | Channel Volume (CC7) |
| `pan <0-127>` | Pan position (CC10) |
| `sweep <cc> <start> <end>` | Sweep CC over 2 sec |
| `panic` | All Notes Off + Reset |
| `device` | Change MIDI device |
| `channel <1-16>` | Set MIDI channel |

## Common CC Numbers

| CC | Parameter |
|----|-----------|
| 1 | Modulation |
| 7 | Volume |
| 10 | Pan |
| 71 | Resonance |
| 72 | Release |
| 73 | Attack |
| 74 | Filter Cutoff |
| 91 | Reverb |
| 93 | Chorus |
