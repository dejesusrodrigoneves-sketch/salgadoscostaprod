const app = require('./src/app');
const http = require('http');
const srv = http.createServer(app);
srv.listen(3009, () => {
  console.log('listening');
  setTimeout(() => {
    http.get('http://localhost:3009/api/loja/settings?slug=salgadoscosta', (res) => {
      console.log('Status:', res.statusCode);
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('Response:', body);
        srv.close();
        process.exit(0);
      });
    }).on('error', e => {
      console.log('Error:', e.message);
      srv.close();
      process.exit(1);
    });
  }, 3000);
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 30000);
