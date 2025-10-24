const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  name: { // The name of the group chat (e.g., "Project Team")
    type: String,
    trim: true,
  },
  isGroup: { // A flag to identify if it's a group chat or a one-on-one direct message
    type: Boolean,
    default: false,
  },
  members: [{ // An array of User IDs who are part of this conversation
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // This creates a link to the 'User' model
  }],
  lastMessage: { // A reference to the most recent message for preview purposes
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message', // This creates a link to the 'Message' model
  },
  groupAdmin: { // The user who created the group (only relevant if isGroup is true)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  // This option automatically adds `createdAt` and `updatedAt` fields to our documents
  timestamps: true,
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
