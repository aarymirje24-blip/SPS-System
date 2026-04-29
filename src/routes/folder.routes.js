const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folder.controller');

router.get('/', folderController.listRoot);
router.post('/', folderController.create);
router.get('/:id', folderController.getContents);
router.get('/:id/breadcrumb', folderController.getBreadcrumb);
router.patch('/:id', folderController.rename);
router.delete('/:id', folderController.remove);

module.exports = router;
