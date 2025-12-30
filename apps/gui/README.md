# OBSBot GUI Application

## Description

The OBSBot GUI application is a user-friendly interface designed to control and manage OBSBot devices. It provides an intuitive way to configure settings, monitor device status, and perform various operations.

## Features

- Easy-to-use graphical interface.
- Real-time device monitoring.
- Customizable settings for OBSBot devices.
- ~~Cross-platform support.~~ (only tested on linux for now, please report if it works on other platforms)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/malko/obsbot.git
   ```
2. Navigate to the GUI application directory:
   ```bash
   cd obsbot/apps/gui
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
- Working with multiple devices of the same model may lead to displaying one device while setting parameters on another.
  Users should be cautious when operating multiple devices simultaneously.
  This is due to limitations in how devices are identified via browser APIs.

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

