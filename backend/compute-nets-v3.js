const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccount = require('./models/ChartOfAccount');
const Ledger = require('./models/Ledger');
const Customer = require('./models/Customer');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        async function getNetForAccountId(mongoId) {
            if (!mongoId) return 0;
            const debits = await Ledger.find({ debitAccountId: mongoId, isDeleted: { $ne: true } });
            const credits = await Ledger.find({ creditAccountId: mongoId, isDeleted: { $ne: true } });

            const dTotal = debits.reduce((sum, item) => sum + item.amount, 0);
            const cTotal = credits.reduce((sum, item) => sum + item.amount, 0);
            return dTotal - cTotal;
        }

        async function getNetForMultipleAccountIds(mongoIds) {
            const validIds = mongoIds.filter(id => id).map(id => id.toString());
            if (validIds.length === 0) return 0;
            
            const debits = await Ledger.find({ debitAccountId: { $in: validIds }, isDeleted: { $ne: true } });
            const credits = await Ledger.find({ creditAccountId: { $in: validIds }, isDeleted: { $ne: true } });

            const dTotal = debits.reduce((sum, item) => sum + item.amount, 0);
            const cTotal = credits.reduce((sum, item) => sum + item.amount, 0);
            return dTotal - cTotal;
        }

        const a1301 = await ChartOfAccount.findOne({ accountCode: '1301' });
        const net1301 = await getNetForAccountId(a1301 ? a1301._id : null);

        const a1100 = await ChartOfAccount.findOne({ accountCode: '1100' });
        const net1100Direct = await getNetForAccountId(a1100 ? a1100._id : null);

        const activeCustomers = await Customer.find({ isActive: true }).select('ledgerAccountId');
        const customerMongoIds = activeCustomers.map(c => c.ledgerAccountId).filter(id => id);
        const rollupIds = Array.from(new Set(a1100 ? [a1100._id, ...customerMongoIds] : customerMongoIds));
        const netRollup = await getNetForMultipleAccountIds(rollupIds);

        console.log(`1301: ${net1301}`);
        console.log(`1100 Direct: ${net1100Direct}`);
        console.log(`Rollup 1100: ${netRollup}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
run();
