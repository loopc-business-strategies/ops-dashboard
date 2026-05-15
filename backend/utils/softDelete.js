function getSoftDeleteFields(req, reason = '') {
  return {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: req.user?._id || null,
    deletedByName: req.user?.name || '',
    deletionReason: String(reason || req.body?.reason || req.body?.comment || '').trim(),
  }
}

async function softDeleteById(Model, id, req, reason = '') {
  const doc = await Model.findById(id)
  if (!doc || doc.isDeleted === true) return null

  await Model.updateOne(
    { _id: id },
    { $set: getSoftDeleteFields(req, reason) },
    { strict: false }
  )

  return doc
}

module.exports = {
  getSoftDeleteFields,
  softDeleteById,
}
