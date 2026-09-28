import crypto from 'node:crypto'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mammoth from 'mammoth'
import { Application, connectDatabase, loadDatabase, pingDatabase, saveDatabase, SupportRequest, User } from './store.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const sessions = new Map<string, string>()
const demoNinRecords: Record<string, { firstName: string; lastName: string; dateOfBirth: string }> = {
  '12345678901': { firstName: 'Amina', lastName: 'Musa', dateOfBirth: '1991-04-12' },
  '23456789012': { firstName: 'Chinedu', lastName: 'Okoro', dateOfBirth: '1989-07-21' },
  '34567890123': { firstName: 'Fatima', lastName: 'Nuhu', dateOfBirth: '1993-02-15' },
  '45678901234': { firstName: 'Yusuf', lastName: 'Bello', dateOfBirth: '1987-10-09' },
  '56789012345': { firstName: 'Sarah', lastName: 'Adeyemi', dateOfBirth: '1990-05-28' },
}

app.use(cors())
app.use(express.json({ limit: '12mb' }))

const hashPassword = (password: string, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
const passwordMatches = (password: string, stored: string) => { const [salt, hash] = stored.split(':'); return Boolean(salt && hash) && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(password, salt, 64)) }
const publicUser = (user: User) => ({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, nin: user.nin })
const applicationWithoutCv = ({ cvData: _cvData, cvMimeType: _cvMimeType, ...application }: Application) => application
const tokenFor = (userId: string) => { const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, userId); return token }
const authenticatedUser = async (request: express.Request) => { const token = request.headers.authorization?.replace('Bearer ', ''); if (!token) return undefined; const database = await loadDatabase(); return database.users.find((user) => user.id === sessions.get(token)) }

app.get('/api/health', async (_request, response) => {
  try {
    await pingDatabase()
    response.json({ service: 'uniflow-api', status: 'ok', database: 'mongodb' })
  } catch {
    response.status(503).json({ service: 'uniflow-api', status: 'error', database: 'mongodb' })
  }
})

app.post('/api/v1/auth/register', async (request, response) => {
  const { fullName, email, password } = request.body as { fullName?: string; email?: string; password?: string }
  if (!fullName || !email || !password || password.length < 8) return response.status(400).json({ message: 'Full name, email, and an 8-character password are required.' })
  const database = await loadDatabase(); const normalizedEmail = email.trim().toLowerCase()
  if (database.users.some((user) => user.email === normalizedEmail)) return response.status(409).json({ message: 'An account with this email already exists.' })
  const user: User = { id: crypto.randomUUID(), fullName: fullName.trim(), email: normalizedEmail, passwordHash: hashPassword(password), role: 'applicant', createdAt: new Date().toISOString() }
  database.users.push(user); await saveDatabase(database); response.status(201).json({ user: publicUser(user), token: tokenFor(user.id) })
})

app.post('/api/v1/auth/login', async (request, response) => {
  const { email, password } = request.body as { email?: string; password?: string }; const database = await loadDatabase(); const user = database.users.find((candidate) => candidate.email === email?.trim().toLowerCase())
  if (!user || !password || !passwordMatches(password, user.passwordHash)) return response.status(401).json({ message: 'Invalid email or password.' })
  response.json({ user: publicUser(user), token: tokenFor(user.id) })
})

app.get('/api/v1/admin/session', async (request, response) => {
  const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); response.json({ user: publicUser(user) })
})

app.get('/api/v1/vacancies', async (_request, response) => response.json((await loadDatabase()).vacancies.filter((vacancy) => vacancy.status === 'Open')))
app.get('/api/v1/admin/vacancies', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); response.json((await loadDatabase()).vacancies) })
app.post('/api/v1/admin/vacancies', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); const { title, faculty, description, closingDate } = request.body as { title?: string; faculty?: string; description?: string; closingDate?: string }; if (!title || !faculty || !description || !closingDate) return response.status(400).json({ message: 'Title, faculty, description, and closing date are required.' }); const database = await loadDatabase(); const vacancy = { id: crypto.randomUUID(), title: title.trim(), faculty: faculty.trim(), description: description.trim(), closingDate, status: 'Open' as const, createdAt: new Date().toISOString() }; database.vacancies.push(vacancy); await saveDatabase(database); response.status(201).json(vacancy) })
app.delete('/api/v1/admin/vacancies/:id', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); const database = await loadDatabase(); const index = database.vacancies.findIndex((vacancy) => vacancy.id === request.params.id); if (index === -1) return response.status(404).json({ message: 'Vacancy not found.' }); if (database.applications.some((application) => application.vacancyId === request.params.id)) return response.status(409).json({ message: 'Vacancies with applications cannot be deleted.' }); database.vacancies.splice(index, 1); await saveDatabase(database); response.status(204).send() })

