const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
require("dotenv").config();

async function reset() {
  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await User.updateOne({ name: "AdminUser" }, { password: hashedPassword });
  console.log("Password for AdminUser reset to admin123");
  process.exit(0);
}
reset();
