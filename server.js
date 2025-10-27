const express = require('express');
const http = require('http' );
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors'); // <-- IMPORT THE NEW PACKAGE

const Message = require('./models/message');
const Conversation = require('./models/conversation');

dotenv.config();

const app = express();
app.use(express.json());

// --- CORS CONFIGURATION ---
// This is the VIP list. It tells the server who is allowed to talk to it.
const corsOptions = {
  origin: 'https://my-char-app-frontend.netlify.app/login', // <-- VERY IMPORTANT: REPLACE WITH YOUR NETLIFY URL
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions )); // <-- USE THE CORS MIDDLEWARE

const server = http.createServer(app );

const io = new Server(server, {
  cors: {
    origin: 'https://my-char-app-frontend.netlify.app/login', // <-- ALSO ADD IT HERE FOR SOCKET.IO
    methods: ["GET", "POST"]
  }
} );

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.get('/', (req, res) => res.send('Server is running.'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));

// Socket.IO Logic
let onlineUsers = {}; // Maps userId to socketId

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('setup', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('online users', Object.keys(onlineUsers));
    console.log('Online users:', onlineUsers);
  });

  socket.on('join room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('chat message', async (msg) => {
    try {
      const newMessage = new Message({
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        senderUsername: msg.senderUsername,
        content: msg.content,
        readBy: [msg.senderId]
      });
      const savedMessage = await newMessage.save();
      await Conversation.findByIdAndUpdate(msg.conversationId, { lastMessage: savedMessage._id });
      
      const populatedMessage = await Message.findById(savedMessage._id).populate('senderId', 'username');
      
      // Emit only to the room the message belongs to
      io.to(msg.conversationId).emit('chat message', populatedMessage);

    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('messages seen', async ({ conversationId, userId }) => {
    try {
      await Message.updateMany(
        { conversationId: conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      // Notify the room that messages have been seen
      io.to(conversationId).emit('messages updated seen', { conversationId, userId });
    } catch (error) {
      console.error('Error updating seen status:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('online users', Object.keys(onlineUsers));
    console.log('Online users:', onlineUsers);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
