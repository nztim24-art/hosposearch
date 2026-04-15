import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://ecvatlagiskvapeqsfnu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjdmF0bGFnaXNrdmFwZXFzZm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTI1MzksImV4cCI6MjA5MTc4ODUzOX0.9NL3wnGKAQzfLXTpzlgEyHTiOVGFRBkM99WCYEZoAOM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signUp(email, password, name, type) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  // Create profile row
  const handle = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString().slice(-4)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      auth_id:  data.user.id,
      email,
      name,
      handle,
      type,
      avatar:   type === 'employer' ? '🍽️' : '👨‍🍳',
    })
    .select()
    .single()

  if (profileError) throw profileError
  return { user: data.user, profile }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', data.user.id)
    .single()

  return { user: data.user, profile }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_id', data.session.user.id)
    .single()

  return profile
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, profiles!emp_id(name, handle, avatar, verified, bio, cuisine, awards)')
    .eq('active', true)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(normaliseJob)
}

export async function createJob(empId, jobData) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      emp_id:     empId,
      title:      jobData.title,
      venue:      jobData.venue,
      loc:        jobData.loc,
      country:    jobData.country || 'Australia',
      state:      jobData.state || '',
      city:       jobData.city || '',
      sector:     jobData.sector || '',
      role_type:  jobData.roleType || '',
      salary:     jobData.salary || 'Competitive',
      salary_band:jobData.salaryBand || '',
      type:       jobData.type || 'Full-time',
      tags:       jobData.tags || [],
      short:      jobData.short || '',
      full_desc:  jobData.full || '',
      link:       jobData.link || '#',
      photos:     jobData.photos || [],
      video_url:  jobData.video || null,
      verified:   jobData.verified || false,
      featured:   jobData.featured || false,
    })
    .select()
    .single()
  if (error) throw error
  return normaliseJob(data)
}

export async function incrementViews(jobId) {
  await supabase.rpc('increment_job_views', { job_id: jobId })
}

export async function updateJobStatus(jobId, updates) {
  const { error } = await supabase.from('jobs').update(updates).eq('id', jobId)
  if (error) throw error
}

export async function deleteJob(jobId) {
  const { error } = await supabase.from('jobs').update({ active: false }).eq('id', jobId)
  if (error) throw error
}

// ─── Applications ─────────────────────────────────────────────────────────────

export async function applyForJob(jobId, applicantId, formData) {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id:       jobId,
      applicant_id: applicantId,
      name:         formData.name,
      message:      formData.msg || '',
      visa:         formData.visa || '',
      availability: formData.availability || [],
      hours:        formData.hours || [],
      notice:       formData.notice || '',
      resume_name:  formData.resume?.name || null,
      resume_size:  formData.resume?.size || null,
      cover_name:   formData.cover?.name || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchApplicationsForEmployer(empId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs!job_id(title, venue, emp_id), profiles!applicant_id(name, handle, avatar)')
    .eq('jobs.emp_id', empId)
  if (error) throw error
  return data
}

export async function updateApplicationStatus(appId, status) {
  const { error } = await supabase.from('applications').update({ status }).eq('id', appId)
  if (error) throw error
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, from_profile:profiles!from_id(name, handle, avatar), to_profile:profiles!to_id(name, handle, avatar)')
    .or(`from_id.eq.${userId},to_id.eq.${userId}`)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function sendMessage(fromId, toId, text) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ from_id: fromId, to_id: toId, text })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export async function fetchBookmarks(userId) {
  const { data, error } = await supabase.from('bookmarks').select('job_id').eq('user_id', userId)
  if (error) throw error
  return data.map(b => b.job_id)
}

export async function toggleBookmark(userId, jobId, isBookmarked) {
  if (isBookmarked) {
    await supabase.from('bookmarks').delete().eq('user_id', userId).eq('job_id', jobId)
  } else {
    await supabase.from('bookmarks').insert({ user_id: userId, job_id: jobId })
  }
}

// ─── Following ────────────────────────────────────────────────────────────────

export async function fetchFollowing(userId) {
  const { data, error } = await supabase.from('following').select('employer_id').eq('follower_id', userId)
  if (error) throw error
  return data.map(f => f.employer_id)
}

