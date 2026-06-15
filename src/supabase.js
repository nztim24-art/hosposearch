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
  const { data: profile } = await supabase.from('profiles')
    .select('*, subscription_tier, subscription_active, subscription_limit, stripe_customer_id, stripe_subscription_id')
    .eq('auth_id', data.session.user.id)
    .single()
  return profile
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchJobs() {
  // Auto-expire: any active listing whose expires_at has passed becomes inactive.
  const now = new Date().toISOString();
  try {
    await supabase.from('jobs')
      .update({ active: false })
      .eq('active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', now);
  } catch(e) { /* non-critical */ }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .or('active.is.null,active.eq.true')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetchJobs error:', error)
    throw error
  }
  return data.map(normaliseJob)
}

// Fetch ALL of an employer's jobs including expired/inactive ones (for the Mine tab)
export async function fetchMyJobs(empId) {
  // Run the same expiry sweep so statuses are current
  const now = new Date().toISOString();
  try {
    await supabase.from('jobs')
      .update({ active: false })
      .eq('active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', now);
  } catch(e) { /* non-critical */ }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('emp_id', empId)
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchMyJobs error:', error); throw error }
  return data.map(normaliseJob)
}

// Upload a single base64 image to Supabase Storage
async function uploadPhoto(base64, jobId, index) {
  try {
    // Convert base64 to blob
    const res = await fetch(base64)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const path = `jobs/${jobId}/${index}.${ext}`
    
    const { data, error } = await supabase.storage
      .from('job-photos')
      .upload(path, blob, { upsert: true, contentType: blob.type })
    
    if (error) {
      console.warn('Photo upload failed:', error)
      return null
    }
    
    const { data: urlData } = supabase.storage
      .from('job-photos')
      .getPublicUrl(path)
    
    return urlData.publicUrl
  } catch(e) {
    console.warn('Photo upload error:', e)
    return null
  }
}

export async function createJob(empId, jobData) {
  console.log('createJob called with empId:', empId)
  
  // Generate a temp ID for storage path
  const tempId = 'j' + Date.now()
  
  // Upload base64 photos to Supabase Storage
  const photoUrls = []
  const photos = jobData.photos || []
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    if (typeof p === 'string' && p.startsWith('data:')) {
      const url = await uploadPhoto(p, tempId, i)
      if (url) photoUrls.push(url)
    } else if (typeof p === 'number') {
      photoUrls.push(p) // keep placeholder numbers
    }
  }
  
  const safePhotos = photoUrls.length > 0 ? photoUrls : [0, 1, 2]

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
    apply_email: jobData.applyEmail || '',
    photos:      safePhotos,
    avatar_url:  jobData.avatar_url || null,
    address:     jobData.address || '',
    screening_q: jobData.screeningQ || {},
    verified:    jobData.verified || false,
    featured:    jobData.featured || false,
    tier:        jobData.tier || 'bronze',
    paid:        jobData.paid || false,
    active:      jobData.active !== undefined ? jobData.active : true,
  }

  console.log('Inserting job:', insertData)

  let { data, error } = await supabase
    .from('jobs')
    .insert(insertData)
    .select()
    .single()

  // If insert failed due to an unknown column (e.g. apply_email/tier/paid not migrated yet),
  // strip optional columns and retry so the listing still saves.
  if (error && /column .* does not exist|Could not find/i.test(error.message || '')) {
    console.warn('Insert failed on optional column, retrying without optionals:', error.message)
    const { apply_email, tier, paid, ...safeData } = insertData
    const retry = await supabase.from('jobs').insert(safeData).select().single()
    data = retry.data; error = retry.error
  }

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

