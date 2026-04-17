const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = 'mongodb://loopC:mindgameLC@ac-pamwq8e-shard-00-00.termn9x.mongodb.net:27017,ac-pamwq8e-shard-00-01.termn9x.mongodb.net:27017,ac-pamwq8e-shard-00-02.termn9x.mongodb.net:27017/ops-dashboard?ssl=true&replicaSet=atlas-ecp4bu-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function listUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    const users = await User.find({}, 'name email role');
    console.log('Users:');
    console.log(JSON.stringify(users, null, 2));
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listUsers();