app.post('/api/v1/auth/verify-nin', async (request, response) => {
  const { nin } = request.body as { nin?: string }
  if (!nin || !/^\d{11}$/.test(nin)) return response.status(400).json({ message: 'Enter a valid 11-digit NIN.' })
  const providerUrl = process.env.NIN_PROVIDER_URL
  let record: { firstName: string; lastName: string; dateOfBirth: string; verified?: boolean }
  if (providerUrl) {
    try {
      const providerResponse = await fetch(providerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.NIN_PROVIDER_KEY ? { Authorization: `Bearer ${process.env.NIN_PROVIDER_KEY}` } : {}) }, body: JSON.stringify({ nin }) })
      if (!providerResponse.ok) return response.status(502).json({ message: 'NIN verification service is unavailable.' })
      record = await providerResponse.json() as typeof record
    } catch { return response.status(502).json({ message: 'NIN verification service is unavailable.' }) }
  } else {
    record = demoNinRecords[nin]
    if (!record) return response.status(404).json({ message: 'Demo NIN not found. Use the development value shown on the portal.' })
  }
  if (record.verified === false || !record.firstName || !record.lastName) return response.status(404).json({ message: 'NIN could not be verified.' })
  const user = await authenticatedUser(request); if (user) { const database = await loadDatabase(); const storedUser = database.users.find((candidate) => candidate.id === user.id); if (storedUser) { storedUser.nin = nin; await saveDatabase(database) } }
  response.json({ verified: true, nin, ...record })
})

app.post('/api/v1/support-requests', async (request, response) => {
  const user = await authenticatedUser(request)
  const { name, email, subject, message } = request.body as { name?: string; email?: string; subject?: string; message?: string }
  if (!subject?.trim() || !message?.trim()) return response.status(400).json({ message: 'Subject and message are required.' })
  if (!user && (!name?.trim() || !email?.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()))) return response.status(400).json({ message: 'Name and a valid email are required.' })
  const database = await loadDatabase(); database.supportRequests ??= []
  const supportRequest: SupportRequest = { id: crypto.randomUUID(), userId: user?.id, name: user?.fullName ?? name!.trim(), email: user?.email ?? email!.trim().toLowerCase(), subject: subject.trim(), message: message.trim(), status: 'Open', createdAt: new Date().toISOString() }
  database.supportRequests.unshift(supportRequest); await saveDatabase(database); response.status(201).json(supportRequest)
})

app.get('/api/v1/admin/support-requests', async (request, response) => {
  const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' })
  const database = await loadDatabase(); response.json(database.supportRequests ?? [])
})

app.post('/api/v1/applications', async (request, response) => {
  const user = await authenticatedUser(request); if (!user) return response.status(401).json({ message: 'Sign in is required.' })
  const { vacancyId, qualification, experience, coverLetter, cvFileName, cvData } = request.body as Partial<Application> & { cvData?: string }
  if (!user.nin || !vacancyId || !qualification || experience === undefined || !coverLetter || !cvFileName || !cvData) return response.status(400).json({ message: 'Verify your NIN and complete every application field.' })
  const database = await loadDatabase(); if (!database.vacancies.some((vacancy) => vacancy.id === vacancyId && vacancy.status === 'Open')) return response.status(400).json({ message: 'This vacancy is not available.' })
  const applicationId = crypto.randomUUID(); const reference = `UFR-${Date.now().toString().slice(-7)}`; const cvDirectory = path.resolve('server/uploads'); await mkdir(cvDirectory, { recursive: true }); const cvPath = path.join(cvDirectory, `${applicationId}-${cvFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`); await writeFile(cvPath, Buffer.from(cvData.replace(/^data:[^;]+;base64,/, ''), 'base64'))
  const now = new Date().toISOString(); const cvMimeType = cvData.match(/^data:([^;]+);base64,/)?.[1] ?? 'application/octet-stream'; const application: Application = { id: applicationId, reference, userId: user.id, vacancyId, qualification, experience: Number(experience), coverLetter, cvFileName, cvData, cvMimeType, status: 'Submitted', submittedAt: now, statusHistory: [{ status: 'Submitted', changedAt: now }] }
  database.applications.push(application); await saveDatabase(database); response.status(201).json(applicationWithoutCv(application))
})

