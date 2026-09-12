const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const events = db.collection('events');
    const users = db.collection('users');

    // A - Registrations by category
    const byCategory = await events.aggregate([
      {
        $addFields: {
          confirmedCount: {
            $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } },
          },
        },
      },
      {
        $group: {
          _id: '$category',
          eventsCount: { $sum: 1 },
          totalConfirmed: { $sum: '$confirmedCount' },
        },
      },
      { $sort: { totalConfirmed: -1 } },
    ]).toArray();

    // B - Top 5 most popular events
    const topEvents = await events.aggregate([
      {
        $addFields: {
          confirmedCount: {
            $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } },
          },
        },
      },
      {
        $project: {
          title: 1,
          category: 1,
          capacity: 1,
          confirmedCount: 1,
          occupancy: { $round: [{ $multiply: [{ $divide: ['$confirmedCount', '$capacity'] }, 100] }, 1] },
        },
      },
      { $sort: { confirmedCount: -1 } },
      { $limit: 5 },
    ]).toArray();

    // C - Users with no registration (lookup + filter)
    const usersNoReg = await users.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: 'registrations.userId',
          as: 'registeredEvents',
        },
      },
      { $match: { registeredEvents: { $size: 0 } } },
      { $project: { firstName: 1, lastName: 1, email: 1, department: 1 } },
    ]).toArray();

    // D - Events above average occupancy (uses $facet, $avg)
    const occupancyFacet = await events.aggregate([
      {
        $addFields: {
          confirmedCount: {
            $size: { $filter: { input: '$registrations', as: 'r', cond: { $eq: ['$$r.status', 'confirmed'] } } },
          },
        },
      },
      {
        $project: {
          title: 1,
          category: 1,
          capacity: 1,
          confirmedCount: 1,
          occupancy: { $multiply: [{ $divide: ['$confirmedCount', '$capacity'] }, 100] },
        },
      },
      {
        $facet: {
          allEvents: [{ $sort: { occupancy: -1 } }],
          avgCalc: [{ $group: { _id: null, avgOccupancy: { $avg: '$occupancy' } } }],
        },
      },
    ]).toArray();

    const avgOccupancy = occupancyFacet[0]?.avgCalc[0]?.avgOccupancy || 0;
    const aboveAverage = (occupancyFacet[0]?.allEvents || [])
      .filter((e) => e.occupancy > avgOccupancy)
      .map((e) => ({ ...e, occupancy: Math.round(e.occupancy * 10) / 10 }));

    // E - Most used tags
    const topTags = await events.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    // F - Events by month
    const byMonth = await events.aggregate([
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$startDate' } },
          registrationsCount: { $size: '$registrations' },
        },
      },
      {
        $group: {
          _id: '$month',
          totalEvents: { $sum: 1 },
          totalRegistrations: { $sum: '$registrationsCount' },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    res.render('analytics', {
      byCategory,
      topEvents,
      usersNoReg,
      aboveAverage,
      avgOccupancy: Math.round(avgOccupancy * 10) / 10,
      topTags,
      byMonth,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
