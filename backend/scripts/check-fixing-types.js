require("dotenv").config();
const mongoose = require("mongoose");

async function checkVoucherFixingTypes() {
  try {
    if (!process.env.MONGO_URI_LOOPC) throw new Error('Missing MONGO_URI_LOOPC');
    await mongoose.connect(process.env.MONGO_URI_LOOPC);
    
    const Transaction = require("./models/Transaction");
    
    console.log("\n=== Voucher Fixing Types in Database ===\n");
    
    const sales = await Transaction.find({
      type: "sale",
      status: "posted",
      "voucherMeta.vocNo": { $exists: true }
    }).sort({ createdAt: 1 }).select("voucherMeta.vocNo voucherMeta.fixingType metalFixStatus amount").lean();
    
    sales.forEach(sale => {
      const vocNo = sale.voucherMeta?.vocNo;
      const fixingType = sale.voucherMeta?.fixingType;
      const metalFixStatus = sale.metalFixStatus;
      
      console.log(`Voucher ${vocNo}:`);
      console.log(`  voucherMeta.fixingType: ${fixingType || 'NOT SET'}`);
      console.log(`  metalFixStatus: ${metalFixStatus || 'NOT SET'}`);
      console.log(`  Amount: $${sale.amount}`);
      console.log('');
    });
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkVoucherFixingTypes();
