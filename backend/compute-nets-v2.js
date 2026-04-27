const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccount = require('./models/ChartOfAccount');
const Ledger = require('./models/Ledger');
const Customer = require('./models/Customer');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        async function getMongoIdForCode(code) {
            const acc = await ChartOfAccount.findOne({ accountCode: code });
            return acc ? acc._id : null;
        }

        async function getNetForAccountId(mongoId) {
            if (!mongoId) return 0;
            const debits = await Ledger.aggregate([
                { $match: { debitAccountId: mongoId, isDeleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const credits = await Ledger.aggregate([
                { $match: { creditAccountId: mongoId, isDeleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const dTotal = debits.length > 0 ? debits[0].total : 0;
            const cTotal = credits.length > 0 ? credits[0].total : 0;
            return dTotal - cTotal;
        }

        async function getNetForMultipleAccountIds(mongoIds) {
            const validIds = mongoIds.filter(id => id);
            if (validIds.length === 0) return 0;
            
            const debits = await Ledger.aggregate([
                { $match: { debitAccountId: { $in: validIds }, isDeleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const credits = await Ledger.aggregate([
                { $match: { creditAccountId: { $in: validIds }, isDeleted: { $ne: true } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const dTotal = debits.length > 0 ? debits[0].total : 0;
            const cTotal = credits.length > 0 ? credits[0].total : 0;
            return dTotal - cTotal;
        }

        const id1301 = await getMongoIdForCode('1301');
        const net1301 = await getNetForAccountId(id1301);

        const id1100 = await getMongoIdForCode('1100');
        const net1100Direct = await getNetForAccountId(id1100);

        const activeCustomers = await Customer.find({ isActive: true }).select('ledgerAccountId');
        const customerMongoIds = activeCustomers.map(c => c.ledgerAccountId).filter(id => id);
        const rollupIds = Array.from(new Set(id1100 ? [id1100, ...customerMongoIds] : customerMongoIds));
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
