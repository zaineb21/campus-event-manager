/**
 * database/seed.js
 * Reproducible seed script: clears users/events and inserts coherent
 * sample data (15 users, 18 events, 5+ categories, 8+ tags,
 * 40+ registrations, past/future/empty events).
 *
 * Run with: npm run seed   (after: npm run init)
 */
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'campus_events';

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  await db.collection('users').deleteMany({});
  await db.collection('events').deleteMany({});

  const departments = ['Computer Science', 'Business', 'Design', 'Electrical Engineering', 'Marketing'];
  const roles = ['student', 'staff', 'organizer'];
  const interestsPool = ['AI', 'Cloud Computing', 'Robotics', 'Design', 'Finance', 'Music', 'Sports', 'Data Science', 'Networking', 'Entrepreneurship'];

  const firstNames = ['Alice', 'Bilal', 'Chloe', 'David', 'Emeka', 'Fatima', 'Guo', 'Hana', 'Ivan', 'Julia', 'Karim', 'Lea', 'Marco', 'Nadia', 'Omar'];
  const lastNames = ['Martin', 'Dupont', 'Diallo', 'Nguyen', 'Kone', 'Silva', 'Zhang', 'Haddad', 'Petrov', 'Bernard', 'Moreau', 'Faye', 'Rossi', 'Kader', 'Leroy'];

  const users = [];
  for (let i = 0; i < 15; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    users.push({
      _id: new ObjectId(),
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@campus.edu`,
      department: departments[i % departments.length],
      role: roles[i % roles.length],
      interests: pickRandom(interestsPool, 2 + (i % 3)),
      createdAt: daysFromNow(-(120 - i)),
    });
  }
  await db.collection('users').insertMany(users);
  console.log(`Inserted ${users.length} users.`);

  const categories = ['Workshop', 'Talk', 'Meetup', 'Hackathon', 'Career Fair', 'Culture'];
  const tagsPool = ['ai', 'cloud', 'career', 'networking', 'music', 'sports', 'design', 'startup', 'sustainability', 'robotics'];
  const buildings = ['Innovation Center', 'Main Auditorium', 'Library Hall', 'Science Building', 'Sports Complex'];
  const rooms = ['A101', 'B204', 'C310', 'Amphitheatre 1', 'Gymnasium'];
  const campuses = ['Paris', 'Lyon', 'Lille'];

  const eventTitles = [
    'Intro to Machine Learning', 'Cloud Architecture Bootcamp', 'Startup Pitch Night',
    'Campus Hackathon 2026', 'Design Thinking Workshop', 'Career Fair - Tech Sector',
    'Robotics Demo Day', 'Data Science Career Talk', 'Networking Mixer for Alumni',
    'Sustainability in Tech Panel', 'Music & Arts Festival', 'Football Tournament Kickoff',
    'DevOps Fundamentals', 'Women in Engineering Meetup', 'Blockchain Explained',
    'Public Speaking Workshop', 'Cybersecurity Awareness Talk', 'End of Semester Gala',
  ];

  const events = [];
  // spread events across time: some past, some future
  const offsets = [-45, -30, -20, -10, -5, -2, 3, 5, 8, 12, 15, 20, 25, 30, 40, 55, 70, 90];

  for (let i = 0; i < eventTitles.length; i++) {
    const start = daysFromNow(offsets[i]);
    const end = new Date(start.getTime() + (2 + (i % 3)) * 60 * 60 * 1000);
    const organizer = users[(i * 3) % users.length];
    events.push({
      _id: new ObjectId(),
      title: eventTitles[i],
      description: `${eventTitles[i]} is an event organized for students and staff to learn, network and collaborate.`,
      category: categories[i % categories.length],
      tags: pickRandom(tagsPool, 2 + (i % 3)),
      startDate: start,
      endDate: end,
      capacity: 10 + (i % 5) * 5,
      location: {
        building: buildings[i % buildings.length],
        room: rooms[i % rooms.length],
        campus: campuses[i % campuses.length],
      },
      organizerId: organizer._id,
      registrations: [],
      createdAt: daysFromNow(-(100 - i)),
    });
  }

  // Distribute at least 40 registrations. Leave a few events (indices 8, 13, 16) with none.
  const emptyIndexes = new Set([8, 13, 16]);
  let totalRegs = 0;
  for (let i = 0; i < events.length; i++) {
    if (emptyIndexes.has(i)) continue;
    const capacity = events[i].capacity;
    const howMany = Math.min(users.length, 2 + (i % 6)); // varies per event
    const chosenUsers = pickRandom(users, howMany);
    let confirmedCount = 0;
    chosenUsers.forEach((u, idx) => {
      let status = 'confirmed';
      if (idx % 6 === 5) status = 'waiting';
      else if (idx % 7 === 6) status = 'cancelled';
      if (status === 'confirmed') {
        if (confirmedCount >= capacity) {
          status = 'waiting'; // respect capacity in seed data
        } else {
          confirmedCount++;
        }
      }
      events[i].registrations.push({
        userId: u._id,
        registeredAt: daysFromNow(offsets[i] - 5 - idx),
        status,
      });
      totalRegs++;
    });
  }

  // Ensure we reach at least 40 registrations; top up on a few large events if needed
  let idx = 0;
  while (totalRegs < 40) {
    const e = events[idx % events.length];
    if (!emptyIndexes.has(idx % events.length)) {
      const candidate = users[Math.floor(Math.random() * users.length)];
      const already = e.registrations.some((r) => r.userId.equals(candidate._id));
      if (!already) {
        e.registrations.push({ userId: candidate._id, registeredAt: new Date(), status: 'waiting' });
        totalRegs++;
      }
    }
    idx++;
  }

  await db.collection('events').insertMany(events);
  console.log(`Inserted ${events.length} events with ${totalRegs} total registrations.`);
  console.log('Seed complete.');

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
