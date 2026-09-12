require('dotenv').config();
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const { connectDB } = require('./db');

const dashboardRoutes = require('./routes/dashboard');
const eventsRoutes = require('./routes/events');
const usersRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', dashboardRoutes);
app.use('/events', eventsRoutes);
app.use('/users', usersRoutes);
app.use('/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message || 'Server error' });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Campus Event Manager running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
