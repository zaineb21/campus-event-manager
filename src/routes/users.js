const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');

const router = express.Router();

// LIST + search + filter, using $lookup to compute registration counts
router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const { q, department, role } = req.query;
    const match = {};
    if (q) {
      match.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    if (department) match.department = department;
    if (role) match.role = role;

    const users = await db
      .collection('users')
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: 'registrations.userId',
            as: 'registeredEvents',
          },
        },
        { $addFields: { registrationsCount: { $size: '$registeredEvents' } } },
        { $project: { registeredEvents: 0 } },
        { $sort: { lastName: 1 } },
      ])
      .toArray();

    const departments = await db.collection('users').distinct('department');
    const roles = await db.collection('users').distinct('role');

    res.render('users/index', { users, departments, roles, query: req.query });
  } catch (err) {
    next(err);
  }
});

router.get('/new', (req, res) => {
  res.render('users/form', { user: null, error: null });
});

router.post('/', async (req, res, next) => {
  try {
    const db = getDB();
    const { firstName, lastName, email, department, role, interests } = req.body;

    if (!email || !/^.+@.+\..+$/.test(email)) {
      return res.status(400).render('users/form', { user: req.body, error: 'A valid email address is required.' });
    }

    await db.collection('users').insertOne({
      firstName,
      lastName,
      email,
      department,
      role,
      interests: interests ? interests.split(',').map((i) => i.trim()).filter(Boolean) : [],
      createdAt: new Date(),
    });

    res.redirect('/users');
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).render('users/form', { user: req.body, error: 'This email address is already used by another user.' });
    }
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).render('error', { message: 'User not found' });
    res.render('users/form', { user, error: null });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const { firstName, lastName, email, department, role, interests } = req.body;

    if (!email || !/^.+@.+\..+$/.test(email)) {
      return res.status(400).render('users/form', { user: { _id: req.params.id, ...req.body }, error: 'A valid email address is required.' });
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          firstName,
          lastName,
          email,
          department,
          role,
          interests: interests ? interests.split(',').map((i) => i.trim()).filter(Boolean) : [],
        },
      }
    );

    res.redirect('/users');
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).render('users/form', { user: { _id: req.params.id, ...req.body }, error: 'This email address is already used by another user.' });
    }
    next(err);
  }
});

// Delete only if the user is not referenced by any registration
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.params.id);

    const stillReferenced = await db.collection('events').countDocuments({ 'registrations.userId': userId });
    if (stillReferenced > 0) {
      return res.redirect('/users?error=' + encodeURIComponent('Cannot delete: this user still has event registrations. Remove them first.'));
    }

    await db.collection('users').deleteOne({ _id: userId });
    res.redirect('/users');
  } catch (err) {
    next(err);
  }
});

// DETAIL: user info + all their event registrations
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.params.id);
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).render('error', { message: 'User not found' });

    const now = new Date();
    const events = await db
      .collection('events')
      .aggregate([
        { $match: { 'registrations.userId': userId } },
        {
          $project: {
            title: 1,
            category: 1,
            startDate: 1,
            endDate: 1,
            registration: {
              $first: {
                $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.userId', userId] } },
              },
            },
          },
        },
        { $sort: { startDate: -1 } },
      ])
      .toArray();

    const upcomingCount = events.filter((e) => e.startDate >= now).length;
    const pastCount = events.filter((e) => e.startDate < now).length;

    res.render('users/detail', { user, events, upcomingCount, pastCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