app.get('/api/v1/applications/me', async (request, response) => { const user = await authenticatedUser(request); if (!user) return response.status(401).json({ message: 'Sign in is required.' }); const database = await loadDatabase(); response.json(database.applications.filter((application) => application.userId === user.id).map((application) => ({ ...applicationWithoutCv(application), vacancy: database.vacancies.find((vacancy) => vacancy.id === application.vacancyId)?.title }))) })
app.get('/api/v1/admin/applications', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); const database = await loadDatabase(); response.json(database.applications.map((application) => ({ ...applicationWithoutCv(application), applicant: database.users.find((candidate) => candidate.id === application.userId)?.fullName, vacancy: database.vacancies.find((vacancy) => vacancy.id === application.vacancyId)?.title }))) })
app.get('/api/v1/admin/activity', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); const database = await loadDatabase(); const events = database.applications.flatMap((application) => { const applicant = database.users.find((candidate) => candidate.id === application.userId)?.fullName ?? 'Applicant'; const vacancy = database.vacancies.find((candidate) => candidate.id === application.vacancyId)?.title ?? 'Vacancy'; return application.statusHistory.map((history) => ({ id: `${application.id}-${history.changedAt}`, type: history.status === 'Submitted' ? 'Application received' : `Application ${history.status.toLowerCase()}`, applicant, vacancy, status: history.status, changedAt: history.changedAt })) }).sort((left, right) => right.changedAt.localeCompare(left.changedAt)); response.json(events) })
app.get('/api/v1/admin/applications/:id/cv', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); const database = await loadDatabase(); const application = database.applications.find((candidate) => candidate.id === request.params.id); if (!application) return response.status(404).json({ message: 'Application not found.' }); let cvBuffer: Buffer; if (application.cvData) { cvBuffer = Buffer.from(application.cvData.replace(/^data:[^;]+;base64,/, ''), 'base64') } else { const cvDirectory = path.resolve('server/uploads'); const cvPath = path.join(cvDirectory, `${application.id}-${application.cvFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`); try { const { readFile } = await import('node:fs/promises'); cvBuffer = await readFile(cvPath) } catch { return response.status(404).json({ message: 'CV file not found.' }) } } if (application.cvFileName.toLowerCase().endsWith('.docx')) { const converted = await mammoth.convertToHtml({ buffer: cvBuffer }); response.type('html'); response.setHeader('Content-Disposition', 'inline'); return response.send(`<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px Arial,sans-serif;line-height:1.6;max-width:820px;margin:40px auto;padding:0 28px;color:#252b27}img{max-width:100%}</style></head><body>${converted.value}</body></html>`) } response.type(application.cvMimeType ?? 'application/octet-stream'); response.setHeader('Content-Disposition', `inline; filename="${application.cvFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`); return response.send(cvBuffer) })
app.patch('/api/v1/admin/applications/:id/status', async (request, response) => { const user = await authenticatedUser(request); if (user?.role !== 'admin') return response.status(403).json({ message: 'Administrator access is required.' }); const database = await loadDatabase(); const application = database.applications.find((candidate) => candidate.id === request.params.id); const status = request.body.status as Application['status']; if (!application || !['Submitted', 'Under review', 'Shortlisted', 'Hired', 'Rejected'].includes(status)) return response.status(400).json({ message: 'Invalid application or status.' }); application.status = status; application.statusHistory.push({ status, changedAt: new Date().toISOString() }); await saveDatabase(database); response.json(application) })

const startServer = async () => {
  await connectDatabase()
  app.listen(port, () => console.log(`UniFlow API listening on http://localhost:${port}`))
}

startServer().catch((error) => {
  console.error('Unable to connect to MongoDB:', error)
  process.exitCode = 1
})