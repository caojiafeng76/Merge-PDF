# Merge PDF

Vite + React + TypeScript document tools app with Express API routes.

## Development

```bash
bun install
bun run dev
```

`bun run dev` starts:

- Vite frontend on `http://localhost:5173`
- Express API on `http://localhost:3001`

The frontend proxies `/api/*` to the local Express API during development.

## Word To PDF

`POST /api/word-to-pdf` accepts a Word file in the multipart field named `file` and returns an `application/pdf` download.

The API is implemented with Express and is exported from `api/word-to-pdf.mjs` for Vercel Functions.

### Local LibreOffice Conversion

For local development, the Express API can call LibreOffice headless mode directly.

Install LibreOffice on the machine running the backend. If `soffice` is not on `PATH`, set `LIBREOFFICE_PATH`:

```powershell
$env:LIBREOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"
bun run dev
```

For Chinese documents, install the fonts used by the document on the backend machine to avoid missing glyphs or fallback changes.

### Vercel Deployment

Vercel Functions can run the Express API, but they do not include a system LibreOffice installation. Configure a converter service URL in Vercel:

```bash
WORD_TO_PDF_CONVERTER_URL=https://your-converter.example.com/api/word-to-pdf
```

The remote converter must accept the same multipart `file` field and return a PDF response. If the remote service requires auth, set:

```bash
WORD_TO_PDF_CONVERTER_TOKEN=your-token
```

Without `WORD_TO_PDF_CONVERTER_URL`, production requests on Vercel return `CONVERTER_NOT_CONFIGURED`.

## Build

```bash
bun run build
```

Vercel will build the Vite frontend and deploy files in `api/` as Functions.
