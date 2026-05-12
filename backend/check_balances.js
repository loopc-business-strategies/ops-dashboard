const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(process.cwd(), ".env");
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function run() {
  try {
    const uri = (process.env.MONGO_URI_MG || "").replace("appName=", "appName=dashboard");
    await mongoose.connect(uri);
    
    const Ledger = mongoose.model("Ledger", new mongoose.Schema({}, { collection: "ledgers", strict: false }));
    const ChartOfAccount = mongoose.model("ChartOfAccount", new mongoose.Schema({}, { collection: "chartofaccounts", strict: false }));

    const ledgers = await Ledger.find({ isDeleted: { $ne: true } }).lean();
    const accountIds = new Set();
    ledgers.forEach(l => {
        if (l.debitAccountId) accountIds.add(l.debitAccountId.toString());
        if (l.creditAccountId) accountIds.add(l.creditAccountId.toString());
    });

    const accounts = await ChartOfAccount.find({ _id: { $in: Array.from(accountIds).map(id => new mongoose.Types.ObjectId(id)) } }).lean();
    
    const results = [];
    for (const acc of accounts) {
        let balance = 0;
        let count = 0;
        ledgers.forEach(l => {
            if (l.debitAccountId && l.debitAccountId.toString() === acc._id.toString()) {
                balance += (l.amount || 0);
                count++;
            }
            if (l.creditAccountId && l.creditAccountId.toString() === acc._id.toString()) {
                balance -= (l.amount || 0);
                count++;
            }
        });
        if (count > 0) {
            results.push({ 
                name: acc.name, 
                category: acc.category,
                balance 
            });
        }
    }

    console.log("ALL NON-ZERO ACCOUNTS:");
    console.table(results.filter(r => Math.abs(r.balance) > 0.01).sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance)));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
