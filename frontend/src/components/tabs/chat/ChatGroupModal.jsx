import { C } from './chatUi'
import {
  GROUP_MODULES,
  GROUP_TEMPLATES,
  DEFAULT_GROUP_PERMISSIONS,
  defaultGroupForm,
} from './chatGroupConstants'

export default function ChatGroupModal({
  t,
  groupForm,
  setGroupForm,
  groupMemberSearch,
  setGroupMemberSearch,
  filteredGroupPeople,
  enabledPermissionCount,
  groupModalInputStyle,
  setShowGroupModal,
  createGroup,
}) {
  return (
            <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.72)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, backdropFilter:'blur(7px)', padding:24 }}>
              <div style={{ background:'#ffffff', border:'1px solid #E5E7EB', borderRadius:16, width:'min(1180px, 96vw)', maxHeight:'92vh', overflow:'hidden', boxShadow:'0 28px 70px rgba(15,23,42,0.28)', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'28px 30px 20px', borderBottom:'1px solid #EEF2F7' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:'#0F172A', letterSpacing:'-0.02em' }}>Create New Group</div>
                  <button onClick={() => setShowGroupModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', fontSize:18 }}>✕</button>
                </div>
                <div style={{ fontSize:14, color:'#64748B', margin:'-14px 30px 18px' }}>Create a new group and manage access permissions</div>
                <div style={{ padding:'0 30px 22px', overflowY:'auto' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) 330px', gap:22 }}>
                    <div style={{ display:'grid', gap:10 }}>
                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:18, background:'#FFFFFF' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                          <span style={{ width:22, height:22, borderRadius:'50%', background:'#18966F', color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:800 }}>1</span>
                          <h3 style={{ margin:0, fontSize:14, color:'#0F172A', fontWeight:800 }}>Group Information</h3>
                        </div>

                        <label style={{ display:'block', color:'#334155', fontSize:12, fontWeight:700, marginBottom:7 }}>Group name <span style={{ color:'#EF4444' }}>*</span></label>
                <div style={{ marginBottom:12 }}>
                  <input
                    value={groupForm.name}
                    onChange={e => setGroupForm(p => ({ ...p, name:e.target.value }))}
                    placeholder="Group name e.g. Production Team"
                    autoFocus
                    style={groupModalInputStyle}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e  => e.target.style.borderColor = 'rgba(var(--brand-rgb),0.2)'}
                  />
                </div>
                        <label style={{ display:'block', color:'#334155', fontSize:12, fontWeight:700, margin:'16px 0 7px' }}>Department / Scope <span style={{ color:'#EF4444' }}>*</span></label>
                <div style={{ marginBottom:16 }}>
                  <select
                    value={groupForm.dept}
                    onChange={e => setGroupForm(p => ({ ...p, dept:e.target.value }))}
                    style={groupModalInputStyle}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e  => e.target.style.borderColor = 'rgba(var(--brand-rgb),0.2)'}
                  >
                    <option value="" style={{ background:'#ffffff' }}>{t('selectDepartmentScope')}</option>
                    {['All Departments','Production & Factory','HR & Hiring','Finance & Accounts','Govt. & Compliance','Sales & Marketing','Operations & Logistics','Training & Dev.'].map(d => (
                      <option key={d} value={d} style={{ background:'#ffffff' }}>{d}</option>
                    ))}
                  </select>
                </div>

                        <label style={{ display:'block', color:'#334155', fontSize:12, fontWeight:700, margin:'16px 0 7px' }}>Description</label>
                        <div style={{ position:'relative' }}>
                          <textarea value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description:e.target.value.slice(0, 250) }))} placeholder="Enter group description (optional)" rows={3} style={{ ...groupModalInputStyle, resize:'none', minHeight:70, paddingBottom:24 }} />
                          <span style={{ position:'absolute', right:12, bottom:10, color:'#94A3B8', fontSize:11 }}>{groupForm.description.length}/250</span>
                        </div>
                      </section>

                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:18, background:'#FFFFFF' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                          <span style={{ width:22, height:22, borderRadius:'50%', background:'#18966F', color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:800 }}>2</span>
                          <h3 style={{ margin:0, fontSize:14, color:'#0F172A', fontWeight:800 }}>Add Members</h3>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) 100px', gap:8, marginBottom:10 }}>
                          <input value={groupMemberSearch} onChange={e => setGroupMemberSearch(e.target.value)} placeholder="Search users by name, email or role..." style={groupModalInputStyle} />
                          <select style={groupModalInputStyle} defaultValue="users"><option value="users">Users</option><option value="heads">Dept Heads</option></select>
                        </div>
                <div style={{ fontSize:11, color:'#334155', fontWeight:600, marginBottom:8, letterSpacing:'0.05em', textTransform:'uppercase' }}>{t('addMembers')}</div>
                <div style={{ maxHeight:160, overflowY:'auto', marginBottom:18, scrollbarWidth:'thin', scrollbarColor:'rgba(var(--brand-rgb),0.3) transparent' }}>
                  {filteredGroupPeople.map(u => (
                    <label key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, cursor:'pointer', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(var(--brand-rgb),0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={groupForm.members.includes(u.id)}
                        onChange={() => setGroupForm(p => ({ ...p, members: p.members.includes(u.id) ? p.members.filter(m => m !== u.id) : [...p.members, u.id] }))}
                        style={{ accentColor:C.accent, width:15, height:15, flexShrink:0 }}
                      />
                      <div style={{ width:30, height:30, borderRadius:'50%', background:u.color + '20', color:u.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{u.initials}</div>
                      <span style={{ flex:1, fontSize:13, color:'#1c2a33' }}>{u.name}</span>
                      <span style={{ fontSize:10, color:'#334155' }}>{u.dept}</span>
                    </label>
                  ))}
                </div>

                      </section>

                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:18, background:'#FFFFFF' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ width:22, height:22, borderRadius:'50%', background:'#18966F', color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:800 }}>3</span>
                          <div style={{ flex:1 }}><h3 style={{ margin:0, fontSize:14, color:'#0F172A', fontWeight:800 }}>Set Permissions</h3><p style={{ margin:'4px 0 0', color:'#64748B', fontSize:12 }}>Choose what this group can access and manage</p></div>
                          <button type="button" onClick={() => setGroupForm(p => ({ ...p, permissions: GROUP_MODULES.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}) }))} style={{ border:'none', background:'transparent', color:'#2563EB', fontSize:12, fontWeight:800, cursor:'pointer' }}>Select All</button>
                        </div>
                        <div style={{ marginTop:14, border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden', display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                          {GROUP_MODULES.map(module => {
                            const checked = Boolean(groupForm.permissions?.[module.key])
                            return (
                              <label key={module.key} style={{ display:'grid', gridTemplateColumns:'34px minmax(0, 1fr) 20px', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid #F1F5F9', cursor:'pointer' }}>
                                <span style={{ width:28, height:28, borderRadius:8, background:module.tone, color:'#4F46E5', display:'grid', placeItems:'center', fontSize:14, fontWeight:800 }}>{module.icon}</span>
                                <span style={{ minWidth:0 }}><span style={{ display:'block', color:'#0F172A', fontSize:12, fontWeight:800 }}>{module.label}</span><span style={{ display:'block', color:'#64748B', fontSize:11 }}>{module.desc}</span></span>
                                <input type="checkbox" checked={checked} onChange={() => setGroupForm(p => ({ ...p, permissions:{ ...p.permissions, [module.key]: !checked } }))} style={{ accentColor:'#18966F' }} />
                              </label>
                            )
                          })}
                        </div>
                      </section>

                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:18, background:'#FFFFFF' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}><span style={{ width:22, height:22, borderRadius:'50%', background:'#18966F', color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:800 }}>4</span><h3 style={{ margin:0, fontSize:14, color:'#0F172A', fontWeight:800 }}>Additional Settings</h3></div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(130px, 1fr))', gap:12 }}>
                          {[
                            ['allowCreate', 'Allow group create', 'Allow members to create sub-groups'],
                            ['allowEdit', 'Allow edit', 'Allow members to edit data'],
                            ['allowDelete', 'Allow delete', 'Allow members to delete data'],
                            ['exportData', 'Export data', 'Allow members to export data'],
                          ].map(([key, label, desc]) => {
                            const checked = Boolean(groupForm.settings?.[key])
                            return (
                              <label key={key} style={{ border:'1px solid #E5E7EB', borderRadius:10, padding:12, display:'grid', gap:7, cursor:'pointer' }}>
                                <span style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}><span style={{ color:'#0F172A', fontSize:12, fontWeight:800 }}>{label}</span><span style={{ width:30, height:16, borderRadius:999, background:checked ? '#18966F' : '#CBD5E1', position:'relative', flexShrink:0 }}><span style={{ position:'absolute', top:2, left:checked ? 16 : 2, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left .15s' }} /></span></span>
                                <span style={{ color:'#64748B', fontSize:11, lineHeight:1.35 }}>{desc}</span>
                                <input type="checkbox" checked={checked} onChange={() => setGroupForm(p => ({ ...p, settings:{ ...p.settings, [key]: !checked } }))} style={{ display:'none' }} />
                              </label>
                            )
                          })}
                        </div>
                      </section>
                    </div>

                    <aside style={{ display:'grid', gap:16, alignContent:'start' }}>
                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:20, background:'#FFFFFF' }}>
                        <h3 style={{ margin:'0 0 18px', color:'#0F172A', fontSize:14, fontWeight:800 }}>Group Summary</h3>
                        {[
                          ['Group Name', groupForm.name || 'Not set'],
                          ['Department / Scope', groupForm.dept || 'Not selected'],
                          ['Members', String(groupForm.members.length)],
                          ['Permissions', `${enabledPermissionCount} modules selected`],
                          ['Created By', 'You'],
                          ['Created On', new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })],
                        ].map(([label, value]) => <div key={label} style={{ marginBottom:14 }}><div style={{ color:'#334155', fontSize:12, fontWeight:800 }}>{label}</div><div style={{ color:'#64748B', fontSize:13, marginTop:4 }}>{value}</div></div>)}
                      </section>
                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:20, background:'#FFFFFF' }}>
                        <h3 style={{ margin:'0 0 18px', color:'#0F172A', fontSize:14, fontWeight:800 }}>Permissions Overview</h3>
                        <div style={{ display:'flex', alignItems:'center', gap:22 }}>
                          <div style={{ width:104, height:104, borderRadius:'50%', background:`conic-gradient(#18966F 0 ${Math.round((enabledPermissionCount / GROUP_MODULES.length) * 100)}%, #EF4444 ${Math.round((enabledPermissionCount / GROUP_MODULES.length) * 100)}% 100%)`, display:'grid', placeItems:'center' }}>
                            <div style={{ width:58, height:58, borderRadius:'50%', background:'#fff', display:'grid', placeItems:'center', textAlign:'center', color:'#0F172A', fontSize:18, fontWeight:900 }}><span>{enabledPermissionCount}<small style={{ display:'block', color:'#64748B', fontSize:10, fontWeight:700 }}>Modules</small></span></div>
                          </div>
                          <div style={{ display:'grid', gap:10, fontSize:12, color:'#334155' }}><span><b style={{ color:'#18966F' }}>●</b> Enabled ({enabledPermissionCount})</span><span><b style={{ color:'#EF4444' }}>●</b> Disabled ({GROUP_MODULES.length - enabledPermissionCount})</span><span><b style={{ color:'#CBD5E1' }}>●</b> Not Set (0)</span></div>
                        </div>
                      </section>
                      <section style={{ border:'1px solid #E5E7EB', borderRadius:12, padding:14, background:'#FFFFFF' }}>
                        <h3 style={{ margin:'0 0 12px', color:'#0F172A', fontSize:14, fontWeight:800 }}>Quick Templates</h3>
                        <div style={{ display:'grid', gap:10 }}>
                          {GROUP_TEMPLATES.map(template => (
                            <button key={template.label} type="button" onClick={() => setGroupForm(p => ({ ...p, permissions: template.label === 'Read Only' ? GROUP_MODULES.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}) : { ...DEFAULT_GROUP_PERMISSIONS } }))} style={{ border:'1px solid #E5E7EB', background:template.bg, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer' }}>
                              <span style={{ width:34, height:34, borderRadius:10, background:'#fff', color:template.color, display:'grid', placeItems:'center', fontWeight:900 }}>◌</span>
                              <span><span style={{ display:'block', color:'#0F172A', fontSize:12, fontWeight:900 }}>{template.label}</span><span style={{ display:'block', color:'#64748B', fontSize:11, marginTop:3 }}>{template.desc}</span></span>
                            </button>
                          ))}
                          <button type="button" style={{ border:'1px solid #DDE5EE', background:'#FFFFFF', color:'#4F46E5', borderRadius:10, padding:'11px 14px', fontSize:13, fontWeight:800, cursor:'pointer' }}>+ Create Custom Template</button>
                        </div>
                      </section>
                    </aside>
                  </div>
                </div>

                <div style={{ display:'flex', gap:14, justifyContent:'flex-end', padding:'18px 30px', borderTop:'1px solid #E5E7EB' }}>
                  <button
                    onClick={() => { setShowGroupModal(false); setGroupForm(defaultGroupForm()); setGroupMemberSearch('') }}
                    style={{ minWidth:86, padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', border:'1px solid #E5E7EB', background:'#F8FAFC', color:'#334155', transition:'all .2s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#e5e7eb'}
                    onMouseLeave={e => e.currentTarget.style.background='#f3f4f6'}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={createGroup}
                    disabled={!groupForm.name.trim()}
                    style={{ minWidth:112, padding:'12px 18px', borderRadius:10, fontSize:13, fontWeight:800, cursor: groupForm.name.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit', border:'none', background: groupForm.name.trim() ? '#18966F' : '#94A3B8', color:'#fff', transition:'all .2s', boxShadow: groupForm.name.trim() ? '0 10px 20px rgba(24,150,111,0.24)' : 'none' }}
                    onMouseEnter={e => { if (groupForm.name.trim()) e.currentTarget.style.background=C.accent2 }}
                    onMouseLeave={e => { e.currentTarget.style.background = groupForm.name.trim() ? C.accent : 'rgba(var(--brand-rgb),0.3)' }}
                  >
                    {t('createGroup')}
                  </button>
                </div>
              </div>
            </div>
  )
}
