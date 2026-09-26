# OBSNIX: OBSBot GUI Application

## Description

The OBSBot GUI application is a user-friendly interface designed to control and manage OBSBot devices. It provides an intuitive way to configure settings, monitor device status, and perform various operations.

## Features

- Easy-to-use graphical interface.
- Real-time device monitoring.
- Customizable settings for OBSBot devices.
- ~~Cross-platform support.~~ (only tested on linux for now, please report if it works on other platforms)

## Installation

### From Pre-built Binaries
Visit the [Releases page](https://github.com/malko/obsnix-gui/releases) to download the latest pre-built binaries for your platform.

### From Source
1. Clone the repository:
   ```bash
   git clone https://github.com/malko/obsnix-gui.git
   ```
2. Navigate to the GUI application directory:
   ```bash
   cd obsnix/apps/gui
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

## Usage
- Connect your OBSBot device to your computer.
- Launch the application.
- Use the interface to adjust settings, monitor the device, and perform actions.

## Limitations
- The application has only been tested on Linux. Users are encouraged to report their experiences on other platforms.
- Matching OBSBOT devices (from the SDK) to system cameras (from Electron) is done through the device label, and on Linux through the camera driver path when possible.
  When several devices of the same model are connected and cannot be told apart automatically, the source is flagged in the picker and you can assign the right system camera manually (the "Assign…" button, with an "Identify" helper that physically moves the selected device).
  OS support for the exact matching (by device path) currently targets Linux, other platforms rely on the label/manual matching.
- Matching is recomputed every time the connected cameras change. If a camera is moved to another port or replaced since your last manual assignment, the saved assignment is detected as stale (and will never point at another device's camera); it is flagged in the picker so you can assign it again.

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE.md) file for details.

