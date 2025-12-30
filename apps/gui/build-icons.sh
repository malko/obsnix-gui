#!/bin/bash
# filepath: /home/malko/git/divers/t2control/build-icons.sh

# Build icons script for OBSBOT T2 Control
# This script converts logo.svg to various icon formats needed for different platforms

echo "Building application icons from public/logo.svg..."

# Create icons directory
mkdir -p icons

# Check if public/logo.svg exists
if [ ! -f "public/logo.svg" ]; then
    echo "Error: public/logo.svg not found"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required but not installed"
    echo "Install with: sudo apt-get install imagemagick (Ubuntu/Debian)"
    echo "Or: brew install imagemagick (macOS)"
    exit 1
fi

# Function to convert SVG with proper viewBox handling
convert_svg() {
    local size=$1
    local output=$2

    # Use density and resize for better quality, and force background to transparent
    convert -background transparent -density 300 public/logo.svg -resize "${size}x${size}" -extent "${size}x${size}" -gravity center "$output"
}

# Generate PNG icons for different sizes with proper viewBox handling
echo "Generating PNG icons with proper viewBox handling..."
convert_svg 16 public/icons/icon_16x16.png
convert_svg 32 public/icons/icon_32x32.png
convert_svg 48 public/icons/icon_48x48.png
convert_svg 64 public/icons/icon_64x64.png
convert_svg 128 public/icons/icon_128x128.png
convert_svg 256 public/icons/icon_256x256.png
convert_svg 512 public/icons/icon_512x512.png
convert_svg 1024 public/icons/icon_1024x1024.png

# Create main icon.png (256x256 is a good default)
cp public/icons/icon_256x256.png public/icons/icon.png

# Alternative method using Inkscape if available (better SVG handling)
if command -v inkscape &> /dev/null; then
    echo "Inkscape found - using it for better SVG conversion..."

    # Inkscape handles SVG viewBox much better than ImageMagick
    inkscape --export-type=png --export-width=16 --export-height=16 --export-filename=public/icons/icon_16x16.png public/logo.svg
    inkscape --export-type=png --export-width=32 --export-height=32 --export-filename=public/icons/icon_32x32.png public/logo.svg
    inkscape --export-type=png --export-width=48 --export-height=48 --export-filename=public/icons/icon_48x48.png public/logo.svg
    inkscape --export-type=png --export-width=64 --export-height=64 --export-filename=public/icons/icon_64x64.png public/logo.svg
    inkscape --export-type=png --export-width=128 --export-height=128 --export-filename=public/icons/icon_128x128.png public/logo.svg
    inkscape --export-type=png --export-width=256 --export-height=256 --export-filename=public/icons/icon_256x256.png public/logo.svg
    inkscape --export-type=png --export-width=512 --export-height=512 --export-filename=public/icons/icon_512x512.png public/logo.svg
    inkscape --export-type=png --export-width=1024 --export-height=1024 --export-filename=public/icons/icon_1024x1024.png public/logo.svg

    # Update main icon
    cp public/icons/icon_256x256.png public/icons/icon.png
    echo "Used Inkscape for better SVG conversion quality"
elif command -v rsvg-convert &> /dev/null; then
    echo "rsvg-convert found - using it for better SVG conversion..."

    # rsvg-convert also handles SVG viewBox better than ImageMagick
    rsvg-convert -w 16 -h 16 -o public/icons/icon_16x16.png public/logo.svg
    rsvg-convert -w 32 -h 32 -o public/icons/icon_32x32.png public/logo.svg
    rsvg-convert -w 48 -h 48 -o public/icons/icon_48x48.png public/logo.svg
    rsvg-convert -w 64 -h 64 -o public/icons/icon_64x64.png public/logo.svg
    rsvg-convert -w 128 -h 128 -o public/icons/icon_128x128.png public/logo.svg
    rsvg-convert -w 256 -h 256 -o public/icons/icon_256x256.png public/logo.svg
    rsvg-convert -w 512 -h 512 -o public/icons/icon_512x512.png public/logo.svg
    rsvg-convert -w 1024 -h 1024 -o public/icons/icon_1024x1024.png public/logo.svg

    # Update main icon
    cp public/icons/icon_256x256.png public/icons/icon.png
    echo "Used rsvg-convert for better SVG conversion quality"
else
    echo "Note: For best results, install Inkscape or librsvg2-bin (rsvg-convert)"
    echo "  sudo apt-get install inkscape"
    echo "  sudo apt-get install librsvg2-bin"
fi

# Generate Windows ICO file (if icotool is available)
if command -v icotool &> /dev/null; then
    echo "Generating Windows ICO file..."
    icotool -c -o public/icons/icon.ico public/icons/icon_16x16.png public/icons/icon_32x32.png public/icons/icon_48x48.png public/icons/icon_64x64.png public/icons/icon_128x128.png public/icons/icon_256x256.png
else
    echo "Warning: icotool not found, skipping ICO generation"
    echo "Install with: sudo apt-get install icoutils (Ubuntu/Debian)"
fi

# Generate macOS ICNS file (if png2icns is available)
if command -v png2icns &> /dev/null; then
    echo "Generating macOS ICNS file..."
    png2icns public/icons/icon.icns public/icons/icon_*x*.png
elif command -v iconutil &> /dev/null; then
    echo "Generating macOS ICNS file using iconutil..."
    # Create iconset directory structure
    mkdir -p public/icons/icon.iconset
    cp public/icons/icon_16x16.png public/icons/icon.iconset/icon_16x16.png
    cp public/icons/icon_32x32.png public/icons/icon.iconset/icon_16x16@2x.png
    cp public/icons/icon_32x32.png public/icons/icon.iconset/icon_32x32.png
    cp public/icons/icon_64x64.png public/icons/icon.iconset/icon_32x32@2x.png
    cp public/icons/icon_128x128.png public/icons/icon.iconset/icon_128x128.png
    cp public/icons/icon_256x256.png public/icons/icon.iconset/icon_128x128@2x.png
    cp public/icons/icon_256x256.png public/icons/icon.iconset/icon_256x256.png
    cp public/icons/icon_512x512.png public/icons/icon.iconset/icon_256x256@2x.png
    cp public/icons/icon_512x512.png public/icons/icon.iconset/icon_512x512.png
    cp public/icons/icon_1024x1024.png public/icons/icon.iconset/icon_512x512@2x.png
    iconutil -c icns public/icons/icon.iconset
    rm -rf public/icons/icon.iconset
else
    echo "Warning: png2icns or iconutil not found, skipping ICNS generation"
    echo "On macOS, iconutil should be available by default"
    echo "On Linux, install with: sudo apt-get install icnsutils"
fi

echo "Icon generation complete!"
echo "Generated files:"
ls -la public/icons/

echo ""
echo "Conversion tools used:"
if command -v inkscape &> /dev/null; then
    echo "✓ Inkscape (best SVG support)"
elif command -v rsvg-convert &> /dev/null; then
    echo "✓ rsvg-convert (good SVG support)"
else
    echo "⚠ ImageMagick only (basic SVG support)"
fi

echo ""
echo "To improve SVG conversion quality, install:"
echo "  sudo apt-get install inkscape          # Best option"
echo "  sudo apt-get install librsvg2-bin     # Good alternative"