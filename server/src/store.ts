import { readFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { Collection, MongoClient, OptionalUnlessRequiredId } from 'mongodb'

export type User = { id: string; fullName: string; email: string; passwordHash: string; role: 'applicant' | 'admin'; nin?: string; createdAt: string }
export type Vacancy = { id: string; title: string; faculty: string; description: string; closingDate: string; status: 'Open' | 'Closed'; createdAt: string }
export type Application = { id: string; reference: string; userId: string; vacancyId: string; qualification: string; experience: number; coverLetter: string; cvFileName: string; cvData?: string; cvMimeType?: string; status: 'Submitted' | 'Under review' | 'Shortlisted' | 'Hired' | 'Rejected'; submittedAt: string; statusHistory: { status: string; changedAt: string }[] }
export type SupportRequest = { id: string; userId?: string; name: string; email: string; subject: string; message: string; status: 'Open' | 'Resolved'; createdAt: string }
export type Database = { users: User[]; vacancies: Vacancy[]; applications: Application[]; supportRequests?: SupportRequest[] }

type MongoDocument<T> = T & { _id: string }

const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/uniflow'
const mongoClient = new MongoClient(mongoUri)
let clientPromise: Promise<MongoClient> | undefined
let collectionsPromise: Promise<{
  users: Collection<MongoDocument<User>>
  vacancies: Collection<MongoDocument<Vacancy>>
  applications: Collection<MongoDocument<Application>>
  supportRequests: Collection<MongoDocument<SupportRequest>>
}> | undefined
const uploadsDirectory = path.resolve('server/uploads')
const adminSalt = 'uniflow-local-admin'
const adminPasswordHash = `${adminSalt}:${crypto.scryptSync('Admin123!', adminSalt, 64).toString('hex')}`
const seed: Database = {
  users: [{ id: 'admin-1', fullName: 'Admin Office', email: 'admin@university.edu', passwordHash: adminPasswordHash, role: 'admin', createdAt: new Date().toISOString() }],
  vacancies: [
    { id: 'vac-1', title: 'Senior Lecturer, Computer Science', faculty: 'Faculty of Computing', description: 'Academic teaching and research position.', closingDate: '2026-12-31', status: 'Open', createdAt: new Date().toISOString() },
    { id: 'vac-2', title: 'Lecturer II, Economics', faculty: 'Faculty of Social Sciences', description: 'Teaching and research position in economics.', closingDate: '2026-12-31', status: 'Open', createdAt: new Date().toISOString() },
    { id: 'vac-3', title: 'Laboratory Technologist', faculty: 'Faculty of Health Sciences', description: 'Technical support for teaching laboratories.', closingDate: '2026-12-31', status: 'Open', createdAt: new Date().toISOString() },
  ],
  applications: [],
}

async function getCollections() {
  clientPromise ??= mongoClient.connect()
  collectionsPromise ??= clientPromise.then((client) => {
    const database = client.db()
    return {
      users: database.collection<MongoDocument<User>>('users'),
      vacancies: database.collection<MongoDocument<Vacancy>>('vacancies'),
      applications: database.collection<MongoDocument<Application>>('applications'),
      supportRequests: database.collection<MongoDocument<SupportRequest>>('supportRequests'),
    }
  })
  return collectionsPromise
}

async function readLegacyDatabase(): Promise<Database> {
  try {
    const database = JSON.parse(await readFile(path.resolve('server/data/uniflow.json'), 'utf8')) as Database
    for (const application of database.applications) {
      if (application.cvData) continue
      try {
        const safeFileName = application.cvFileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        const file = await readFile(path.join(uploadsDirectory, `${application.id}-${safeFileName}`))
        const extension = path.extname(application.cvFileName).toLowerCase()
        const mimeType = extension === '.pdf' ? 'application/pdf' : extension === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : extension === '.doc' ? 'application/msword' : 'text/plain'
        application.cvData = `data:${mimeType};base64,${file.toString('base64')}`
        application.cvMimeType = mimeType
      } catch { }
    }
    return database
  } catch { return seed }
}

const withIds = <T extends { id: string }>(items: T[]) => items.map((item) => ({ ...item, _id: item.id }))
const withoutIds = <T extends { id: string }>(items: MongoDocument<T>[]) => items.map(({ _id: _documentId, ...item }) => item)

async function readAggregateDatabase(): Promise<Database | undefined> {
  const client = await (clientPromise ??= mongoClient.connect())
  const aggregate = await client.db().collection<Database & { _id: string }>('applicationState').findOne({ _id: 'uniflow' })
  if (!aggregate) return undefined
  const { _id: _documentId, ...database } = aggregate
  return database
}

async function syncCollection<T extends { id: string }>(collection: Collection<MongoDocument<T>>, items: T[]) {
  await collection.deleteMany({})
  if (items.length) await collection.insertMany(withIds(items) as OptionalUnlessRequiredId<MongoDocument<T>>[])
}

async function syncDatabase(database: Database) {
  const collections = await getCollections()
  await Promise.all([
    syncCollection(collections.users, database.users),
    syncCollection(collections.vacancies, database.vacancies),
    syncCollection(collections.applications, database.applications),
    syncCollection(collections.supportRequests, database.supportRequests ?? []),
  ])
}

export async function connectDatabase() {
  clientPromise ??= mongoClient.connect()
  const client = await clientPromise
  await client.db().command({ ping: 1 })
  const collections = await getCollections()
  const existingCount = await collections.users.countDocuments()
  if (existingCount === 0) {
    const aggregateDatabase = await readAggregateDatabase()
    await syncDatabase(aggregateDatabase ?? await readLegacyDatabase())
  }
  await client.db().collection('applicationState').drop().catch(() => undefined)
  await collections.users.createIndex({ email: 1 }, { unique: true })
  await collections.applications.createIndex({ reference: 1 }, { unique: true })
}

export async function pingDatabase() {
  clientPromise ??= mongoClient.connect()
  await (await clientPromise).db().command({ ping: 1 })
}

export async function loadDatabase(): Promise<Database> {
  const collections = await getCollections()
  const [users, vacancies, applications, supportRequests] = await Promise.all([
    collections.users.find().toArray(),
    collections.vacancies.find().toArray(),
    collections.applications.find().toArray(),
    collections.supportRequests.find().toArray(),
  ])
  return { users: withoutIds(users), vacancies: withoutIds(vacancies), applications: withoutIds(applications), supportRequests: withoutIds(supportRequests) }
}

export async function saveDatabase(database: Database) {
  await syncDatabase(database)
}
