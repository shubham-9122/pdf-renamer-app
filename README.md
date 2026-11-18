# PDF Renamer

An Android app that renames FASTag report PDFs with a custom prefix, extracted vehicle number, and today's date.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js)
- **Free Expo account** — sign up at [expo.dev](https://expo.dev)

## Build an APK

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log in to Expo

```bash
eas login
```

Enter your Expo account credentials when prompted.

### 3. Navigate to the project

```bash
cd "c:\Users\rajsh\OneDrive\Desktop\Rename pro\pdf-renamer-app"
```

### 4. Configure EAS project (first time only)

```bash
eas build:configure
```

Accept all prompts. This links the project to your Expo account.

### 5. Build the APK

```bash
eas build --platform android --profile preview
```

The build runs in the cloud on Expo's servers. It typically takes 5–15 minutes.

### 6. Download the APK

When the build finishes, EAS prints a URL like:
```
✔ Build finished. Artifact URL: https://expo.dev/artifacts/eas/...apk
```
Open that URL in your browser to download the `.apk` file.

### 7. Install on your Android phone

1. Transfer the `.apk` to your phone (email, USB, Google Drive, etc.).
2. On your phone, go to **Settings → Security** (or **Apps → Special app access**) and enable **Install unknown apps** for your file manager or browser.
3. Open the `.apk` file and tap **Install**.

## How to use the app

1. **Enter a prefix** in the text field at the top (e.g. `Shubham`). This is saved automatically for next time.
2. Tap **Pick PDFs** and select one or more FASTag report PDF files.
3. The app reads each filename (and the PDF content if needed) to extract the vehicle registration number, then proposes a new name in the format:  
   `Shubham_BR10AL3536_fastag_report_18th Nov26.pdf`
4. Review the proposed names. Each row has an editable text field — tap it to correct the name if the vehicle number was not detected automatically.
5. Tap **Save** on a single file to share/save it with the new name, or tap **Rename All** to process every file at once.
6. The share sheet opens so you can save the file to Downloads, Google Drive, WhatsApp, etc.

## Filename format

| Part | Example | Notes |
|------|---------|-------|
| Prefix | `Shubham` | Entered by the user |
| Vehicle number | `BR10AL3536` | Extracted from filename or PDF content |
| Label | `fastag_report` | Fixed |
| Date | `18th Nov26` | Day + ordinal suffix + 3-letter month + 2-digit year |

Ordinal suffixes: 1/21/31 → st · 2/22 → nd · 3/23 → rd · all others → th

## Project structure

```
pdf-renamer-app/
├── App.js          # Full app logic and UI
├── app.json        # Expo configuration
├── eas.json        # EAS Build profiles
├── package.json    # Dependencies
└── assets/         # Icons and splash images
```
