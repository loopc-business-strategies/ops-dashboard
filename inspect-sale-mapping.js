require('dotenv').config({path: './backend/.env'});
const mongoose = require('mongoose');

const AccountMappingSchema = new mongoose.Schema({
  mappingType: String,
  isActive: Boolean,
  debitAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' },
  creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount' }
});

const ChartOfAccountSchema = new mongoose.Schema({
  accountCode: String,
  accountName: String
});

const AccountMapping = (mongoose.models && mongoose.models.AccountMapping) || mongoose.model('AccountMapping', AccountMappingSchema);
const ChartOfAccount = (mongoose.models && mongoose.models.ChartOfAccount) || mongoose.model('ChartOfAccount', ChartOfAccountSchema);

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
    
    // Look for partial 'sale' match
    const mappings = await AccountMapping.find({ 
      mappingType: /sale/i, 
      isActive: true 
    }).populate('debitAccountId').populate('creditAccountId');

    if (mappings.length > 0) {
      console.log(`Found ${mappings.length} mapping(s) containing "sale":\n`);
      mappings.forEach(m => {
        console.log(`Type: ${m.mappingType}`);
        console.log(`Debit: ${m.debitAccountId ? `${m.debitAccountId.accountCode} - ${m.debitAccountId.accountName}` : 'None'} (${m.debitAccountId?._id || 'N/A'})`);
        console.log(`Credit: ${m.creditAccountId ? `${m.creditAccountId.accountCode} - ${m.creditAccountId.accountName}` : 'None'} (${m.creditAccountId?._id || 'N/A'})`);
        console.log('---');
      });
    } else {
      console.log('No active mappings containing "sale" were found.');
    }
  } catch (err) {
    console.error(err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
