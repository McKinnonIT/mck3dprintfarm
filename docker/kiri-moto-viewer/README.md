# Self-Hosted Kiri:Moto Viewer

This directory contains Docker configuration for self-hosting the Kiri:Moto GCODE and STL viewer.

## Quick Start

```bash
cd docker/kiri-moto-viewer
docker-compose up -d
```

The viewer will be available at `http://localhost:8080/kiri/`.

## Using the Viewer

When self-hosted, you can directly access the viewer at:

```
http://localhost:8080/kiri/?view-gcode=PATH_TO_YOUR_GCODE_FILE
```

Replace `PATH_TO_YOUR_GCODE_FILE` with the URL-encoded path to your GCODE file.

## Integration with the 3D Print Farm

The main application is already set up to use our minimal embedded viewer that loads Kiri:Moto in an iframe. If you want to switch to this self-hosted version instead of using grid.space's hosted version, update the URL in `public/kiri-viewer/index.html` to point to your self-hosted instance.

## Customizing the UI

The Kiri:Moto UI can be customized by editing the files in the `/app/src/kiri/` directory within the container, or by mounting your own custom files using the volumes section in the docker-compose.yml file.

## Building Your Own Custom Version

If you want to further customize the viewer:

1. Clone the grid-apps repository:
   ```bash
   git clone https://github.com/GridSpace/grid-apps.git
   ```

2. Follow the setup instructions in their README.

3. Modify the code as needed.

## Credits

Kiri:Moto is developed by [Stewart Allen](https://github.com/stephan-e) and is available under the MIT license. See the [grid-apps repository](https://github.com/GridSpace/grid-apps) for more information. 