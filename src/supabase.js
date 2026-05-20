import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://ecvatlagiskvapeqsfnu.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjdmF0bGFnaXNrdmFwZXFzZm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTI1MzksImV4cCI6MjA5MTc4ODUzOX0.9NL3wnGKAQzfLXTpzlgEyHTiOVGFRBkM99WCYEZoAOM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signUp(email, password, name, type) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  const handle = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString().slice(-4)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ auth_id: data.user.id, email, name, handle, type, avatar: type === 'employer' ? '🍽️' : '👨‍🍳' })
    .select().single()
  if (profileError) throw profileError
  return { user: data.user, profile }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const { data: profile } = await supabase.from('profiles').select('*').eq('auth_id', data.user.id).single()
  return { user: data.user, profile }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('auth_id', data.session.user.id).single()
  return profile
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .neq('active', false)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchJobs error:', error)
    throw error
  }
  return data.map(normaliseJob)
}

export async function createJob(empId, jobData) {
  console.log('createJob called with empId:', empId, 'jobData:', jobData)
  
  // Handle photo data — Supabase can't store large base64 strings
  // Store placeholder indices instead
  const safePhotos = (jobData.photos || []).map((p, i) => {
    if (typeof p === 'number') return p
    if (typeof p === 'string' && p.startsWith('data:')) return i // placeholder
    return p
  })

  const insertData = {
    emp_id:      empId || 'admin',
    title:       jobData.title || '',
    venue:       jobData.venue || 'HospoSearch',
    loc:         jobData.loc || 'Australia',
    country:     jobData.country || 'Australia',
    state:       jobData.state || '',
    city:        jobData.city || '',
    sector:      jobData.sector || '',
    role_type:   jobData.roleType || '',
    salary:      jobData.salary || 'Competitive',
    salary_band: jobData.salaryBand || '',
    type:        jobData.type || 'Full-time',
    tags:        jobData.tags || [],
    short:       jobData.short || '',
    full_desc:   jobData.full || jobData.short || '',
    link:        jobData.link || '#',
    photos:      safePhotos,
    verified:    jobData.verified || false,
    featured:    jobData.featured || false,
    active:      true,
  }

  console.log('Inserting job:', insertData)

  const { data, error } = await supabase
    .from('jobs')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('createJob error:', error)
    throw error
  }

  console.log('Job created successfully:', data)
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
      name:         formData.name || '',
      message:      formData.msg || '',
      visa:         formData.visa || '',
      availability: formData.availability || [],
      hours:        formData.hours || [],
      notice:       formData.notice || '',
      resume_name:  formData.resume?.name || null,
      resume_size:  formData.resume?.size || null,
      cover_name:   formData.cover?.name || null,
    })
    .select().single()
  if (error) {
    console.error('applyForJob error:', error)
    throw error
  }
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
    .select('*')
    .or(`from_id.eq.${userId},to_id.eq.${userId}`)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function sendMessage(fromId, toId, text) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ from_id: fromId, to_id: toId, text })
    .select().single()
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

// ─── Discount Codes ───────────────────────────────────────────────────────────

export async function fetchCodes() {
  const { data, error } = await supabase.from('discount_codes').select('*').order('created_at')
  if (error) throw error
  const codesObj = {}
  data.forEach(c => {
    codesObj[c.code] = { pct: c.pct, uses: c.max_uses, used: c.used, desc: c.description, expires: c.expires_at?.split('T')[0], active: c.active }
  })
  return codesObj
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfile(profileId, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  if (error) throw error
}

// ─── Normalise DB row → app format ────────────────────────────────────────────
function normaliseJob(row) {
  if (!row) return null;
  return {
    id:         row.id || ('j' + Date.now()),
    empId:      row.emp_id || 'admin',
    title:      row.title || '',
    venue:      row.venue || 'HospoSearch',
    loc:        row.loc || row.country || 'Australia',
    country:    row.country || 'Australia',
    state:      row.state || '',
    city:       row.city || '',
    sector:     row.sector || '',
    roleType:   row.role_type || '',
    salary:     row.salary || 'Competitive',
    salaryBand: row.salary_band || '',
    type:       row.type || 'Full-time',
    tags:       Array.isArray(row.tags) ? row.tags : [],
    short:      row.short || '',
    full:       row.full_desc || row.short || '',
    link:       row.link || '#',
    photos:     Array.isArray(row.photos) && row.photos.length > 0 ? row.photos : [0, 1, 2],
    video:      row.video_url || null,
    verified:   row.verified || false,
    featured:   row.featured || false,
    views:      row.views || 0,
    apps:       [],
    ts:         row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  }
}
