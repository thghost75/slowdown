# Slow Down Studio

Slow Down Studio is a simple browser-based audio tool for slowing music down before downloading it. It runs locally in the browser, so there is no server setup, account system, or build process required.

## Features

- Upload or drag and drop an audio file.
- Slow audio from `100%` up to `1000%`.
- Adjust the slowdown in `5%` increments with the slider or the `-5%` and `+5%` buttons.
- Enter an exact target length in minutes and seconds.
- Render and preview the slowed audio before downloading.
- Download the processed result as a WAV file.
- Includes a PayPal donation button.

## How To Use

1. Open `index.html` in a modern browser.
2. Choose or drag in an audio file.
3. Set the slowdown amount with the slider or the `-5%` / `+5%` buttons, or enter the exact target length you want in minutes and seconds.
4. Click `Render preview`.
5. Listen to the preview in the audio player.
6. Click `Download WAV` when you are happy with the result.

## Supported Audio

The app can load audio formats supported by your browser, such as MP3, WAV, M4A, OGG, and FLAC. Browser support may vary by device and operating system.

## Notes

Very long songs or very high slowdown settings can create large WAV files. For example, slowing a track down to `1000%` makes it 10 times longer, so the exported file can become much larger than the original. Exact target lengths are limited by the same slowdown range, so extremely long requested durations may be clamped to the supported maximum.

## Project Files

- `index.html` - Page markup and app structure.
- `styles.css` - Visual styling and responsive layout.
- `app.js` - Audio loading, slowdown rendering, preview, and WAV export logic.

## License

Copyright 2026 Umbra Studios. All rights reserved.
