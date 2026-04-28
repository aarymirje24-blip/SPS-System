const express = require('express');
const router = express.Router();
const PageController = require('../controllers/pageController');

const pageController = new PageController();

router.get('/home', pageController.renderHome);
router.get('/about', pageController.renderAbout);
router.get('*', pageController.render404);

module.exports = router;