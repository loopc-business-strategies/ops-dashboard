const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccount = require('./models/ChartOfAccount');
const Ledger = require('./models/Ledger');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const a1301 = await ChartOfAccount.findOne({ accountCode: '1301' });
        const a1100 = await ChartOfAccount.findOne({ accountCode: '1100' });

        console.log('1301 MongoID:', a1301 ? a1301._id : 'Not Found');
        console.log('1100 MongoID:', a1100 ? a1100._id : 'Not Found');

        if (a1301) {
            const debits1301 = await Ledger.find({ debitAccountId: a1301._id, isDeleted: { $ne: true } });
            const credits1301 = await Ledger.find({ creditAccountId: a1301._id, isDeleted: { $ne: true } });
            console.log(`1301 Debits count: ${debits1301.length}, Credits count: ${credits1301.length}`);
        }

        if (a1100) {
            const debits1100 = await Ledger.find({ debitAccountId: a1100._id, isDeleted: { $ne: true } });
            const credits1100 = await Ledger.find({ creditAccountId: a1100._id, isDeleted: { $ne: true } });
            console.log(`1100 Debits count: ${debits1100.length}, Credits count: ${credits1100.length}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
run();
