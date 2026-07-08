const { Pool } = require('./node_modules/.pnpm/pg@8.20.0/node_modules/pg');
const p = new Pool({ connectionString: 'postgresql://openpg:openpgpwd@localhost:5432/sineas' });
const sql = `UPDATE videos SET video_url = REPLACE(video_url, '/objects/', '/api/storage/objects/') WHERE video_url LIKE '/objects/%' RETURNING id, title, video_url`;
p.query(sql).then(r => {
  r.rows.forEach(v => console.log('Updated:', JSON.stringify(v)));
  console.log('Total updated:', r.rowCount);
  p.end();
}).catch(e => { console.error(e.message); p.end(); });