// Full edit of a job listing — handles photo re-upload and field mapping.
// Used by employers editing their own existing listings.
export async function updateJobFull(jobId, jobData) {
  // Upload any new base64 photos; keep existing https URLs and numeric placeholders as-is
  const photoUrls = []
  const photos = jobData.photos || []
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    if (typeof p === 'string' && p.startsWith('data:')) {
      const url = await uploadPhoto(p, jobId, i)
      if (url) photoUrls.push(url)
    } else if (typeof p === 'string' && p.startsWith('http')) {
      photoUrls.push(p) // keep already-uploaded photo
    } else if (typeof p === 'number') {
      photoUrls.push(p) // keep placeholder
    }
  }
  const safePhotos = photoUrls.length > 0 ? photoUrls : [0, 1, 2]

  const updateData = {
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
    apply_email: jobData.applyEmail || '',
    photos:      safePhotos,
    featured:    jobData.featured || false,
    tier:        jobData.tier || 'bronze',
    screening_q: jobData.screeningQ || {},
  }

  let { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', jobId)
    .select()
    .single()

  // Retry without optional columns if any are missing
  if (error && /column .* does not exist|Could not find/i.test(error.message || '')) {
    const { apply_email, tier, ...safeData } = updateData
    const retry = await supabase.from('jobs').update(safeData).eq('id', jobId).select().single()
    data = retry.data; error = retry.error
  }

  if (error) { console.error('updateJobFull error:', error); throw error }
  return normaliseJob(data)
}

export async function deleteJob(jobId) {
  const { error } = await supabase.from('jobs').update({ active: false }).eq('id', jobId)
  if (error) throw error
}

// ─── Applications ─────────────────────────────────────────────────────────────

// Upload resume or cover letter to Supabase Storage
export async function uploadDocument(file, applicantId, type) {
  try {
    const ext = file.name ? file.name.split('.').pop() : 'pdf'
    const path = `applicants/${applicantId}/${type}_${Date.now()}.${ext}`
    
    // Convert base64 or blob
    let blob
    if (file.data && file.data.startsWith('data:')) {
      const res = await fetch(file.data)
      blob = await res.blob()
    } else if (file instanceof Blob) {
      blob = file
    } else {
      return null
    }
    
    // Use the public job-photos bucket so download URLs work
    // (documents bucket is private — getPublicUrl returns a 404 for private buckets)
    const { error } = await supabase.storage
      .from('job-photos')
      .upload(path, blob, { upsert: true, contentType: blob.type || 'application/pdf' })
    
    if (error) { console.warn('Document upload error:', error); return null; }
    
    const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(path)
    return { url: urlData.publicUrl, name: file.name, size: file.size, path }
  } catch(e) {
    console.warn('uploadDocument error:', e)
    return null
  }
}

export async function applyForJob(jobId, applicantId, formData) {
  // Upload documents to Supabase Storage first (only if new file data provided)
  let resumeData = null
  let coverData = null

  if (formData.resume?.data) {
    resumeData = await uploadDocument(formData.resume, applicantId, 'resume')
  }
  if (formData.cover?.data) {
    coverData = await uploadDocument(formData.cover, applicantId, 'cover')
  }

  // Fall back to an existing URL from the candidate's saved profile docs
  const resumeUrl  = resumeData?.url || formData.resume?.url || null
  const coverUrl   = coverData?.url  || formData.cover?.url  || null

  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id:       jobId,
      applicant_id: applicantId,
      name:         formData.name || '',
      email:        formData.email || '',
      phone:        formData.phone || '',
      message:      formData.msg || '',
      visa:         formData.visa || '',
      availability: formData.availability || [],
      hours:        formData.hours || [],
      notice:       formData.notice || '',
      resume_name:  formData.resume?.name || null,
      resume_size:  formData.resume?.size || null,
      resume_url:   resumeUrl,
      cover_name:   formData.cover?.name || null,
      cover_url:    coverUrl,
      screening_answers: formData.screeningAnswers || {},
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

// Fetch all job-seeker profiles that have opted into being discoverable by employers
export async function fetchPublicProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('type', 'employee')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('fetchPublicProfiles error:', error)
    return []
  }
  return (data || []).map(normaliseProfile)
}

