const mongoose = require("mongoose");
require("dotenv").config();
const Transaction = require("./models/Transaction");

async function run() {
  try {
    if (!process.env.MONGO_URI_CG) throw new Error('Missing MONGO_URI_CG');
    await mongoose.connect(process.env.MONGO_URI_CG);
    const tx = await Transaction.findOne({
      type: "sale",
      "voucherMeta.vocNo": "6",
      isDeleted: { $ne: true }
    });

    if (!tx) {
      console.log("Transaction vocNo=6 (sale) not found.");
      return;
    }

    console.log("Transaction Found:", tx._id);
    let totalSignedPureWeight = 0;

    tx.voucherMeta.lineItems.forEach((line, index) => {
      let pureWeight = line.pureWeight || 0;
      if (!pureWeight && line.grossWeight && line.purity) {
         pureWeight = line.grossWeight * line.purity;
      }

      const identifier = (line.stockCode || "" ) + (line.productType || "");
      const signedPureWeight = -pureWeight;
      totalSignedPureWeight += signedPureWeight;

      console.log("Line " + index + ": grossWeight=" + line.grossWeight + ", purity=" + line.purity + ", pureWeight=" + line.pureWeight + ", identifier=" + identifier + ", computedPureWeight=" + pureWeight + ", signedPureWeight=" + signedPureWeight);
    });

    console.log("Computed Total Signed Pure Weight:", totalSignedPureWeight);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
run();
