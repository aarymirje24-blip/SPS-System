const express = require('express');
const path = require('path');
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');

const app = express();

// Middleware for serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set the view engine to render HTML files
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// Set up routes
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

module.exports = app;