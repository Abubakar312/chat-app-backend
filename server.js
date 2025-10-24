require('dotenv').config();
const express = require('express');
const http = require('http' );
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const cors = require('cors');

const Message = require('./models/message');
const Conversation = require('./models/conversation');

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');
const userRoutes = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app );
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "DELETE"] } });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/users', userRoutes);

let onlineUsers = {};

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on('setup', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('online users', Object.keys(onlineUsers));
  });

  socket.on('join room', (conversationId) => {
    socket.join(conversationId);
  });

  // --- NEW: Listen for when a user sees messages ---
  socket.on('messages seen', async ({ conversationId, userId }) => {
    try {
      // Find all messages in this conversation that are not yet read by this user
      const result = await Message.updateMany(
        { conversationId: conversationId, readBy: { $ne: userId } }, // Find messages where userId is NOT in readBy
        { $addToSet: { readBy: userId } } // Add the userId to the readBy array
      );

      // If any messages were updated, we need to inform the clients
      if (result.modifiedCount > 0) {
        // Fetch the updated messages to get the full readBy array
        const updatedMessages = await Message.find({ conversationId: conversationId });
        // Broadcast the update to the specific room
        io.to(conversationId).emit('messages updated', updatedMessages);
      }
    } catch (error) {
      console.error('Error marking messages as seen:', error);
    }
  });

  socket.on('chat message', async (data) => {
    const { conversationId, senderId, senderUsername, content } = data;
    // When a message is created, it's only read by the sender initially
    const newMessage = new Message({ conversationId, senderId, senderUsername, content, readBy: [senderId] });
    try {
      const savedMessage = await newMessage.save();
      await Conversation.findByIdAndUpdate(conversationId, { lastMessage: savedMessage._id });
      io.to(conversationId).emit('chat message', savedMessage);
    } catch (error) { console.error('Error saving message:', error); }
  });

  // ... (other socket listeners like delete, typing, etc. are the same)

  socket.on('disconnect', () => {
    let disconnectedUserId = null;
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        disconnectedUserId = userId;
        delete onlineUsers[userId];
        break;
      }
    }
    if (disconnectedUserId) {
      io.emit('online users', Object.keys(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
