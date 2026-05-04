const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccount = require('./models/ChartOfAccount');
const Ledger = require('./models/Ledger');
const Customer = require('./models/Customer');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        async function getNetForAccountIds(ids) {
            const results = await Ledger.aggregate([
                { $match: { accountId: { $in: ids }, isDeleted: { $ne: true } } },
                { $group: { _id: null, net: { $sum: { $subtract: [{ $ifNull: ["$debit", 0] }, { $ifNull: ["$credit", 0] }] } } } }
            ]);
            return results.length > 0 ? results[0].net : 0;
        }

        const net1301 = await getNetForAccountIds(['1301']);
        const net1100Direct = await getNetForAccountIds(['1100']);
        const activeCustomers = await Customer.find({ isActive: true }).select('ledgerAccountId');
        const customerIds = activeCustomers.map(c => c.ledgerAccountId).filter(id => id);
        const rollupIds = Array.from(new Set(['1100', ...customerIds]));
        const netRollup = await getNetForAccountIds(rollupIds);

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
