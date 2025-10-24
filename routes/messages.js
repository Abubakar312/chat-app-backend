const express = require('express');
const router = express.Router();
const Message = require('../models/message');
const authMiddleware = require('../middleware/auth'); // We will create this middleware next

// =================================================================
// @route   GET /api/messages
// @desc    Get all messages
// @access  Private (must be logged in)
// =================================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 'asc' });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Failed to fetch messages');
  }
});

// =================================================================
// @route   DELETE /api/messages/:id
// @desc    Delete a message
// @access  Private
// =================================================================
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    // Check if message exists
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

// ... after the other routes ...

// @route   GET /api/messages/:conversationId
// @desc    Get all messages for a specific conversation
router.get('/:conversationId', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 'asc' });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages for conversation:', error);
        res.status(500).send('Failed to fetch messages');
    }
});




    // IMPORTANT: Check if the user trying to delete the message is the original sender.
    // We get req.user from our authMiddleware.
    // We must compare the user's ID to the sender's ID stored on the message.
    // Note: The sender field on the message schema needs to be updated to store the user's ID.
    if (message.senderId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    await message.deleteOne(); // Mongoose v6+ uses deleteOne()

    // We will let socket.io handle the real-time update on the frontend
    res.json({ msg: 'Message removed' });

  } catch (error) {
    console.error('Error deleting message:', error.message);
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ msg: 'Message not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
