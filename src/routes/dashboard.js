const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const users = db.collection('users');
    const events = db.collection('events');
    const now = new Date();

    const usersCount = await users.countDocuments();
    const eventsCount = await events.countDocuments();
    const upcomingCount = await events.countDocuments({ startDate: { $gte: now } });

    // total registrations across all events using $unwind + $group
    const totalRegAgg = await events.aggregate([
      { $unwind: { path: '$registrations', preserveNullAndEmptyArrays: false } },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]).toArray();
    const totalRegistrations = totalRegAgg.length ? totalRegAgg[0].total : 0;

    const nextEvents = await events
      .find({ startDate: { $gte: now } })
      .sort({ startDate: 1 })
      .limit(5)
      .toArray();

    // most popular event based on confirmed registrations
    const popularAgg = await events.aggregate([
      {
        $addFields: {
          confirmedCount: {
            $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } },
          },
        },
      },
      { $sort: { confirmedCount: -1 } },
      { $limit: 1 },
    ]).toArray();
    const mostPopular = popularAgg[0] || null;

    res.render('dashboard', {
      usersCount,
      eventsCount,
      upcomingCount,
      totalRegistrations,
      nextEvents,
      mostPopular,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
