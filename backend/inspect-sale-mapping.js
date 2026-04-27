require('dotenv').config();
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

const AccountMapping = mongoose.model('AccountMapping', AccountMappingSchema);
const ChartOfAccount = mongoose.model('ChartOfAccount', ChartOfAccountSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ops-dashboard');
    const mapping = await AccountMapping.findOne({ mappingType: 'sale', isActive: true })
      .populate('debitAccountId')
      .populate('creditAccountId');

    if (mapping) {
      console.log('Mapping Found:');
      console.log(`Debit: ${mapping.debitAccountId ? `${mapping.debitAccountId.accountCode} - ${mapping.debitAccountId.accountName}` : 'None'} (${mapping.debitAccountId?._id || 'N/A'})`);
      console.log(`Credit: ${mapping.creditAccountId ? `${mapping.creditAccountId.accountCode} - ${mapping.creditAccountId.accountName}` : 'None'} (${mapping.creditAccountId?._id || 'N/A'})`);
    } else {
      console.log('No active mapping found for "sale".');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