function normaliseProfile(row) {
  if (!row) return null
  return {
    id:          row.id,
    name:        row.name || '',
    handle:      row.handle || '',
    avatar:      row.avatar || '👨‍🍳',
    avatarUrl:   row.avatar_url || null,
    role:        row.role || row.headline || 'Hospitality Professional',
    experience:  row.experience || '',
    location:    row.location || '',
    country:     row.country || '',
    bio:         row.bio || '',
    skills:      Array.isArray(row.skills) ? row.skills : [],
    cuisine:     Array.isArray(row.cuisine) ? row.cuisine : [],
    available:   row.available !== false,
    isPublic:    row.is_public === true,
    contactEmail: row.contact_email || row.email || '',
    contactPhone: row.contact_phone || '',
    showEmail:   row.show_email !== false,
    showPhone:   row.show_phone === true,
    showResume:  row.show_resume !== false,
    workLink:    row.work_link || '',
    showLink:    row.show_link !== false,
    role:        row.role || row.headline || 'Hospitality Professional',
    sector:      row.sector || '',
    country:     row.country || '',
    state:       row.state || '',
    city:        row.city || '',
    yearsExp:    row.years_exp || row.experience || '',
    contactEmail: row.contact_email || row.email || '',
    instagram:   row.instagram || '',
    resumeUrl:   row.resume_url || null,
    resumeName:  row.resume_name || null,
    photos:      Array.isArray(row.work_photos) ? row.work_photos : [],
    sector:      row.sector || '',
  }
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
    applyEmail: row.apply_email || '',
    photos:     Array.isArray(row.photos) && row.photos.length > 0 ? row.photos : [0, 1, 2],
    video:      row.video_url || null,
    verified:   row.verified || false,
    featured:   row.featured || false,
    views:      row.views || 0,
    apps:       [],
    avatar_url: row.avatar_url || null,
    address:    row.address || '',
    screeningQ: row.screening_q || {},
    ts:         row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    tier:       row.tier || 'bronze',
    paid:       row.paid || false,
    active:     row.active !== undefined ? row.active : true,
    expiresAt:  row.expires_at ? new Date(row.expires_at).getTime() : null,
  }
}

// ─── Job Alerts (saved searches) ──────────────────────────────────────────────

export async function fetchAlerts(userId) {
  const { data, error } = await supabase
    .from('job_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(a => ({
    id: a.id,
    role: a.role || '',
    loc: a.location || '',
    type: a.emp_type || 'Any',
    salary: a.salary_band || 'Any',
    tags: a.tags || [],
    label: a.label || '',
    active: a.active !== false,
    createdAt: new Date(a.created_at).getTime(),
  }))
}

export async function createAlert(userId, alert) {
  const { data, error } = await supabase
    .from('job_alerts')
    .insert({
      user_id: userId,
      role: alert.role || '',
      location: alert.loc || '',
      emp_type: alert.type || 'Any',
      salary_band: alert.salary || 'Any',
      tags: alert.tags || [],
      label: alert.label || alert.role || 'Saved search',
      active: true,
    })
    .select()
    .single()
  if (error) throw error
  return {
    id: data.id, role: data.role||'', loc: data.location||'', type: data.emp_type||'Any',
    salary: data.salary_band||'Any', tags: data.tags||[], label: data.label||'',
    active: data.active!==false, createdAt: new Date(data.created_at).getTime(),
  }
}

export async function deleteAlert(alertId) {
  const { error } = await supabase.from('job_alerts').delete().eq('id', alertId)
  if (error) throw error
}

export async function toggleAlertActive(alertId, active) {
  const { error } = await supabase.from('job_alerts').update({ active }).eq('id', alertId)
  if (error) throw error
}

// ─── Admin create job (via service-role API, bypasses RLS) ────────────────────
// Admin has no Supabase auth session, so direct inserts are blocked by RLS.
// This uploads photos then posts to /api/admin-job which inserts as service role.
export async function adminCreateJob(adminSecret, jobData) {
  const tempId = 'j' + Date.now()
  const photoUrls = []
  const photos = jobData.photos || []
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i]
    if (typeof p === 'string' && p.startsWith('data:')) {
      const url = await uploadPhoto(p, tempId, i)
      if (url) photoUrls.push(url)
    } else if (typeof p === 'number') {
      photoUrls.push(p)
    }
  }
  const safePhotos = photoUrls.length > 0 ? photoUrls : [0, 1, 2]

  const fields = {
    emp_id:      'admin',
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
    apply_email: jobData.applyEmail || '',
    photos:      safePhotos,
    avatar_url:  jobData.avatar_url || null,
    address:     jobData.address || '',
    screening_q: jobData.screeningQ || {},
    verified:    jobData.verified !== undefined ? jobData.verified : true,
    featured:    jobData.featured || false,
    tier:        jobData.tier || 'bronze',
    paid:        true,          // admin posts are always live
    active:      true,
  }

  const res = await fetch('/api/admin-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: adminSecret, action: 'create', fields }),
  })
  if (!res.ok) throw new Error(`adminCreateJob failed: ${res.status}`)
  const { job } = await res.json()
  return normaliseJob(job)
}
