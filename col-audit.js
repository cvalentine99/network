const mysql = require('mysql2/promise');
const fs = require('fs');
(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const tables = fs.readFileSync('/tmp/schema_tables.txt', 'utf-8').trim().split('\n');
  
  // Read schema.ts to extract column names per table
  const schema = fs.readFileSync('/home/ubuntu/network-performance-app/drizzle/schema.ts', 'utf-8');
  
  let divergences = [];
  
  for (const table of tables) {
    const [dbCols] = await conn.execute(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      [table]
    );
    const dbColNames = new Set(dbCols.map(c => c.COLUMN_NAME));
    
    // Extract column names from migration SQL for this table
    const migFile = table === 'users' ? 'drizzle/0000_amusing_nomad.sql' : 'drizzle/0001_free_junta.sql';
    const migSql = fs.readFileSync('/home/ubuntu/network-performance-app/' + migFile, 'utf-8');
    
    // Find the CREATE TABLE block for this table
    const regex = new RegExp('CREATE TABLE `' + table + '` \\(([\\s\\S]*?)\\);', 'm');
    const match = migSql.match(regex);
    if (!match) {
      divergences.push({ table, issue: 'TABLE NOT IN MIGRATION: ' + migFile });
      continue;
    }
    
    // Extract column names from CREATE TABLE
    const colLines = match[1].split('\n').filter(l => l.trim().startsWith('`'));
    const migColNames = new Set(colLines.map(l => l.trim().match(/^`([^`]+)`/)?.[1]).filter(Boolean));
    
    // Compare DB vs migration
    for (const col of dbColNames) {
      if (!migColNames.has(col)) {
        divergences.push({ table, issue: 'DB has column not in migration: ' + col });
      }
    }
    for (const col of migColNames) {
      if (!dbColNames.has(col)) {
        divergences.push({ table, issue: 'Migration has column not in DB: ' + col });
      }
    }
  }
  
  if (divergences.length === 0) {
    console.log('NO COLUMN-LEVEL DIVERGENCES between migration SQL and DB');
  } else {
    console.log('DIVERGENCES FOUND:');
    divergences.forEach(d => console.log('  ' + d.table + ': ' + d.issue));
  }
  
  await conn.end();
})().catch(e => console.error(e));
