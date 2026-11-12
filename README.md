[![Open in GitHub Pages](https://img.shields.io/badge/Open%20Demo-GitHub%20Pages-blue?logo=github)](https://raycastly.github.io/texture-ripper) 👈 Click here to open the app

# Raycastly Texture Ripper

Raycastly Texture Ripper is a tool that lets you extract textures from angled or perspective photos — making it easier for artists and game developers to turn real-world images into usable assets.

This tool is based on the Shoebox Texture Ripper. I didn't like the controls on that tool and the fact that it was relying on deprecated software. So I decided to build my own version.

![Match Texture Extraction Example](img/matches-demo.jpg)

---

## ✨ Features
- 📐 **Perspective Correction** — automatically flatten angled regions into usable textures
- 🖼 **Batch Extraction** — extract textures from multiple images in one go
- 🎨 **Atlas Packing** — arrange, rotate, and scale textures into a single texture atlas
- ⚙️ **Output Control** — set texture resolution and transparency for exports
- 🔄 **90° Rotation Snapping** — quickly snap textures to standard angles
- 📏 **Guidelines & Position Snapping** — snap to edges, guides, and other textures for precise placement
- 🔧 **Multi-Select Transformations** — scale, rotate, and translate multiple textures at once
- 📐 **Uniform & Non-Uniform Scaling** — scale textures proportionally or freely along X/Y axes

---

## 🍎 macOS Desktop

This fork adds a desktop build for Apple Silicon (`arm64`) and Intel (`x64`) Macs while preserving the browser and Windows versions. Download the DMG for your architecture from [this fork's Releases](https://github.com/tugai-code/texture-ripper/releases/latest), open it, and drag **Texture Ripper** to **Applications**.

The current macOS packages are unsigned and not notarized. macOS may warn that the developer cannot be verified. If you trust the build, open the app from Finder with **Control-click → Open** and confirm. macOS builds open the Releases page for updates; Windows packages retain automatic updates.

### Run and build locally

Requirements: macOS, Node.js 20 or later, and npm.

```bash
npm ci
npm start
```

Build both architectures as DMG and ZIP packages in `dist/`:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```

To create signed and notarized release packages, configure your Apple Developer credentials instead of disabling identity discovery. The app includes hardened-runtime entitlements and an ICNS icon.

Original application by [Maksim Jovovic / Raycastly](https://github.com/raycastly/texture-ripper). This macOS work is maintained in the [tugai-code fork](https://github.com/tugai-code/texture-ripper). The upstream repository does not currently include a license file.

---

## 🚀 How to Use

[![Watch the 5 minute tutorial!](img/click-to-watch.jpg)](https://youtu.be/35BKxvY3vLY)

1. Go to [Raycastly Texture Ripper](https://raycastly.github.io/texture-ripper) or open the desktop app.
2. Open several images or a reference folder. Use the thumbnails below the source canvas to switch between independent reference screens.
3. Lock the active image so it doesn’t accidentally move.
4. Press **S** or enable drawing mode with **A**, then click exactly four points. The selection closes automatically.
5. Right-click a selection and choose **Create Texture**, or press **Extract All** to process every changed selection.
6. Use the right panel to set the output resolution. The atlas preview fits the panel while preserving the exact export aspect ratio.
7. Position, rotate, and scale the extracted textures. Right-click a texture for **Fill Atlas**, **1/2 Atlas**, **1/4 Atlas**, and **1/8 Atlas**; these options preserve proportions and center it.
8. Adjust polygons and extract them again to refresh their textures.
9. Choose whether to export with a transparent background.
10. Click **Export** — your textures are ready 🎉

---

## ⚠️ Known Issues
- Draw mode can get bugged if you pan with the middle mouse button in the middle of drawing a polygon
- Scaling extracted textures does not snap to edges yet
