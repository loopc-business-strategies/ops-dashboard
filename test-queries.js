require('dotenv').config({path: './backend/.env'});
const mongoose = require('mongoose');

const AccountMappingSchema = new mongoose.Schema({
  mappingType: String,
  isActive: Boolean
});

const AccountMapping = (mongoose.models && mongoose.models.AccountMapping) || mongoose.model('AccountMapping', AccountMappingSchema);

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);
    
    const count = await AccountMapping.countDocuments();
    console.log(`Total Mappings: ${count}`);
    
    const mappings = await AccountMapping.find().limit(5);
    console.log('Sample Mappings:', JSON.stringify(mappings, null, 2));

  } catch (err) {
    console.error(err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
