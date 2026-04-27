require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");

async function testFixedUnfixedWithAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    
    const User = require("./models/User");
    const Transaction = require("./models/Transaction");
    const Customer = require("./models/Customer");
    const InventoryItem = require("./models/InventoryItem");
    const Ledger = require("./models/Ledger");
    const StockMovement = require("./models/StockMovement");
    
    const adminUser = await User.findOne({ role: "super_admin" });
    if (!adminUser) throw new Error("No admin user found");
    
    const customer = await Customer.findOne({ isActive: true }).lean();
    if (!customer) throw new Error("No customer found");
    
    const item = await InventoryItem.findOne({ isDeleted: { $ne: true } }).lean();
    if (!item) throw new Error("No inventory item found");
    
    console.log("\n=== Test Plan ===");
    console.log("1. Create UNFIXED sale - should post stock only, NO ledger entry");
    console.log("2. Create FIXED sale - should post ledger entry only, NO stock change");
    console.log("\n");
    
    // Test 1: UNFIXED Sale
    console.log("--- Creating UNFIXED Sale ---");
    const unfixedSale = {
      type: "sale",
      customerId: customer._id,
      amount: 1000,
      currency: "USD",
      exchangeRate: 1,
      description: "Test UNFIXED sale",
      date: new Date(),
      voucherMeta: {
        vocNo: `TEST-UNFIXED-${Date.now()}`,
        lineItems: [
          {
            stockCode: item.sku,
            quantity: 10,
            rateType: "OZ",
            rate: 100,
            amountFC: 1000,
            amountLC: 1000,
            amountWithVAT: 1000
          }
        ],
        fixingType: "non-fixing", // UNFIXED
        partyCode: customer.code,
        partyName: customer.name
      },
      metalFixStatus: "unfixed"
    };
    
    const unfixedResp = await axios.post("http://localhost:5001/api/transactions", unfixedSale, {
      headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
    }).catch(e => ({ error: e.response?.data?.message || e.message }));
    
    if (unfixedResp.error) {
      console.log(`ERROR: ${unfixedResp.error}`);
    } else {
      const txId = unfixedResp.data.transaction._id;
      console.log(`Created: ${txId}`);
      
      // Submit
      await axios.post(`http://localhost:5001/api/transactions/${txId}/submit`, { comment: "Test submit" }, {
        headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
      }).catch(e => console.log(`Submit error: ${e.response?.data?.message}`));
      
      // Approve  
      await axios.post(`http://localhost:5001/api/transactions/${txId}/approve`, { comment: "Test approve" }, {
        headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
      }).catch(e => console.log(`Approve error: ${e.response?.data?.message}`));
      
      // Post
      await axios.post(`http://localhost:5001/api/transactions/${txId}/post`, { comment: "Test post" }, {
        headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
      }).catch(e => console.log(`Post error: ${e.response?.data?.message}`));
      
      const ledgerCount = await Ledger.countDocuments({ referenceId: txId, referenceType: "sale", isDeleted: { $ne: true } });
      const stockCount = await StockMovement.countDocuments({ reason: { $regex: `UNFIXED.*${unfixedSale.voucherMeta.vocNo}` } });
      console.log(`Result: Ledger=${ledgerCount} (should be 0), Stock=${stockCount} (should be 1+)`);
    }
    
    // Test 2: FIXED Sale
    console.log("\n--- Creating FIXED Sale ---");
    const fixedSale = {
      type: "sale",
      customerId: customer._id,
      amount: 2000,
      currency: "USD",
      exchangeRate: 1,
      description: "Test FIXED sale",
      date: new Date(),
      voucherMeta: {
        vocNo: `TEST-FIXED-${Date.now()}`,
        lineItems: [
          {
            stockCode: item.sku,
            quantity: 20,
            rateType: "OZ",
            rate: 100,
            amountFC: 2000,
            amountLC: 2000,
            amountWithVAT: 2000
          }
        ],
        fixingType: "fixing", // FIXED
        partyCode: customer.code,
        partyName: customer.name
      },
      metalFixStatus: "fixed"
    };
    
    const fixedResp = await axios.post("http://localhost:5001/api/transactions", fixedSale, {
      headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
    }).catch(e => ({ error: e.response?.data?.message || e.message }));
    
    if (fixedResp.error) {
      console.log(`ERROR: ${fixedResp.error}`);
    } else {
      const txId = fixedResp.data.transaction._id;
      console.log(`Created: ${txId}`);
      
      // Submit
      await axios.post(`http://localhost:5001/api/transactions/${txId}/submit`, { comment: "Test submit" }, {
        headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
      }).catch(e => console.log(`Submit error: ${e.response?.data?.message}`));
      
      // Approve
      await axios.post(`http://localhost:5001/api/transactions/${txId}/approve`, { comment: "Test approve" }, {
        headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
      }).catch(e => console.log(`Approve error: ${e.response?.data?.message}`));
      
      // Post
      await axios.post(`http://localhost:5001/api/transactions/${txId}/post`, { comment: "Test post" }, {
        headers: { Authorization: `Bearer ${await getToken(adminUser._id)}` }
      }).catch(e => console.log(`Post error: ${e.response?.data?.message}`));
      
      const ledgerCount = await Ledger.countDocuments({ referenceId: txId, referenceType: "sale", isDeleted: { $ne: true } });
      const stockCount = await StockMovement.countDocuments({ reason: { $regex: `FIXED.*${fixedSale.voucherMeta.vocNo}` } });
      console.log(`Result: Ledger=${ledgerCount} (should be 1+), Stock=${stockCount} (should be 0)`);
    }
    
    console.log("\n=== Test Complete ===\n");
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

async function getToken(userId) {
  // For testing, we'd use a simple JWT or the API's auth mechanism
  // This is simplified for the test
  return "test-token";
}

testFixedUnfixedWithAPI();
