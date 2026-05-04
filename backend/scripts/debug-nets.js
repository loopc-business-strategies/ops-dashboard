const mongoose = require('mongoose');
require('dotenv').config();
const Ledger = require('./models/Ledger');
const Customer = require('./models/Customer');

async function debug() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const count = await Ledger.countDocuments({ isDeleted: { $ne: true } });
        console.log(`Total non-deleted ledger entries: ${count}`);

        const distinctAccounts = await Ledger.distinct('accountId', { isDeleted: { $ne: true } });
        console.log(`Distinct accountIds in ledger: ${distinctAccounts.slice(0, 5).join(', ')}... (Total: ${distinctAccounts.length})`);

        const ledgerSample = await Ledger.findOne({ isDeleted: { $ne: true } });
        console.log('Ledger sample:', JSON.stringify(ledgerSample, null, 2));

        const custCount = await Customer.countDocuments({ isActive: true });
        console.log(`Active customers: ${custCount}`);
        
        const activeCustomers = await Customer.find({ isActive: true }).limit(5);
        console.log('Customer ledgerAccountIds sample:', activeCustomers.map(c => c.ledgerAccountId));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
debug();
