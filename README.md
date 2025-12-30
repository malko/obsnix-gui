# Obsbot Linux GUI

> 📍 For more information on OBSNIX itself please check the [app/gui README](apps/gui/README.md). 👈 \
\
This README covers the monospace repository structure and how to get started with development for this project.
------------

This repository is a **[monospace](https://github.com/software-t-rex/monospace)** containing a GUI application for controlling OBSBOT cameras, primarily targeted at Linux users.

The project is structured as a monospace, which is a tool for managing multi-project repositories. You can learn more about monospace [here](https://github.com/software-t-rex/monospace).

## License

The main code in this repository is licensed under the **MIT License**.

## Project Structure

  *   **SDK**: The underlying Node.js SDK for communicating with Obsbot devices can be found in [`libs/sdk`](libs/sdk/README.md).
  *   **GUI**: The Electron-based GUI application is located in [`apps/gui`](apps/gui/README.md).\
    The sdk code is an embedded repository inside the monospace, so changes to the sdk can be made and tested directly from the gui app. The original sdk repository is at [obsbot-js-sdk](https://github.com/malko/obsbot-js-sdk).

## Getting Started

### 1. Install Monospace

To work with this repository, you need to install the `monospace` tool.

**Using NPM:**
```bash
npm install -g @software-t-rex/monospace
```

Or download a pre-built binary from the [Releases page](https://github.com/software-t-rex/monospace/releases).

### 2. Clone the Repository

Once `monospace` is installed, you can clone this repository and all its internal projects using:

```bash
monospace clone <repository-url>
cd obsnix-gui
```

### 3. Development

To launch the GUI in development mode:

1.  **Install dependencies** (from the root of the workspace):
    ```bash
    npm install
    ```

2.  **Run the GUI**:
    ```bash
		# from the root of the monospace workspace (convenience method)
		monospace run dev
		# or from the gui app directory using npm directly (recommended method)
    cd apps/gui
    npm run dev
    ```

## Support this project

If you find this project useful, please consider supporting the project:

- **Star the repository**: Give us a star on GitHub to show your support.
- **Contribute**: Check out inside apps/gui or the sdk repository for more information.
- **Donate**: If you'd like to financially support the development, consider making a donation. If you want more devices to be tested, you can also offer or lend an OBSBOT device for testing new features, as I only own a Tiny SE myself.
- **Report issues**: If you encounter any bugs or have feature requests, please open an issue on GitHub.

Thank you for your support!

## Sponsors
We would like to thank the following individuals for their generous donations that help support the development of this project:

<a href="https://github.com/niftyprose"><img src="https://avatars.githubusercontent.com/u/3169311?v=4" title="niftyprose" width="80" height="80" style="border-radius: 50%;"></a>


