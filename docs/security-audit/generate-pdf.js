const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const htmlPath = path.join(__dirname, 'relatorio.html');
  const pdfPath = path.join(__dirname, 'relatorio-auditoria-seguranca.pdf');
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center;margin-top:10px;">Relatório de Auditoria de Segurança — SIC-IA</div>',
    footerTemplate: '<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  
  console.log('PDF gerado:', pdfPath);
  const stats = fs.statSync(pdfPath);
  console.log('Tamanho:', (stats.size / 1024).toFixed(1), 'KB');
  
  await browser.close();
})();
