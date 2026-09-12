/**
 * database/init.js
 * Creates the campus_events database structure: collections with
 * light schema validation, and the mandatory indexes.
 *
 * Run with: npm run init
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'campus_events';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const existing = (await db.listCollections().toArray()).map((c) => c.name);

  // --- users collection ---
  if (!existing.includes('users')) {
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['firstName', 'lastName', 'email', 'department', 'role', 'interests', 'createdAt'],
          properties: {
            firstName: { bsonType: 'string' },
            lastName: { bsonType: 'string' },
            email: { bsonType: 'string', pattern: '^.+@.+\\..+$' },
            department: { bsonType: 'string' },
            role: { enum: ['student', 'staff', 'organizer'] },
            interests: { bsonType: 'array', items: { bsonType: 'string' } },
            createdAt: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'moderate',
    });
    console.log('Created collection: users');
  }

  // --- events collection ---
  if (!existing.includes('events')) {
    await db.createCollection('events', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['title', 'category', 'tags', 'startDate', 'endDate', 'capacity', 'location', 'organizerId', 'registrations', 'createdAt'],
          properties: {
            title: { bsonType: 'string', minLength: 1 },
            category: { bsonType: 'string' },
            tags: { bsonType: 'array', items: { bsonType: 'string' } },
            startDate: { bsonType: 'date' },
            endDate: { bsonType: 'date' },
            capacity: { bsonType: 'int', minimum: 1 },
            location: {
              bsonType: 'object',
              required: ['building', 'room', 'campus'],
            },
            organizerId: { bsonType: 'objectId' },
            registrations: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['userId', 'registeredAt', 'status'],
                properties: {
                  userId: { bsonType: 'objectId' },
                  registeredAt: { bsonType: 'date' },
                  status: { enum: ['confirmed', 'cancelled', 'waiting'] },
                },
              },
            },
            createdAt: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'moderate',
    });
    console.log('Created collection: events');
  }

  // --- indexes ---
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('events').createIndex({ startDate: 1 });
  await db.collection('events').createIndex({ category: 1 });
  await db.collection('events').createIndex({ tags: 1 });

  console.log('Indexes created: users.email (unique), events.startDate, events.category, events.tags');

  await client.close();
  console.log('Database initialization complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
