require('dotenv').config();
const mongoose = require('mongoose');

async function copyCollection(sourceDb, targetDb, name) {
  const sourceCollection = sourceDb.collection(name);
  const targetCollection = targetDb.collection(name);

  const docs = await sourceCollection.find({}).toArray();

  const targetExists = (await targetDb.listCollections({ name }).toArray()).length > 0;
  if (targetExists) {
    await targetCollection.drop();
  }

  if (docs.length > 0) {
    await targetDb.collection(name).insertMany(docs, { ordered: false });
  } else {
    await targetDb.createCollection(name);
  }

  const indexes = await sourceCollection.indexes();
  for (const index of indexes) {
    if (index.name === '_id_') continue;
    const { key, name: indexName, ...options } = index;
    await targetDb.collection(name).createIndex(key, { name: indexName, ...options });
  }

  return docs.length;
}

async function main() {
  if (!process.env.MONGO_URI || !process.env.MONGO_URI_MG) {
    throw new Error('MONGO_URI and MONGO_URI_MG are required in backend/.env');
  }

  const sourceConn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  const targetConn = await mongoose.createConnection(process.env.MONGO_URI_MG).asPromise();

  const sourceDb = sourceConn.db;
  const targetDb = targetConn.db;

  const sourceCollections = await sourceDb.listCollections().toArray();
  const names = sourceCollections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'));

  const summary = {};
  for (const name of names) {
    const count = await copyCollection(sourceDb, targetDb, name);
    summary[name] = count;
    console.log(`copied ${name}: ${count}`);
  }

  const targetCollections = await targetDb.listCollections().toArray();
  for (const col of targetCollections) {
    if (names.includes(col.name) || col.name.startsWith('system.')) continue;
    await targetDb.collection(col.name).drop();
    console.log(`removed extra target collection: ${col.name}`);
  }

  console.log('done', JSON.stringify({ sourceDb: sourceConn.name, targetDb: targetConn.name, copiedCollections: names.length }));

  await sourceConn.close();
  await targetConn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
