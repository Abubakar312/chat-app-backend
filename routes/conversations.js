const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const authMiddleware = require('../middleware/auth');

// @route   POST /api/conversations
// @desc    Create a new group conversation
router.post('/', authMiddleware, async (req, res) => {
  const { name, members } = req.body;

  if (!name || !members || members.length === 0) {
    return res.status(400).json({ msg: 'Please provide a group name and members' });
  }

  const allMembers = [...members, req.user.id];

  try {
    const newConversation = new Conversation({
      name,
      isGroup: true,
      members: allMembers,
      groupAdmin: req.user.id,
    });

    const savedConversation = await newConversation.save();
    const populatedConversation = await Conversation.findById(savedConversation._id)
        .populate('members', 'username')
        .populate('groupAdmin', 'username');

    res.status(201).json(populatedConversation);

  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/conversations
// @desc    Get all conversations for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({ members: { $in: [req.user.id] } })
      .populate('members', 'username')
      .populate('groupAdmin', 'username')
      .populate({
          path: 'lastMessage',
          select: 'content senderUsername'
      })
      .sort({ updatedAt: -1 });

    res.json(conversations);

  } catch (error) {
    console.error("Error in GET /api/conversations:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/conversations/dm/:recipientId
// @desc    Find or create a direct message conversation
router.post('/dm/:recipientId', authMiddleware, async (req, res) => {
  const { recipientId } = req.params;
  const currentUserId = req.user.id;

  try {
    let conversation = await Conversation.findOne({
      isGroup: false,
      members: { $all: [currentUserId, recipientId], $size: 2 }
    })
    .populate('members', 'username')
    .populate('lastMessage');

    if (conversation) {
      return res.json(conversation);
    }

    const newConversation = new Conversation({
      isGroup: false,
      members: [currentUserId, recipientId],
    });

    const savedConversation = await newConversation.save();
    const populatedConversation = await Conversation.findById(savedConversation._id)
      .populate('members', 'username');

    res.status(201).json(populatedConversation);

  } catch (error) {
    console.error('Error finding/creating DM:', error.message);
    res.status(500).send('Server Error');
  }
});

// --- NEW ROUTE ---
// @route   PUT /api/conversations/:id/members
// @desc    Add a member to a group
// @access  Private (only for group admin)
router.put('/:id/members', authMiddleware, async (req, res) => {
  const { userIdToAdd } = req.body;

  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ msg: 'Conversation not found' });
    }

    if (conversation.groupAdmin.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized: Only the group admin can add members' });
    }

    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { members: userIdToAdd } },
      { new: true }
    ).populate('members', 'username').populate('groupAdmin', 'username');

    res.json(updatedConversation);

  } catch (error) {
    console.error('Error adding member:', error.message);
    res.status(500).send('Server Error');
  }
});


module.exports = router;
