const https = require('https');
const fs = require('fs');

const url = 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Logo_Kementerian_Pekerjaan_Umum_Republik_Indonesia.svg';
const file = fs.createWriteStream('C:\\Users\\psdaf\\.gemini\\antigravity\\scratch\\neraca-air-maluku\\public\\logo-pu.svg');

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
}, function(response) {
  if (response.statusCode === 200) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();
      console.log('Download completed');
    });
  } else {
    console.log('Failed with status code:', response.statusCode);
  }
}).on('error', function(err) {
  fs.unlink('public/logo-pu.svg');
  console.error('Error downloading:', err.message);
});