export async function toggleFollow(followerId, employerId, isFollowing) {
  if (isFollowing) {
    await supabase.from('following').delete().eq('follower_id', followerId).eq('employer_id', employerId)
  } else {
    await supabase.from('following').insert({ follower_id: followerId, employer_id: employerId })
  }
}

// ─── Discount Codes ───────────────────────────────────────────────────────────

export async function fetchCodes() {
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at')
  if (error) throw error
  // Convert to the format the app expects
  const codesObj = {}
  data.forEach(c => {
    codesObj[c.code] = { pct: c.pct, uses: c.max_uses, used: c.used, desc: c.description, expires: c.expires_at?.split('T')[0], active: c.active }
  })
  return codesObj
}

export async function useCode(code) {
  await supabase.rpc('increment_code_usage', { code_text: code })
}

export async function createCode(codeData) {
  const { error } = await supabase.from('discount_codes').insert({
    code: codeData.code,
    pct: codeData.pct,
    max_uses: codeData.uses,
    description: codeData.desc,
    expires_at: codeData.expires || null,
    active: true,
  })
  if (error) throw error
}

export async function toggleCodeActive(code, active) {
  await supabase.from('discount_codes').update({ active }).eq('code', code)
}

export async function deleteCode(code) {
  await supabase.from('discount_codes').delete().eq('code', code)
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data
}

export async function markNotificationRead(notifId) {
  await supabase.from('notifications').update({ read: true }).eq('id', notifId)
}

export async function createNotification(userId, type, text, sub, icon) {
  await supabase.from('notifications').insert({ user_id: userId, type, text, sub, icon })
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfile(profileId, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  if (error) throw error
}

export async function fetchProfile(profileId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).single()
  if (error) throw error
  return data
}

export async function fetchAllCandidates() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('type', 'employee')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAllEmployers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('type', 'employer')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ─── References ───────────────────────────────────────────────────────────────

export async function fetchReferences(candidateId) {
  const { data, error } = await supabase
    .from('references_table')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createReference(candidateId, refData) {
  const { error } = await supabase.from('references_table').insert({
    candidate_id: candidateId,
    venue: refData.venue,
    ref_name: refData.refName,
    ref_role: refData.refRole,
    ref_email: refData.email,
    status: 'pending',
  })
  if (error) throw error
}

// ─── Endorsements ─────────────────────────────────────────────────────────────

export async function fetchEndorsements(candidateId) {
  const { data, error } = await supabase
    .from('endorsements')
    .select('*, endorser:profiles!endorser_id(name, avatar)')
    .eq('candidate_id', candidateId)
  if (error) throw error
  // Group by skill
  const grouped = {}
  data.forEach(e => {
    if (!grouped[e.skill]) grouped[e.skill] = []
    grouped[e.skill].push({ by: e.endorser_id, name: e.endorser?.name, avatar: e.endorser?.avatar, ts: new Date(e.created_at).getTime() })
  })
  return grouped
}

export async function addEndorsement(candidateId, endorserId, skill) {
  const { error } = await supabase.from('endorsements').insert({ candidate_id: candidateId, endorser_id: endorserId, skill })
  if (error && !error.message.includes('unique')) throw error
}

// ─── Normalise DB row → app format ────────────────────────────────────────────
function normaliseJob(row) {
  return {
    id:         row.id,
    empId:      row.emp_id,
    title:      row.title,
    venue:      row.venue || row.profiles?.name || '',
    loc:        row.loc,
    country:    row.country,
    state:      row.state,
    city:       row.city,
    sector:     row.sector,
    roleType:   row.role_type,
    salary:     row.salary,
    salaryBand: row.salary_band,
    type:       row.type,
    tags:       row.tags || [],
    short:      row.short,
    full:       row.full_desc,
    link:       row.link,
    photos:     row.photos?.length > 0 ? row.photos : [0,1,2],
    video:      row.video_url || null,
    verified:   row.verified,
    featured:   row.featured,
    views:      row.views || 0,
    apps:       [],
    ts:         new Date(row.created_at).getTime(),
  }
}
