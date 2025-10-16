const fs = require('fs');
const readline = require('readline');
const chokidar = require('chokidar');
const mysql = require('mysql2/promise');

// MySQL connection config
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'rootpassword',
  database: 'nginx_logs',
};

// Log files
const accessLogFile = '/var/log/nginx/access.log';
const errorLogFile = '/var/log/nginx/error.log';

// Insert raw log into MySQL
async function insertRawLog(type, line) {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      `INSERT INTO raw_logs (type, log_line) VALUES (?, ?)`,
      [type, line]
    );
    await conn.end();
  } catch (err) {
    console.error('DB Insert Error:', err.message);
  }
}

// Watch a file for changes
function watchFile(file, type) {
  let fileSize = fs.existsSync(file) ? fs.statSync(file).size : 0;

  chokidar.watch(file).on('change', async () => {
    const newSize = fs.statSync(file).size;
    if (newSize < fileSize) fileSize = 0; // file rotated

    const stream = fs.createReadStream(file, { start: fileSize, end: newSize });
    const rl = readline.createInterface({ input: stream });

    for await (const line of rl) {
      if (line.trim()) await insertRawLog(type, line);
    }

    fileSize = newSize;
  });
}

// Start watching logs
watchFile(accessLogFile, 'access');
watchFile(errorLogFile, 'error');

console.log('Watching nginx logs (raw dump)...');
