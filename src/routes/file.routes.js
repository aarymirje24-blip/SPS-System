const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const uploadMiddleware = require('../middleware/upload.middleware');
const shareController = require('../controllers/share.controller');

router.post('/upload', ...uploadMiddleware.single, fileController.upload);
router.get('/', fileController.list);
router.get('/shared-with-me', (req, res, next) => {
    req.query.shared = 'true';
    next();
}, fileController.list);
router.get('/:id/shares', shareController.listShares);
router.post('/:id/share', shareController.createShare);
router.delete('/:id/share/:shareId', shareController.revokeShare);
router.get('/:id', fileController.getOne);
router.get('/:id/download', fileController.download);
router.patch('/:id', fileController.update);
router.delete('/:id', fileController.remove);

module.exports = router;
