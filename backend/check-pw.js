const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}).select("+password");
  for (const user of users) {
    const isMatch = await bcrypt.compare("admin123", user.password);
    console.log(`User: ${user.name}, Match: ${isMatch}`);
  }
  process.exit(0);
}
check();
