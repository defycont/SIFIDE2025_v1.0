// update-index-html.js
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'dist', 'index.html');
const assetsDir = path.join(__dirname, 'dist', 'assets');

// buscar cualquier archivo .js generado por Vite
const jsFiles = fs.readdirSync(assetsDir).filter(file => file.endsWith('.js'));

if (!jsFiles.length) {
  console.error('❌ No se encontró ningún archivo JS en dist/assets.');
  process.exit(1);
}

// normalmente solo hay uno principal; tomamos el primero
const mainJs = jsFiles[0];
console.log(`✅ Archivo JS encontrado: ${mainJs}`);

// leemos index.html
let html = fs.readFileSync(htmlPath, 'utf8');

// reemplazamos cualquier <script type="module" src="…"></script>
html = html.replace(
  /<script type="module" src=".*"><\/script>/,
  `<script type="module" src="/assets/${mainJs}"></script>`
);

fs.writeFileSync(htmlPath, html);
console.log(`✅ index.html actualizado para usar: ${mainJs}`);
