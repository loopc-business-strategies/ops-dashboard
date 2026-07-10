export function createOnlineLookup(onlineUserIds = [], participants = []) {
  const onlineIdSet = new Set((onlineUserIds || []).map((id) => String(id)))

  return (userId) => {
    const id = String(userId || '')
    if (!id) return false
    if (onlineIdSet.has(id)) return true
    const participant = (participants || []).find((p) => (
      String(p._id) === id || String(p.id) === id
    ))
    return Boolean(participant?.isOnline)
  }
}

export function countOnlineMembers(memberIds = [], isUserOnline) {
  return (memberIds || []).filter((memberId) => isUserOnline(memberId)).length
}
