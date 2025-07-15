const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OPENAI_API_KEY = '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';

const FILTERS = [
  { name: 'Cosmic', style: 'cosmicaura', prompt: 'A round, colorful, abstract swirl with a cosmic galaxy theme, no text, white background, digital art, high detail.' },
  { name: 'Dream', style: 'dreamglow', prompt: 'A round, dreamy, glowing pastel abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Peach', style: 'peachypop', prompt: 'A round, soft, pastel peach-colored abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Frost', style: 'frostedglass', prompt: 'A round, icy, frosted glass effect with blue and white, no text, white background, digital art, high detail.' },
  { name: 'Neon', style: 'neonmuse', prompt: 'A round, neon glowing abstract shape with vibrant colors, no text, white background, digital art, high detail.' },
  { name: 'Retro', style: 'retrovibe', prompt: 'A round, retro 80s style abstract shape with pink, purple, and blue, no text, white background, digital art, high detail.' },
  { name: 'Blush', style: 'blushbloom', prompt: 'A round, soft pink blush abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Urban', style: 'urbanfade', prompt: 'A round, urban faded abstract shape with gray and blue, no text, white background, digital art, high detail.' },
  { name: 'Sun', style: 'sunkissed', prompt: 'A round, sun-kissed golden yellow abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Honey', style: 'honeyhaze', prompt: 'A round, honey golden abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Velvet', style: 'velvetskin', prompt: 'A round, soft velvet red abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Arctic', style: 'arcticchill', prompt: 'A round, arctic blue and white abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Noir', style: 'noirchic', prompt: 'A round, noir black and white abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Citrus', style: 'citrussplash', prompt: 'A round, citrus orange and green abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Mint', style: 'mintyfresh', prompt: 'A round, mint green abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Dusk', style: 'duskdream', prompt: 'A round, dusk purple and blue abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Glam', style: 'glamourdust', prompt: 'A round, glamorous sparkling abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Latte', style: 'lattecream', prompt: 'A round, creamy latte brown abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Sapphire', style: 'sapphireshine', prompt: 'A round, sapphire blue shiny abstract shape, no text, white background, digital art, high detail.' },
  { name: 'Candy', style: 'candycloud', prompt: 'A round, pastel candy-colored abstract shape, no text, white background, digital art, high detail.' },
];

const ICON_DIR = path.join(__dirname, 'public', 'filters');
if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });

async function generateIcon(filter) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: filter.prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate icon for ${filter.name}: ${await response.text()}`);
  }

  const data = await response.json();
  const b64 = data.data[0].b64_json;
  const buffer = Buffer.from(b64, 'base64');
  const tempFile = path.join(ICON_DIR, `${filter.name.toLowerCase()}_temp.png`);
  const finalFile = path.join(ICON_DIR, `${filter.name.toLowerCase()}.png`);
  fs.writeFileSync(tempFile, buffer);

  // Downscale to 128x128 using sharp
  await sharp(tempFile)
    .resize(128, 128)
    .png()
    .toFile(finalFile);

  fs.unlinkSync(tempFile); // remove temp file
  console.log(`Saved: ${finalFile}`);
}

(async () => {
  for (const filter of FILTERS) {
    try {
      await generateIcon(filter);
    } catch (e) {
      console.error(e);
    }
  }
})(); 