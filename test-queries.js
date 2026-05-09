require('dotenv').config({path: './backend/.env'});
const mongoose = require('mongoose');

const AccountMappingSchema = new mongoose.Schema({
  mappingType: String,
  isActive: Boolean
});

const AccountMapping = (mongoose.models && mongoose.models.AccountMapping) || mongoose.model('AccountMapping', AccountMappingSchema);

async function run() {
  try {
    const tenant = String(process.env.DEFAULT_TENANT || 'loopc').trim().toLowerCase();
    const uriByTenant = {
      mg: process.env.MONGO_URI_MG,
      cg: process.env.MONGO_URI_CG,
      loopc: process.env.MONGO_URI_LOOPC,
    };
    const uri = uriByTenant[tenant] || process.env.MONGO_URI_LOOPC;
    if (!uri) throw new Error('Missing tenant Mongo URI (MONGO_URI_MG/MONGO_URI_CG/MONGO_URI_LOOPC).');
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
