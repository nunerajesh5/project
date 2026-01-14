const { Pool } = require('pg');

const db4Config = {
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager4',
  user: 'postgres',
  password: 'Super@123'
};

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
};

async function getTableSchema(pool, tableName) {
  const query = `
    SELECT 
      column_name, 
      data_type, 
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position;
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

async function getTables(pool) {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  const result = await pool.query(query);
  return result.rows.map(r => r.table_name);
}

async function getTableDDL(pool, tableName) {
  const query = `
    SELECT 
      'CREATE TABLE IF NOT EXISTS ' || $1 || ' (' || 
      string_agg(
        column_name || ' ' || 
        CASE 
          WHEN data_type = 'USER-DEFINED' THEN udt_name
          WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
          WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
          ELSE UPPER(data_type)
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
      ) || ');' as ddl
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    GROUP BY table_name;
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows[0]?.ddl || null;
}

async function syncDatabases() {
  const pool4 = new Pool(db4Config);
  const poolTarget = new Pool(dbConfig);

  try {
    console.log('Connecting to databases...');
    
    // Get tables from source (project_time_manager4)
    const sourceTables = await getTables(pool4);
    console.log(`\nTables in project_time_manager4: ${sourceTables.length}`);
    console.log(sourceTables.join(', '));
    
    // Get tables from target (project_time_manager)
    const targetTables = await getTables(poolTarget);
    console.log(`\nTables in project_time_manager: ${targetTables.length}`);
    console.log(targetTables.join(', '));
    
    // Find tables to drop (exist in target but not in source)
    const tablesToDrop = targetTables.filter(t => !sourceTables.includes(t));
    
    // Find tables to add (exist in source but not in target)
    const tablesToAdd = sourceTables.filter(t => !targetTables.includes(t));
    
    console.log(`\n=== Analysis ===`);
    console.log(`Tables to DROP from project_time_manager: ${tablesToDrop.length}`);
    if (tablesToDrop.length > 0) {
      console.log(tablesToDrop.join(', '));
    }
    
    console.log(`\nTables to ADD to project_time_manager: ${tablesToAdd.length}`);
    if (tablesToAdd.length > 0) {
      console.log(tablesToAdd.join(', '));
    }
    
    // Compare columns for common tables
    const commonTables = sourceTables.filter(t => targetTables.includes(t));
    console.log(`\nTables to COMPARE columns: ${commonTables.length}`);
    
    const schemaDifferences = [];
    
    for (const table of commonTables) {
      const sourceSchema = await getTableSchema(pool4, table);
      const targetSchema = await getTableSchema(poolTarget, table);
      
      const sourceColumns = sourceSchema.map(c => c.column_name);
      const targetColumns = targetSchema.map(c => c.column_name);
      
      const columnsToAdd = sourceColumns.filter(c => !targetColumns.includes(c));
      const columnsToDrop = targetColumns.filter(c => !sourceColumns.includes(c));
      
      if (columnsToAdd.length > 0 || columnsToDrop.length > 0) {
        schemaDifferences.push({
          table,
          columnsToAdd,
          columnsToDrop,
          sourceSchema,
          targetSchema
        });
      }
    }
    
    if (schemaDifferences.length > 0) {
      console.log(`\n=== Tables with Column Differences: ${schemaDifferences.length} ===`);
      schemaDifferences.forEach(diff => {
        console.log(`\nTable: ${diff.table}`);
        if (diff.columnsToAdd.length > 0) {
          console.log(`  Columns to ADD: ${diff.columnsToAdd.join(', ')}`);
        }
        if (diff.columnsToDrop.length > 0) {
          console.log(`  Columns to DROP: ${diff.columnsToDrop.join(', ')}`);
        }
      });
    } else {
      console.log('\nNo column differences found in common tables.');
    }
    
    // Generate synchronization SQL
    console.log('\n\n=== SYNCHRONIZATION SQL ===\n');
    
    // Drop extra tables
    if (tablesToDrop.length > 0) {
      console.log('-- Drop extra tables');
      for (const table of tablesToDrop) {
        console.log(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      }
      console.log('');
    }
    
    // Add missing columns and drop extra columns
    if (schemaDifferences.length > 0) {
      console.log('-- Modify existing tables');
      for (const diff of schemaDifferences) {
        if (diff.columnsToDrop.length > 0) {
          for (const col of diff.columnsToDrop) {
            console.log(`ALTER TABLE ${diff.table} DROP COLUMN IF EXISTS ${col} CASCADE;`);
          }
        }
        
        if (diff.columnsToAdd.length > 0) {
          for (const col of diff.columnsToAdd) {
            const sourceCol = diff.sourceSchema.find(c => c.column_name === col);
            let dataType = sourceCol.data_type === 'USER-DEFINED' ? sourceCol.udt_name : sourceCol.data_type.toUpperCase();
            if (sourceCol.character_maximum_length && (sourceCol.data_type === 'character varying' || sourceCol.data_type === 'character')) {
              dataType = `VARCHAR(${sourceCol.character_maximum_length})`;
            }
            const nullable = sourceCol.is_nullable === 'YES' ? '' : ' NOT NULL';
            const defaultVal = sourceCol.column_default ? ` DEFAULT ${sourceCol.column_default}` : '';
            console.log(`ALTER TABLE ${diff.table} ADD COLUMN IF NOT EXISTS ${col} ${dataType}${nullable}${defaultVal};`);
          }
        }
        console.log('');
      }
    }
    
    // Add missing tables
    if (tablesToAdd.length > 0) {
      console.log('-- Create missing tables');
      for (const table of tablesToAdd) {
        // Get full DDL from pg_dump-like query
        const ddlQuery = `
          SELECT 
            'CREATE TABLE IF NOT EXISTS ' || c.table_name || ' (' || 
            string_agg(
              '  ' || c.column_name || ' ' || 
              CASE 
                WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
                WHEN c.data_type = 'character varying' AND c.character_maximum_length IS NOT NULL 
                  THEN 'VARCHAR(' || c.character_maximum_length || ')'
                WHEN c.data_type = 'character' AND c.character_maximum_length IS NOT NULL 
                  THEN 'CHAR(' || c.character_maximum_length || ')'
                WHEN c.data_type = 'numeric' AND c.numeric_precision IS NOT NULL 
                  THEN 'NUMERIC(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
                ELSE UPPER(c.data_type)
              END ||
              CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
              ', ' ORDER BY c.ordinal_position
            ) || 
            ');' as create_statement
          FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = $1
          GROUP BY c.table_name;
        `;
        
        const result = await pool4.query(ddlQuery, [table]);
        if (result.rows[0]) {
          console.log(result.rows[0].create_statement);
          console.log('');
        }
      }
    }
    
    console.log('\n=== END OF SYNCHRONIZATION SQL ===');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool4.end();
    await poolTarget.end();
  }
}

syncDatabases();
