const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');

const router = express.Router();

function confirmedCountStage() {
  return {
    $addFields: {
      confirmedCount: {
        $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } },
      },
    },
  };
}

// LIST + search + filters + sort
router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const { q, category, tag, when, sort } = req.query;
    const match = {};
    if (q) match.title = { $regex: q, $options: 'i' };
    if (category) match.category = category;
    if (tag) match.tags = tag;
    if (when === 'upcoming') match.startDate = { $gte: new Date() };
    if (when === 'past') match.startDate = { $lt: new Date() };

    const sortStage = {};
    sortStage.startDate = sort === 'desc' ? -1 : 1;

    const events = await db
      .collection('events')
      .aggregate([{ $match: match }, confirmedCountStage(), { $sort: sortStage }])
      .toArray();

    const categories = await db.collection('events').distinct('category');
    const tags = await db.collection('events').distinct('tags');

    res.render('events/index', { events, categories, tags, query: req.query });
  } catch (err) {
    next(err);
  }
});

// NEW form
router.get('/new', async (req, res, next) => {
  try {
    const db = getDB();
    const users = await db.collection('users').find().sort({ lastName: 1 }).toArray();
    res.render('events/form', { event: null, users, error: null });
  } catch (err) {
    next(err);
  }
});

// CREATE
router.post('/', async (req, res, next) => {
  try {
    const db = getDB();
    const { title, description, category, tags, startDate, endDate, capacity, building, room, campus, organizerId } = req.body;

    const errors = [];
    if (!title || !title.trim()) errors.push('Event title cannot be empty.');
    const cap = parseInt(capacity, 10);
    if (!cap || cap <= 0) errors.push('Capacity must be greater than 0.');
    if (new Date(endDate) < new Date(startDate)) errors.push('End date cannot be before start date.');

    if (errors.length) {
      const users = await db.collection('users').find().sort({ lastName: 1 }).toArray();
      return res.status(400).render('events/form', { event: req.body, users, error: errors.join(' ') });
    }

    await db.collection('events').insertOne({
      title: title.trim(),
      description: description || '',
      category,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      capacity: cap,
      location: { building, room, campus },
      organizerId: new ObjectId(organizerId),
      registrations: [],
      createdAt: new Date(),
    });

    res.redirect('/events');
  } catch (err) {
    next(err);
  }
});

// DETAIL + registrations
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const event = await db.collection('events').findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).render('error', { message: 'Event not found' });

    const organizer = await db.collection('users').findOne({ _id: event.organizerId });

    const regUserIds = event.registrations.map((r) => r.userId);
    const regUsers = await db.collection('users').find({ _id: { $in: regUserIds } }).toArray();
    const regUsersMap = {};
    regUsers.forEach((u) => (regUsersMap[u._id.toString()] = u));

    const participants = event.registrations.map((r) => ({
      ...r,
      user: regUsersMap[r.userId.toString()] || null,
    }));

    const confirmedCount = event.registrations.filter((r) => r.status === 'confirmed').length;
    const occupancy = event.capacity ? Math.round((confirmedCount / event.capacity) * 100) : 0;

    const allUsers = await db.collection('users').find().sort({ lastName: 1 }).toArray();
    const registeredIds = new Set(event.registrations.map((r) => r.userId.toString()));
    const availableUsers = allUsers.filter((u) => !registeredIds.has(u._id.toString()));

    res.render('events/detail', {
      event,
      organizer,
      participants,
      confirmedCount,
      occupancy,
      availableUsers,
      error: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
});

// EDIT form
router.get('/:id/edit', async (req, res, next) => {
  try {
    const db = getDB();
    const event = await db.collection('events').findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).render('error', { message: 'Event not found' });
    const users = await db.collection('users').find().sort({ lastName: 1 }).toArray();
    res.render('events/form', { event, users, error: null });
  } catch (err) {
    next(err);
  }
});

// UPDATE
router.put('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const { title, description, category, tags, startDate, endDate, capacity, building, room, campus, organizerId } = req.body;

    const errors = [];
    if (!title || !title.trim()) errors.push('Event title cannot be empty.');
    const cap = parseInt(capacity, 10);
    if (!cap || cap <= 0) errors.push('Capacity must be greater than 0.');
    if (new Date(endDate) < new Date(startDate)) errors.push('End date cannot be before start date.');

    if (errors.length) {
      const users = await db.collection('users').find().sort({ lastName: 1 }).toArray();
      return res.status(400).render('events/form', { event: { _id: req.params.id, ...req.body }, users, error: errors.join(' ') });
    }

    await db.collection('events').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          title: title.trim(),
          description: description || '',
          category,
          tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          capacity: cap,
          location: { building, room, campus },
          organizerId: new ObjectId(organizerId),
        },
      }
    );

    res.redirect(`/events/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    await db.collection('events').deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/events');
  } catch (err) {
    next(err);
  }
});

// REGISTER a user to an event
router.post('/:id/register', async (req, res, next) => {
  try {
    const db = getDB();
    const eventId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.body.userId);

    const event = await db.collection('events').findOne({ _id: eventId });
    if (!event) return res.status(404).render('error', { message: 'Event not found' });

    const duplicate = event.registrations.some((r) => r.userId.equals(userId));
    if (duplicate) {
      return res.redirect(`/events/${req.params.id}?error=` + encodeURIComponent('This user is already registered for this event.'));
    }

    const confirmedCount = event.registrations.filter((r) => r.status === 'confirmed').length;
    const status = confirmedCount >= event.capacity ? 'waiting' : 'confirmed';
    if (status === 'waiting') {
      // Explicitly refuse confirmed registration when full - still allow waiting list
    }

    await db.collection('events').updateOne(
      { _id: eventId },
      { $push: { registrations: { userId, registeredAt: new Date(), status } } }
    );

    const msg = status === 'waiting' ? 'Event is full: user added to the waiting list.' : null;
    res.redirect(`/events/${req.params.id}` + (msg ? '?error=' + encodeURIComponent(msg) : ''));
  } catch (err) {
    next(err);
  }
});

// UNREGISTER / cancel a registration
router.post('/:id/unregister', async (req, res, next) => {
  try {
    const db = getDB();
    const eventId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.body.userId);

    await db.collection('events').updateOne(
      { _id: eventId },
      { $pull: { registrations: { userId } } }
    );

    res.redirect(`/events/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
