const mongoose = require('mongoose');
require('dotenv').config();

const ChartOfAccount = require('./models/ChartOfAccount');
const Ledger = require('./models/Ledger');
const Customer = require('./models/Customer');

async function run() {
    try {
        if (!process.env.MONGO_URI_CG) throw new Error('Missing MONGO_URI_CG');
        await mongoose.connect(process.env.MONGO_URI_CG);

        async function getNetForAccountId(mongoId) {
            if (!mongoId) return 0;
            const entries = await Ledger.find({ isDeleted: { $ne: true } });
            let net = 0;
            entries.forEach(e => {
                if (e.debitAccountId.toString() === mongoId.toString()) net += e.amount;
                if (e.creditAccountId.toString() === mongoId.toString()) net -= e.amount;
            });
            return net;
        }

        async function getNetForMultipleAccountIds(mongoIds) {
            const validIds = mongoIds.filter(id => id).map(id => id.toString());
            if (validIds.length === 0) return 0;
            
            const entries = await Ledger.find({ isDeleted: { $ne: true } });
            let net = 0;
            entries.forEach(e => {
                if (validIds.includes(e.debitAccountId.toString())) net += e.amount;
                if (validIds.includes(e.creditAccountId.toString())) net -= e.amount;
            });
            return net;
        }

        const a1301 = await ChartOfAccount.findOne({ accountCode: '1301' });
        const net1301 = await getNetForAccountId(a1301 ? a1301._id : null);

        const a1100 = await ChartOfAccount.findOne({ accountCode: '1100' });
        const net1100Direct = await getNetForAccountId(a1100 ? a1100._id : null);

        const activeCustomers = await Customer.find({ isActive: true }).select('ledgerAccountId');
        const customerMongoIds = activeCustomers.map(c => c.ledgerAccountId).filter(id => id);
        const rollupIds = Array.from(new Set(a1100 ? [a1100._id.toString(), ...customerMongoIds.map(id => id.toString())] : customerMongoIds.map(id => id.toString())));
        const netRollup = await getNetForMultipleAccountIds(rollupIds);

        console.log(`1301: ${net1301.toFixed(2)}`);
        console.log(`1100 Direct: ${net1100Direct.toFixed(2)}`);
        console.log(`Rollup 1100: ${netRollup.toFixed(2)}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
run();
