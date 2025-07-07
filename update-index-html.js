// update-index-html.js
const fs = require('fs');
const path = require('path');

// Ruta al archivo index.html
const htmlPath = path.join(__dirname, 'dist', 'index.html');
// Carpeta donde Vite coloca los assets
const assetsDir = path.join(__dirname, 'dist', 'assets');

// Buscar el archivo JS principal generado por Vite
const jsFile = fs.readdirSync(assetsDir).find(file => file.endsWith('.js') && file.includes('index'));

if (!jsFile) {
  console.error('❌ No se encontró ningún archivo JS de Vite en dist/assets.');
  process.exit(1);
}

// Leer el contenido actual del HTML
let html = fs.readFileSync(htmlPath, 'utf8');

// Reemplazar la línea del script
html = html.replace(
  /<script type="module" src=".*"><\/script>/,
  `<script type="module" src="/assets/${jsFile}"></script>`
);

// Guardar el HTML actualizado
fs.writeFileSync(htmlPath, html);
console.log(`✅ index.html actualizado con: ${jsFile}`);
