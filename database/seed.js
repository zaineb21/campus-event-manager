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
  d.setHours(9, 30, 0, 0);
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

  const departments = ['Arts Plastiques', 'Histoire de l\'Art', 'Design & Arts Visuels', 'Communication & Medias', 'Architecture'];
  const roles = ['student', 'staff', 'organizer'];
  const interestsPool = ['Peinture', 'Photographie', 'Sculpture', 'Cinema', 'Design Graphique', 'Art Numerique', 'Musique', 'Poesie', 'Theatre', 'Architecture d\'Interieur'];

  const people = [
    ['Sirine', 'Belhadj', 'Arts Plastiques', 'student'],
    ['Anis', 'Chaabane', 'Histoire de l\'Art', 'staff'],
    ['Nesrine', 'Toumi', 'Design & Arts Visuels', 'organizer'],
    ['Skander', 'Jelassi', 'Communication & Medias', 'student'],
    ['Wafa', 'Bouzid', 'Architecture', 'staff'],
    ['Zied', 'Karray', 'Arts Plastiques', 'student'],
    ['Amira', 'Sassi', 'Histoire de l\'Art', 'organizer'],
    ['Bilel', 'Nasri', 'Design & Arts Visuels', 'staff'],
    ['Nada', 'Ouertani', 'Communication & Medias', 'student'],
    ['Slim', 'Baccouche', 'Architecture', 'student'],
    ['Meriem', 'Frikha', 'Arts Plastiques', 'organizer'],
    ['Hamza', 'Dridi', 'Design & Arts Visuels', 'staff'],
    ['Emna', 'Bahri', 'Histoire de l\'Art', 'student'],
    ['Karim', 'Sfaxi', 'Communication & Medias', 'organizer'],
    ['Lina', 'Chtourou', 'Architecture', 'staff'],
  ];

  const users = [];
  people.forEach(([firstName, lastName, department, role], i) => {
    users.push({
      _id: new ObjectId(),
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}@univ-campus.tn`,
      department,
      role,
      interests: pickRandom(interestsPool, 2 + (i % 3)),
      createdAt: daysFromNow(-(110 - i)),
    });
  });
  await db.collection('users').insertMany(users);
  console.log(`Inserted ${users.length} users.`);

  const categories = ['Exposition', 'Atelier', 'Conference', 'Projection', 'Rencontre', 'Vernissage'];
  const tagsPool = ['art', 'exposition', 'peinture', 'photographie', 'cinema', 'design', 'sculpture', 'musique', 'theatre', 'culture'];
  const buildings = ['Hall d\'Exposition', 'Batiment des Arts', 'Amphi Central', 'Galerie du Campus', 'Espace Culturel'];
  const rooms = ['Salle 1', 'Atelier B', 'Amphi A', 'Galerie Nord', 'Salle Polyvalente'];
  const campuses = ['Tunis', 'Sousse', 'Sfax'];

  const eventTitles = [
    'Vernissage : Regards Croises', 'Atelier Peinture a l\'Huile', 'Conference Histoire de l\'Art Moderne',
    'Projection Courts-Metrages Etudiants', 'Rencontre avec un Photographe', 'Exposition Sculptures Etudiantes',
    'Galerie Ephemere du Campus', 'Atelier Design Graphique', 'Soiree Poesie et Musique',
    'Conference Architecture Durable', 'Festival du Court-Metrage', 'Atelier Photographie Argentique',
    'Rencontre des Jeunes Createurs', 'Vernissage Art Numerique', 'Exposition Photo : Portraits du Campus',
    'Atelier Theatre d\'Improvisation', 'Conference Design et Societe', 'Gala de Cloture de l\'Annee Artistique',
  ];

  const events = [];
  const offsets = [-50, -35, -22, -12, -6, -3, 4, 6, 9, 13, 17, 22, 27, 33, 42, 58, 73, 95];

  for (let i = 0; i < eventTitles.length; i++) {
    const start = daysFromNow(offsets[i]);
    const end = new Date(start.getTime() + (1 + (i % 3)) * 90 * 60 * 1000);
    const organizer = users[(i * 4 + 2) % users.length];
    events.push({
      _id: new ObjectId(),
      title: eventTitles[i],
      description: `${eventTitles[i]} : un evenement organise pour les etudiants et le personnel afin de decouvrir, partager et s'exprimer autour de l'art et de la creation.`,
      category: categories[i % categories.length],
      tags: pickRandom(tagsPool, 2 + (i % 3)),
      startDate: start,
      endDate: end,
      capacity: 8 + (i % 6) * 4,
      location: {
        building: buildings[i % buildings.length],
        room: rooms[i % rooms.length],
        campus: campuses[i % campuses.length],
      },
      organizerId: organizer._id,
      registrations: [],
      createdAt: daysFromNow(-(95 - i)),
    });
  }

  const emptyIndexes = new Set([5, 11, 15]);
  let totalRegs = 0;
  for (let i = 0; i < events.length; i++) {
    if (emptyIndexes.has(i)) continue;
    const capacity = events[i].capacity;
    const howMany = Math.min(users.length, 2 + ((i + 1) % 6));
    const chosenUsers = pickRandom(users, howMany);
    let confirmedCount = 0;
    chosenUsers.forEach((u, idx) => {
      let status = 'confirmed';
      if (idx % 5 === 4) status = 'waiting';
      else if (idx % 8 === 7) status = 'cancelled';
      if (status === 'confirmed') {
        if (confirmedCount >= capacity) {
          status = 'waiting';
        } else {
          confirmedCount++;
        }
      }
      events[i].registrations.push({
        userId: u._id,
        registeredAt: daysFromNow(offsets[i] - 4 - idx),
        status,
      });
      totalRegs++;
    });
  }

  let idx = 0;
  while (totalRegs < 42) {
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