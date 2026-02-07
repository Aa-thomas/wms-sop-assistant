const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const SOURCE_DIR = path.join(__dirname, '..', 'data', 'source');
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'images');
const INDEX_PATH = path.join(SOURCE_DIR, 'index.json');

function sanitizeDocTitle(docTitle) {
  return docTitle.replace(/\s+/g, '_');
}

function exportFile(entry) {
  const filePath = path.join(SOURCE_DIR, entry.file_name);
  const sanitized = sanitizeDocTitle(entry.doc_title);
  const outDir = path.join(OUTPUT_DIR, sanitized);

  console.log(`Exporting: ${entry.file_name}`);

  // Create output directory
  fs.mkdirSync(outDir, { recursive: true });

  // Use a temp directory for intermediate PDF
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-export-'));

  try {
    // Step 1: Convert PPTX to PDF via LibreOffice headless
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${tmpDir}" "${filePath}"`,
      { stdio: 'pipe', timeout: 120000 }
    );

    // Find the generated PDF
    const pdfFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      throw new Error('LibreOffice did not produce a PDF');
    }
    const pdfPath = path.join(tmpDir, pdfFiles[0]);

    // Step 2: Split PDF into per-page PNGs using pdftoppm
    const prefix = path.join(tmpDir, 'slide');
    execSync(
      `pdftoppm -png -r 150 "${pdfPath}" "${prefix}"`,
      { stdio: 'pipe', timeout: 120000 }
    );

    // Step 3: Rename and move PNGs to output directory
    // pdftoppm produces files like slide-01.png, slide-02.png, etc.
    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
      .sort();

    for (let i = 0; i < pngFiles.length; i++) {
      const src = path.join(tmpDir, pngFiles[i]);
      const dest = path.join(outDir, `slide_${i + 1}.png`);
      fs.copyFileSync(src, dest);
    }

    console.log(`  -> ${pngFiles.length} slides -> ${outDir}`);
    return pngFiles.length;
  } finally {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalSlides = 0;

  for (const entry of index) {
    const filePath = path.join(SOURCE_DIR, entry.file_name);
    if (!fs.existsSync(filePath)) {
      console.error(`SKIP - File not found: ${entry.file_name}`);
      continue;
    }

    try {
      totalSlides += exportFile(entry);
    } catch (err) {
      console.error(`ERROR exporting ${entry.file_name}:`, err.message);
    }
  }

  console.log(`\nDone. Exported ${totalSlides} slide images from ${index.length} files.`);
}

main();
