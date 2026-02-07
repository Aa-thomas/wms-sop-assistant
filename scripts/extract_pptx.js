const fs = require('fs');
const path = require('path');
const PptxParser = require('node-pptx-parser').default;

const SOURCE_DIR = path.join(__dirname, '..', 'data', 'source');
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'extracted');
const INDEX_PATH = path.join(SOURCE_DIR, 'index.json');

function extractTextFromSlide(slideData) {
  const texts = [];
  if (slideData['p:sld'] &&
      slideData['p:sld']['p:cSld'] &&
      slideData['p:sld']['p:cSld'][0]['p:spTree']) {
    const spTree = slideData['p:sld']['p:cSld'][0]['p:spTree'][0];
    if (spTree['p:sp']) {
      spTree['p:sp'].forEach(shape => {
        if (shape['p:txBody']) {
          shape['p:txBody'].forEach(textBody => {
            if (textBody['a:p']) {
              const paragraphTexts = [];
              textBody['a:p'].forEach(paragraph => {
                const parts = [];
                if (paragraph['a:r']) {
                  paragraph['a:r'].forEach(run => {
                    if (run['a:t']) {
                      parts.push(run['a:t'][0]);
                    }
                  });
                }
                if (parts.length > 0) {
                  paragraphTexts.push(parts.join(''));
                }
              });
              if (paragraphTexts.length > 0) {
                texts.push(paragraphTexts.join('\n'));
              }
            }
          });
        }
      });
    }
  }
  return texts;
}

async function extractFile(entry) {
  const filePath = path.join(SOURCE_DIR, entry.file_name);
  console.log(`Extracting: ${entry.file_name}`);

  const parser = new PptxParser(filePath);
  const parsed = await parser.parse();

  // Get visual slide order from presentation.xml
  const sldIdLst = parsed.presentation.parsed['p:presentation']['p:sldIdLst'][0]['p:sldId'];
  const orderedRIds = sldIdLst.map(s => s['$']['r:id']);

  // Build a map of rId -> slide parsed data
  const slideMap = {};
  for (const slide of parsed.slides) {
    slideMap[slide.id] = slide.parsed;
  }

  // Extract text in visual order
  const slides = [];
  for (let i = 0; i < orderedRIds.length; i++) {
    const rId = orderedRIds[i];
    const slideParsed = slideMap[rId];
    if (!slideParsed) continue;

    const texts = extractTextFromSlide(slideParsed)
      .map(t => t.replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 0);

    const title = texts[0] || '';
    const bullets = texts.slice(1);

    if (title.length > 0 || bullets.length > 0) {
      slides.push({
        number: i + 1,
        title,
        bullets
      });
    }
  }

  return {
    doc_title: entry.doc_title,
    module: entry.module,
    slides
  };
}

async function main() {
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
      const result = await extractFile(entry);
      const outputPath = path.join(OUTPUT_DIR, `${entry.doc_title.replace(/[/\\]/g, '_')}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`  -> ${result.slides.length} slides -> ${outputPath}`);
      totalSlides += result.slides.length;
    } catch (err) {
      console.error(`ERROR extracting ${entry.file_name}:`, err.message);
    }
  }

  console.log(`\nDone. Extracted ${totalSlides} slides from ${index.length} files.`);
}

main().catch(console.error);
