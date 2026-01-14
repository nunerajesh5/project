const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'project_time_manager',
  user: 'postgres',
  password: 'Super@123'
});

async function seedCountriesAndStates() {
  console.log('Seeding countries and states tables...\n');

  // Countries data with their states
  const countriesData = [
    {
      name: 'India',
      code: 'IN',
      states: ['Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Delhi', 'Gujarat', 'Rajasthan', 'West Bengal', 'Kerala', 'Telangana']
    },
    {
      name: 'United States',
      code: 'US',
      states: ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'Michigan', 'Washington']
    },
    {
      name: 'United Kingdom',
      code: 'GB',
      states: ['England', 'Scotland', 'Wales', 'Northern Ireland']
    },
    {
      name: 'Canada',
      code: 'CA',
      states: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan']
    },
    {
      name: 'Australia',
      code: 'AU',
      states: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia']
    },
    {
      name: 'Germany',
      code: 'DE',
      states: ['Bavaria', 'Berlin', 'Hamburg', 'Hesse', 'North Rhine-Westphalia']
    },
    {
      name: 'France',
      code: 'FR',
      states: ['Île-de-France', 'Provence-Alpes-Côte d\'Azur', 'Occitanie', 'Nouvelle-Aquitaine']
    },
    {
      name: 'Singapore',
      code: 'SG',
      states: ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region']
    },
    {
      name: 'UAE',
      code: 'AE',
      states: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Fujairah']
    },
    {
      name: 'Japan',
      code: 'JP',
      states: ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Fukuoka']
    }
  ];

  try {
    // Clear existing data
    await pool.query('DELETE FROM states');
    await pool.query('DELETE FROM countries');
    console.log('Cleared existing data from countries and states tables\n');

    let countriesInserted = 0;
    let statesInserted = 0;

    for (const country of countriesData) {
      // Insert country
      const countryResult = await pool.query(
        `INSERT INTO countries (name, code, is_active, created_at, updated_at)
         VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING country_id`,
        [country.name, country.code]
      );
      const countryId = countryResult.rows[0].country_id;
      countriesInserted++;
      console.log(`✓ Inserted country: ${country.name} (ID: ${countryId})`);

      // Insert states for this country
      for (const stateName of country.states) {
        await pool.query(
          `INSERT INTO states (name, country_id, is_active, created_at, updated_at)
           VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [stateName, countryId]
        );
        statesInserted++;
      }
      console.log(`  └─ Inserted ${country.states.length} states for ${country.name}`);
    }

    console.log(`\n=== Summary ===`);
    console.log(`Countries inserted: ${countriesInserted}`);
    console.log(`States inserted: ${statesInserted}`);

    // Verify the data
    console.log('\n=== Verification ===');
    const countriesCount = await pool.query('SELECT COUNT(*) as count FROM countries');
    const statesCount = await pool.query('SELECT COUNT(*) as count FROM states');
    console.log(`Countries in table: ${countriesCount.rows[0].count}`);
    console.log(`States in table: ${statesCount.rows[0].count}`);

    // Show sample data
    console.log('\n=== Sample Data ===');
    const sampleCountries = await pool.query('SELECT country_id, name, code FROM countries LIMIT 5');
    console.log('\nFirst 5 countries:');
    sampleCountries.rows.forEach(c => console.log(`  ${c.name} (${c.code}) - ID: ${c.country_id}`));

    const sampleStates = await pool.query(`
      SELECT s.state_id, s.name as state_name, c.name as country_name 
      FROM states s 
      JOIN countries c ON s.country_id = c.country_id 
      LIMIT 10
    `);
    console.log('\nFirst 10 states:');
    sampleStates.rows.forEach(s => console.log(`  ${s.state_name} (${s.country_name}) - ID: ${s.state_id}`));

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await pool.end();
  }
}

seedCountriesAndStates();
