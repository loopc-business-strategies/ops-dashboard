const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccount = require('./models/ChartOfAccount');
const Ledger = require('./models/Ledger');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const a1301 = await ChartOfAccount.findOne({ accountCode: '1301' });
        console.log('1301 ID:', a1301._id);

        const allLedger = await Ledger.find({ isDeleted: { $ne: true } });
        console.log('Total ledger entries:', allLedger.length);

        allLedger.forEach((entry, i) => {
            console.log(`Entry ${i}: debitAccountId=${entry.debitAccountId}, creditAccountId=${entry.creditAccountId}, amount=${entry.amount}`);
            console.log(`Type debit: ${typeof entry.debitAccountId}, Type credit: ${typeof entry.creditAccountId}`);
            console.log(`Match debit 1301: ${entry.debitAccountId.toString() === a1301._id.toString()}`);
            console.log(`Match credit 1301: ${entry.creditAccountId.toString() === a1301._id.toString()}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
run();
