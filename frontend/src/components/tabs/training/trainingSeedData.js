export function getTrainingTabs(t) {
  return [
    { id:'kpi',         label:`📊 ${t('overview')}` },
    { id:'calendar',    label:`📅 ${t('calendar')}` },
    { id:'batches',     label:`👥 ${t('batches')}` },
    { id:'attendance',  label:`📋 ${t('attendance')}` },
    { id:'resources',   label:`📚 ${t('resources')}` },
    { id:'assessments', label:`📝 ${t('assessments')}` },
    { id:'certs',       label:`🏆 ${t('certifications')}` },
    { id:'feedback',    label:`💬 ${t('feedback')}` },
    { id:'analytics',   label:`📈 ${t('analytics')}` },
    { id:'trainees',    label:`👤 ${t('trainees')}` },
    { id:'skillgap',    label:`🗓️ ${t('skillGap')}` },
  ]
}
