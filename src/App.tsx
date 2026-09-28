import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import './App.css'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
type Vacancy = { id: string; title: string; faculty: string; description: string; closingDate: string; status: string }
type ApiApplication = { id: string; reference: string; applicant?: string; vacancy?: string; qualification?: string; experience?: number; coverLetter?: string; cvFileName?: string; submittedAt: string; status: Status; statusHistory?: { status: string; changedAt: string }[] }
type Activity = { id: string; type: string; applicant: string; vacancy: string; status: Status; changedAt: string }
type SupportRequest = { id: string; name: string; email: string; subject: string; message: string; status: 'Open' | 'Resolved'; createdAt: string }
type VerifiedIdentity = { firstName: string; lastName: string; dateOfBirth: string }
type CvPreview = { url: string; fileName: string }

type Status = 'Submitted' | 'Under review' | 'Shortlisted' | 'Hired' | 'Rejected'

type Application = {
  id: string
  apiId?: string
  initials: string
  name: string
  role: string
  cvFileName?: string
  qualification?: string
  experience?: number
  coverLetter?: string
  submittedAt: string
  statusHistory: { status: string; changedAt: string }[]
  faculty: string
  date: string
  status: Status
  color: string
}

const navItems = [
  { label: 'Overview', icon: '▦' },
  { label: 'Application queue', icon: '□' },
  { label: 'Vacancies', icon: '＋' },
  { label: 'Reports', icon: '⌁' },
  { label: 'Recent activity', icon: '◷' },
  { label: 'Recruitment Support', icon: '?' },
]

function App() {
  const [activeNav, setActiveNav] = useState(() => window.location.pathname === '/applicant' || window.location.hash === '#applicant-portal' || window.location.port === '5174' ? 'Applicant portal' : 'Overview')
  const [filter, setFilter] = useState<'All' | Status>('All')
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<Application[]>([])
  const [signedIn, setSignedIn] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [accountMessage, setAccountMessage] = useState('')
  const [ninValue, setNinValue] = useState('')
  const [verifiedIdentity, setVerifiedIdentity] = useState<VerifiedIdentity | null>(null)
  const [ninState, setNinState] = useState<'idle' | 'loading' | 'verified' | 'error'>('idle')
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [applicationReference, setApplicationReference] = useState('')
  const [applicationStarted, setApplicationStarted] = useState(false)
  const [submittedApplication, setSubmittedApplication] = useState<ApiApplication | null>(null)
  const [showApplicationStatus, setShowApplicationStatus] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [portalMessage, setPortalMessage] = useState('')
  const [adminSignedIn, setAdminSignedIn] = useState(false)
  const [adminToken, setAdminToken] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [adminVacancies, setAdminVacancies] = useState<Vacancy[]>([])
  const [adminActivity, setAdminActivity] = useState<Activity[]>([])
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [showVacancyForm, setShowVacancyForm] = useState(false)
  const [cvPreview, setCvPreview] = useState<CvPreview | null>(null)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [footerPanel, setFooterPanel] = useState<'privacy' | 'terms' | null>(null)
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')

  const visibleApplications = records.filter((application) => {
    const matchesFilter = filter === 'All' || application.status === filter
    const searchText = `${application.name} ${application.role} ${application.id}`.toLowerCase()
    return matchesFilter && searchText.includes(query.toLowerCase())
  }).sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
  const underReviewCount = records.filter((application) => application.status === 'Under review').length
  const shortlistedCount = records.filter((application) => application.status === 'Shortlisted').length
  const now = new Date()
  const thisMonthApplications = records.filter((application) => { const date = new Date(application.date); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() }).length
  const previousMonthApplications = records.filter((application) => { const date = new Date(application.date); const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); return date.getFullYear() === previousMonth.getFullYear() && date.getMonth() === previousMonth.getMonth() }).length
  const monthlyChange = previousMonthApplications ? Math.round(((thisMonthApplications - previousMonthApplications) / previousMonthApplications) * 1000) / 10 : null

  useEffect(() => {
    if (!adminSignedIn) return
    fetch(`${apiUrl}/v1/admin/applications`, { headers: { Authorization: `Bearer ${adminToken}` } }).then(async (response) => {
      if (!response.ok) throw new Error('Could not load applications.')
      const result = await response.json() as ApiApplication[]
      setRecords(result.map((application) => ({ id: application.reference, apiId: application.id, initials: (application.applicant ?? 'Applicant').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), name: application.applicant ?? 'Applicant', role: application.vacancy ?? 'Vacancy', cvFileName: application.cvFileName, qualification: application.qualification, experience: application.experience, coverLetter: application.coverLetter, submittedAt: application.submittedAt, statusHistory: application.statusHistory ?? [], faculty: 'University recruitment', date: new Date(application.submittedAt).toLocaleString(), status: application.status, color: '#d6c8a9' })))
    }).catch((error) => setAdminMessage(error instanceof Error ? error.message : 'Could not load applications.'))
    fetch(`${apiUrl}/v1/admin/vacancies`, { headers: { Authorization: `Bearer ${adminToken}` } }).then(async (response) => { if (!response.ok) throw new Error('Could not load vacancies.'); setAdminVacancies(await response.json()) }).catch((error) => setAdminMessage(error instanceof Error ? error.message : 'Could not load vacancies.'))
    setActivityLoading(true); fetch(`${apiUrl}/v1/admin/activity`, { headers: { Authorization: `Bearer ${adminToken}` } }).then(async (response) => { if (!response.ok) throw new Error('Could not load activity.'); setAdminActivity(await response.json()) }).catch((error) => setAdminMessage(error instanceof Error ? error.message : 'Could not load activity.')).finally(() => setActivityLoading(false))
    fetch(`${apiUrl}/v1/admin/support-requests`, { headers: { Authorization: `Bearer ${adminToken}` } }).then(async (response) => { if (!response.ok) throw new Error('Could not load support requests.'); setSupportRequests(await response.json()) }).catch((error) => setAdminMessage(error instanceof Error ? error.message : 'Could not load support requests.'))
  }, [adminSignedIn, adminToken])

  const updateStatus = async (id: string, status: Status) => {
    const record = records.find((application) => application.id === id)
    if (!record) return
    try {
      const response = await fetch(`${apiUrl}/v1/admin/applications/${record.apiId ?? id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status }) })
      if (!response.ok) throw new Error((await response.json()).message)
      setRecords((current) => current.map((application) => application.id === id ? { ...application, status } : application))
    } catch (error) { setAdminMessage(error instanceof Error ? error.message : 'Could not update status.') }
  }

  const viewCv = useCallback(async (application: Application) => {
    try {
      const response = await fetch(`${apiUrl}/v1/admin/applications/${application.apiId ?? application.id}/cv`, { headers: { Authorization: `Bearer ${adminToken}` } })
      if (!response.ok) throw new Error((await response.json()).message)
      const url = URL.createObjectURL(await response.blob())
      setCvPreview({ url, fileName: application.cvFileName ?? `${application.id}-cv` })
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Could not open CV.')
    }
  }, [adminToken])

  const closeCvPreview = () => {
    if (cvPreview) URL.revokeObjectURL(cvPreview.url)
    setCvPreview(null)
  }
  const closeApplicationDetails = () => setSelectedApplication(null)

  const submitSupportRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSupportMessage('')
    const form = new FormData(event.currentTarget)
    try { const response = await fetch(`${apiUrl}/v1/support-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify({ name: form.get('name'), email: form.get('email'), subject: form.get('subject'), message: form.get('message') }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setSupportMessage('Your request has been sent to the recruitment office.'); event.currentTarget.reset() } catch (error) { setSupportMessage(error instanceof Error ? error.message : 'Could not submit support request.') }
  }

  const closeSupport = () => { setSupportMessage(''); setSupportOpen(false) }

  const cvModal = cvPreview && <div className="cv-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCvPreview() }}><section className="cv-modal" role="dialog" aria-modal="true" aria-labelledby="cv-modal-title"><header><div><p className="eyebrow">DOCUMENT REVIEW</p><h2 id="cv-modal-title">Curriculum Vitae</h2><p>{cvPreview.fileName}</p></div><button type="button" className="close-button" onClick={closeCvPreview} aria-label="Close CV preview">✕</button></header><iframe src={cvPreview.url} title="Applicant CV preview" /><footer><a className="primary-button" href={cvPreview.url} download={cvPreview.fileName}>Download CV</a><button type="button" className="outline-button" onClick={closeCvPreview}>Close</button></footer></section></div>
  const applicationDetailsModal = selectedApplication && <div className="application-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeApplicationDetails() }}><section className="application-details-modal" role="dialog" aria-modal="true" aria-labelledby="application-details-title"><header className="application-details-header"><div><p className="eyebrow">APPLICATION REVIEW</p><h2 id="application-details-title">{selectedApplication.name}</h2><p>{selectedApplication.id} · {selectedApplication.role}</p></div><button type="button" className="close-button" onClick={closeApplicationDetails} aria-label="Close application details">✕</button></header><div className="application-details-body"><div className="application-details-summary"><div><span>POSITION</span><strong>{selectedApplication.role}</strong></div><div><span>SUBMITTED</span><strong>{selectedApplication.date}</strong></div><div><span>STATUS</span><strong className={`detail-status status-${selectedApplication.status.replace(' ', '-').toLowerCase()}`}>{selectedApplication.status}</strong></div></div><div className="application-details-grid"><div><span>QUALIFICATION</span><strong>{selectedApplication.qualification || 'Not provided'}</strong></div><div><span>EXPERIENCE</span><strong>{selectedApplication.experience === undefined ? 'Not provided' : `${selectedApplication.experience} years`}</strong></div><div><span>CV FILE</span><strong>{selectedApplication.cvFileName || 'Not provided'}</strong></div></div><div className="application-detail-section"><span>COVER LETTER</span><p>{selectedApplication.coverLetter || 'No cover letter provided.'}</p></div><div className="application-detail-section"><span>STATUS HISTORY</span>{selectedApplication.statusHistory.length === 0 ? <p>No status history recorded.</p> : <div className="status-history">{selectedApplication.statusHistory.map((history) => <div key={`${history.status}-${history.changedAt}`}><strong>{history.status}</strong><time>{new Date(history.changedAt).toLocaleString()}</time></div>)}</div>}</div></div><footer className="application-details-footer"><button type="button" className="outline-button" onClick={() => { closeApplicationDetails(); void viewCv(selectedApplication) }}>View CV</button><button type="button" className="primary-button" onClick={closeApplicationDetails}>Close</button></footer></section></div>
  const footerInfoModal = footerPanel && <div className="footer-info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFooterPanel(null) }}><section className="footer-info-modal" role="dialog" aria-modal="true" aria-labelledby="footer-info-title"><button type="button" className="close-button" onClick={() => setFooterPanel(null)} aria-label="Close information">✕</button><p className="eyebrow">{footerPanel === 'privacy' ? 'PRIVACY & DATA' : 'PORTAL TERMS'}</p><h2 id="footer-info-title">{footerPanel === 'privacy' ? 'Your information stays protected.' : 'Using the recruitment portal.'}</h2><p>{footerPanel === 'privacy' ? 'Your identity, application details, and uploaded documents are used only to process university recruitment applications and are protected by the recruitment office.' : 'Applicants are responsible for submitting accurate information and documents. Applications are reviewed according to the requirements of each published vacancy.'}</p><button type="button" className="primary-button" onClick={() => setFooterPanel(null)}>Understood</button></section></div>
  const supportModal = supportOpen && <div className="footer-info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSupport() }}><section className="footer-info-modal support-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title"><button type="button" className="close-button" onClick={closeSupport} aria-label="Close support">✕</button><p className="eyebrow">RECRUITMENT SUPPORT</p><h2 id="support-modal-title">How can we help?</h2><p>Send the recruitment office a message and our support team will respond during office hours.</p>{supportMessage && <p className={supportMessage.startsWith('Your') ? 'support-success' : 'error-message'}>{supportMessage}</p>}<form onSubmit={submitSupportRequest}>{!signedIn && <><label>Your name<input name="name" required placeholder="Enter your full name" autoComplete="off" /></label><label>Email address<input name="email" type="email" required placeholder="you@example.com" autoComplete="off" /></label></>}<label>Subject<input name="subject" required placeholder="e.g. Help with my application" autoComplete="off" /></label><label>Message<textarea name="message" rows={4} required placeholder="Describe what you need help with." autoComplete="off" /></label><div><button type="submit" className="primary-button">Submit request</button><button type="button" className="outline-button" onClick={closeSupport}>Cancel</button></div></form><a className="support-email-fallback" href="mailto:recruitment@university.edu">Prefer email? Contact recruitment@university.edu</a></section></div>

  useLayoutEffect(() => {
    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.table-wrap tbody tr'))
    rows.forEach((row, index) => {
      const application = visibleApplications[index % visibleApplications.length]
      if (!application) return
      row.tabIndex = 0
      row.setAttribute('role', 'button')
      row.setAttribute('aria-label', `Open application details for ${application.name}`)
      row.onclick = (event) => { if ((event.target as HTMLElement).closest('button, select, option')) return; setSelectedApplication(application) }
      row.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedApplication(application) } }
    })
    const actionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.more-button'))
    actionButtons.forEach((button, index) => {
      const application = visibleApplications[index % visibleApplications.length]
      if (!application) return
      button.textContent = 'View CV'
      button.title = 'View CV'
      button.setAttribute('aria-label', `View CV for ${application.name}`)
      button.onclick = (event) => { event.stopPropagation(); void viewCv(application) }
    })
    return () => {
      rows.forEach((row) => { row.onclick = null; row.onkeydown = null })
      actionButtons.forEach((button) => { button.onclick = null })
    }
  }, [activeNav, visibleApplications, viewCv])


  
  const adminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    try { const response = await fetch(`${apiUrl}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) }); const result = await response.json(); if (!response.ok || result.user.role !== 'admin') throw new Error('Administrator credentials are required.'); setAdminToken(result.token); setAdminSignedIn(true); setAdminMessage('') } catch (error) { setAdminMessage(error instanceof Error ? error.message : 'Admin sign in failed.') }
  }

  const createVacancy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    try { const response = await fetch(`${apiUrl}/v1/admin/vacancies`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ title: form.get('title'), faculty: form.get('faculty'), description: form.get('description'), closingDate: form.get('closingDate') }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setAdminVacancies((current) => [...current, result]); setShowVacancyForm(false); setAdminMessage('') } catch (error) { setAdminMessage(error instanceof Error ? error.message : 'Could not create vacancy.') }
  }

  const downloadFile = (filename: string, content: BlobPart, type: string) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.style.display = 'none'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
  useLayoutEffect(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const exportButton = buttons.find((button) => button.textContent?.includes('Export applications')) as HTMLButtonElement | undefined
    const reportButton = buttons.find((button) => button.textContent?.includes('Download report')) as HTMLButtonElement | undefined
    if (exportButton) exportButton.onclick = async () => {
      const XLSX = await import('xlsx-js-style')
      const applications = [...records].sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
      const headers = ['Application Reference', 'Applicant Name', 'Position', 'Faculty', 'Qualification', 'Experience (Years)', 'Submitted At', 'Status', 'CV File', 'Cover Letter', 'Status History']
      const rows = applications.map((application) => [application.id, application.name, application.role, application.faculty, application.qualification ?? '', application.experience ?? '', new Date(application.submittedAt).toLocaleString(), application.status, application.cvFileName ?? '', application.coverLetter ?? '', application.statusHistory.map((history) => `${history.status} (${new Date(history.changedAt).toLocaleString()})`).join(' | ')])
      const workbook = XLSX.utils.book_new()
      const applicationSheet = XLSX.utils.aoa_to_sheet([['UNIFLOW RECRUITMENT OFFICE'], ['APPLICATION EXPORT'], [`Generated: ${new Date().toLocaleString()}`], [], headers, ...rows])
      const summarySheet = XLSX.utils.aoa_to_sheet([['UNIFLOW RECRUITMENT OFFICE'], ['RECRUITMENT SUMMARY'], [`Generated: ${new Date().toLocaleString()}`], [], ['Metric', 'Count'], ['Total applications', applications.length], ['Submitted', applications.filter((application) => application.status === 'Submitted').length], ['Under review', applications.filter((application) => application.status === 'Under review').length], ['Shortlisted', applications.filter((application) => application.status === 'Shortlisted').length], ['Hired', applications.filter((application) => application.status === 'Hired').length], ['Rejected', applications.filter((application) => application.status === 'Rejected').length], ['Active vacancies', adminVacancies.length]])
      const headerRow = 4
      const applicationRange = XLSX.utils.decode_range(applicationSheet['!ref'] ?? 'A1:K1')
      applicationSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } }]
      applicationSheet['!cols'] = [22, 23, 32, 25, 28, 18, 22, 17, 28, 55, 42].map((wch) => ({ wch }))
      applicationSheet['!autofilter'] = { ref: `A${headerRow + 1}:K${applicationRange.e.r + 1}` }
      applicationSheet['!freeze'] = { xSplit: 0, ySplit: headerRow + 1, topLeftCell: `A${headerRow + 2}`, activePane: 'bottomRight', state: 'frozen' }
      const summaryRange = XLSX.utils.decode_range(summarySheet['!ref'] ?? 'A1:B1')
      summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }]
      summarySheet['!cols'] = [{ wch: 28 }, { wch: 16 }]
      const titleStyle = { fill: { fgColor: { rgb: '28332F' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 18 }, alignment: { vertical: 'center' } }
      const subtitleStyle = { fill: { fgColor: { rgb: 'D87362' } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 12 } }
      const generatedStyle = { fill: { fgColor: { rgb: 'F3F1EB' } }, font: { color: { rgb: '657067' }, italic: true, sz: 10 } }
      const tableHeaderStyle = { fill: { fgColor: { rgb: '36433A' } }, font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { wrapText: true, vertical: 'center' } }
      ;['A1', 'A2', 'A3'].forEach((cell, index) => { applicationSheet[cell].s = [titleStyle, subtitleStyle, generatedStyle][index] })
      ;['A1', 'A2', 'A3'].forEach((cell, index) => { summarySheet[cell].s = [titleStyle, subtitleStyle, generatedStyle][index] })
      for (let column = 0; column <= 10; column += 1) applicationSheet[XLSX.utils.encode_cell({ r: headerRow, c: column })].s = tableHeaderStyle
      summarySheet['A5'].s = tableHeaderStyle; summarySheet['B5'].s = tableHeaderStyle
      for (let row = headerRow + 1; row <= applicationRange.e.r; row += 1) { for (let column = 0; column <= 10; column += 1) { const cell = applicationSheet[XLSX.utils.encode_cell({ r: row, c: column })]; cell.s = { fill: { fgColor: { rgb: row % 2 ? 'FFFFFF' : 'F8F6F0' } }, alignment: { vertical: 'top', wrapText: column === 9 || column === 10 } } } }
      for (let row = 5; row <= summaryRange.e.r; row += 1) { summarySheet[`A${row + 1}`].s = { fill: { fgColor: { rgb: row % 2 ? 'FFFFFF' : 'F8F6F0' } }, font: { bold: row === 5, color: { rgb: '354039' } } }; summarySheet[`B${row + 1}`].s = summarySheet[`A${row + 1}`].s }
      XLSX.utils.book_append_sheet(workbook, applicationSheet, 'Applications')
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
      downloadFile('uniflow-applications.xlsx', XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    }
    if (reportButton) reportButton.onclick = () => { const report = ['E-RECRUITMENT SYSTEM FOR UNIVERSITY', '', 'Recruitment summary', `Generated: ${new Date().toLocaleString()}`, '', `Total applications,${records.length}`, `Submitted,${records.filter((application) => application.status === 'Submitted').length}`, `Under review,${underReviewCount}`, `Shortlisted,${shortlistedCount}`, `Active vacancies,${adminVacancies.length}`].join('\n'); downloadFile('recruitment-report.csv', report, 'text/csv;charset=utf-8') }
    return () => { if (exportButton) exportButton.onclick = null; if (reportButton) reportButton.onclick = null }
  }, [activeNav, records, adminVacancies, underReviewCount, shortlistedCount])
  useLayoutEffect(() => { const card = document.querySelector('.report-grid article'); if (!card) return; const value = card.querySelector('strong'); const trend = card.querySelector('p'); if (value) value.textContent = String(thisMonthApplications); if (trend) { trend.className = monthlyChange === null ? 'trend neutral' : monthlyChange >= 0 ? 'trend up' : 'trend down'; trend.textContent = monthlyChange === null ? 'No previous-month data' : `${monthlyChange >= 0 ? '↗' : '↘'} ${Math.abs(monthlyChange)}% vs last month` } }, [activeNav, thisMonthApplications, monthlyChange])

  const verifyNin = async () => {
    setNinState('loading')
    try {
      const result = await fetch(`${apiUrl}/v1/auth/verify-nin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ nin: ninValue }) })
      if (!result.ok) throw new Error((await result.json()).message)
      const identity = await result.json() as VerifiedIdentity; setVerifiedIdentity(identity); setNinState('verified'); setPortalMessage(''); setVacancies(await fetch(`${apiUrl}/v1/vacancies`).then((response) => response.json()))
    } catch (error) { setNinState('error'); setPortalMessage(error instanceof Error ? error.message : 'NIN verification failed.') }
  }

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPortalMessage('')
    const form = new FormData(event.currentTarget)
    try { const response = await fetch(`${apiUrl}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) }); const result = await response.json(); if (!response.ok) throw new Error(response.status === 401 ? 'Email or password is incorrect. New applicants should select Create an account first.' : result.message); setAuthToken(result.token); setSignedIn(true); const applicationsResponse = await fetch(`${apiUrl}/v1/applications/me`, { headers: { Authorization: `Bearer ${result.token}` } }); const applicationsResult = await applicationsResponse.json() as ApiApplication[]; const existing = applicationsResult[0]; if (existing) { setSubmittedApplication(existing); setApplicationReference(existing.reference); setApplicationSubmitted(true) } } catch (error) { setPortalMessage(error instanceof Error ? error.message : 'Sign in failed.') }
  }

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget); const file = form.get('cv') as File
    if (!file || !file.size) { setPortalMessage('Please attach your CV before submitting.'); return }
    const cvData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
    try { const response = await fetch(`${apiUrl}/v1/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ vacancyId: form.get('vacancyId'), qualification: form.get('qualification'), experience: form.get('experience'), coverLetter: form.get('coverLetter'), cvFileName: file.name, cvData }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); const vacancy = vacancies.find((item) => item.id === form.get('vacancyId')); setSubmittedApplication({ ...result, vacancy: vacancy?.title }); setApplicationReference(result.reference); setApplicationSubmitted(true); setPortalMessage('') } catch (error) { setPortalMessage(error instanceof Error ? error.message : 'Application submission failed.') }
  }

  const createAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (form.get('password') !== form.get('confirmPassword')) { setPortalMessage('Passwords do not match.'); return }
    try { const response = await fetch(`${apiUrl}/v1/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: form.get('fullName'), email: form.get('email'), password: form.get('password') }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setShowRegistration(false); setAccountMessage('Account created. Sign in to continue.'); setPortalMessage('') } catch (error) { setPortalMessage(error instanceof Error ? error.message : 'Account creation failed.') }
  }

  if (activeNav === 'Recruitment Support') return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div><div className="workspace-label">RECRUITMENT OFFICE</div><nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => <button className={activeNav === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => setActiveNav(item.label)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="nav-divider" /><button className="nav-item muted" onClick={() => setActiveNav('Settings')}><span>⚙</span>Settings</button></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Recruitment office</span><i>/</i><strong>Recruitment Support</strong></div><div className="profile"><span className="avatar avatar-admin">AO</span><span><strong>Admin Office</strong><small>Super administrator</small></span></div></header><div className="content-wrap"><section className="page-panel panel support-page"><div className="page-panel-heading"><div><p className="eyebrow">APPLICANT SERVICES</p><h1>Recruitment Support</h1><p className="subtitle">Live requests submitted by applicants through the portal.</p></div><span className="support-status"><i /> {supportRequests.length} open request{supportRequests.length === 1 ? '' : 's'}</span></div>{supportRequests.length === 0 ? <div className="empty-state">No applicant support requests yet.</div> : <div className="support-inbox">{supportRequests.map((request) => <article className="support-request" key={request.id}><div className="support-request-top"><div><strong>{request.subject}</strong><span>{request.name} · {request.email}</span></div><time>{new Date(request.createdAt).toLocaleString()}</time></div><p>{request.message}</p><b className="support-request-status">{request.status}</b></article>)}</div>}</section><footer className="footer"><span>UniFlow recruitment office</span><span><i className="status-light" />Live data</span><span>Help centre ↗</span></footer></div></main></div>

  if (activeNav === 'Applicant portal') {
    return (
      <div className="app-shell applicant-layout">
        <header className="applicant-header">
          <div className="applicant-brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div>
          <div className="applicant-header-actions">{signedIn && <><span className="portal-context">Applicant workspace</span><span className="secure-label">● Secure session</span><button className="header-action" onClick={() => { setSignedIn(false); setAuthToken(''); setNinState('idle'); setVerifiedIdentity(null); setApplicationSubmitted(false); setSubmittedApplication(null); setShowApplicationStatus(false) }}>Sign out</button></>}<button className="close-button" onClick={() => window.location.assign('/admin')} aria-label="Back to admin office">✕</button></div>
        </header>
        <main className="applicant-main">
          <div className={signedIn ? 'applicant-card applicant-workspace' : 'applicant-card'}>
            {!signedIn ? <>
            {!showRegistration ? <>
              <div className="card-section">
                <p className="eyebrow">APPLICATION PORTAL</p>
                <h1>Welcome back, applicant.</h1>
                <p className="subtitle">Sign in to view or submit your application.</p>
              </div>
              {accountMessage && <p className="account-message">{accountMessage}</p>}
              {portalMessage && <p className="error-message">{portalMessage}</p>}
              <form className="login-form" onSubmit={signIn}>
                <label>Email address<input name="email" type="email" placeholder="you@university.edu" required /></label>
                <label>Password<input name="password" type="password" placeholder="••••••••" required /></label>
                <button type="submit" className="primary-button">Sign in</button>
              </form>
              <div className="footer-text">
                <p><strong>New here?</strong> <button type="button" className="text-link" onClick={() => { setShowRegistration(true); setAccountMessage('') }}>Create an account</button></p>
                <p><small>Your application data is encrypted and secure.</small></p>
              </div>
            </> : <>
              <div className="card-section">
                <p className="eyebrow">APPLICATION PORTAL</p>
                <h1>Create your account.</h1>
                <p className="subtitle">Register to apply for university vacancies.</p>
              </div>
              {portalMessage && <p className="error-message">{portalMessage}</p>}
              <form className="login-form" onSubmit={createAccount}>
                <label>Full name<input name="fullName" type="text" placeholder="Your full name" required /></label>
                <label>Email address<input name="email" type="email" placeholder="you@university.edu" required /></label>
                <label>Password<input name="password" type="password" placeholder="Create a password" minLength={8} required /></label>
                <label>Confirm password<input name="confirmPassword" type="password" placeholder="Repeat your password" minLength={8} required /></label>
                <button type="submit" className="primary-button">Create account</button>
              </form>
              <div className="footer-text"><p>Already registered? <button type="button" className="text-link" onClick={() => setShowRegistration(false)}>Back to sign in</button></p></div>
            </>}
            </> : <>
            <div className="profile-progress"><span className="complete">1</span><i /><span className={ninState === 'verified' ? 'complete' : ''}>2</span><i /><span className={applicationSubmitted ? 'complete' : ''}>3</span></div>
            <div className="card-section profile-heading">
              <p className="eyebrow">APPLICATION PROFILE</p>
              <h1>Complete your profile.</h1>
              <p className="subtitle">Verify your identity, then submit a complete application.</p>
            </div>
            <div className="nin-section">
              <div className="section-heading"><span className="step-label">STEP 1 OF 3</span><p className="section-title">Identity verification</p><p className="section-hint">Your NIN is used to securely retrieve your official identity details.</p></div>
              <label>National Identification Number<input type="text" value={ninValue} onChange={(event) => setNinValue(event.target.value)} placeholder="12345678901" maxLength={11} /></label>
              <button type="button" className="outline-button" onClick={verifyNin}>{ninState === 'loading' ? 'Checking...' : ninState === 'verified' ? '✓ NIN verified' : 'Verify NIN'}</button>
              {ninState === 'verified' && <><p className="success-message">✓ Identity match confirmed. Your profile is ready.</p><button type="button" className="continue-button" onClick={() => applicationSubmitted ? setShowApplicationStatus(true) : setApplicationStarted(true)}>{applicationSubmitted ? 'View application status' : 'Continue to application'} <span>→</span></button></>}
              {ninState === 'error' && <p className="error-message">NIN could not be verified. Check the number and try again.</p>}
            </div>
            {ninState === 'verified' && verifiedIdentity && <div className="verified-profile"><div><span className="avatar avatar-profile">{verifiedIdentity.firstName[0]}{verifiedIdentity.lastName[0]}</span><span><strong>{verifiedIdentity.firstName} {verifiedIdentity.lastName}</strong><small>Verified applicant identity</small></span></div><span className="verified-badge">Verified</span></div>}
            {ninState === 'verified' && applicationStarted && !applicationSubmitted && <form className="application-form" onSubmit={submitApplication}>
              <div className="form-heading"><span className="step-label">STEP 3 OF 3</span><p className="eyebrow">APPLICATION DETAILS</p><h2>Complete your application</h2><p className="subtitle">Select a position, provide your experience, and upload your CV.</p></div>
              {portalMessage && <p className="error-message">{portalMessage}</p>}
              <label>Vacancy<select name="vacancyId" defaultValue="" required><option value="" disabled>Select a vacancy</option>{vacancies.map((vacancy) => <option key={vacancy.id} value={vacancy.id}>{vacancy.title} · {vacancy.faculty}</option>)}</select></label>
              <label>Highest qualification<input name="qualification" type="text" placeholder="e.g. PhD in Computer Science" required /></label>
              <label>Years of relevant experience<input name="experience" type="number" min="0" max="60" placeholder="e.g. 5" required /></label>
              <label>Cover letter<textarea name="coverLetter" rows={4} placeholder="Tell us why you are suitable for this role." required /></label>
              <label>Curriculum Vitae (PDF or DOCX)<input name="cv" type="file" accept=".pdf,.doc,.docx" required /></label>
              <button type="submit" className="primary-button">Submit application</button>
            </form>}
            {applicationSubmitted && !showApplicationStatus && <div className="application-success">
              <p className="eyebrow">APPLICATION SUBMITTED</p><h2>Your application is on its way.</h2><p>Keep this reference number for status tracking:</p><strong>{applicationReference}</strong><button type="button" className="primary-button" onClick={() => setShowApplicationStatus(true)}>View application status</button><button type="button" className="outline-button" onClick={() => setApplicationSubmitted(false)}>Submit another application</button>
            </div>}
            {applicationSubmitted && showApplicationStatus && <div className="status-view">
              <div className="status-view-heading"><div><p className="eyebrow">APPLICATION STATUS</p><h2>Track your application.</h2><p className="subtitle">Reference: {applicationReference}</p></div><span className="status-pill">{submittedApplication?.status ?? 'Submitted'}</span></div>
              <div className="application-summary"><span><small>POSITION</small><strong>{submittedApplication?.vacancy ?? 'Application'}</strong></span><span><small>SUBMITTED</small><strong>{submittedApplication ? new Date(submittedApplication.submittedAt).toLocaleDateString() : 'Today'}</strong></span><span><small>STATUS</small><strong>{submittedApplication?.status ?? 'Submitted'}</strong></span></div>
              <div className="status-timeline"><div className="current"><span>✓</span><p><strong>Application submitted</strong><small>Your application was received by the recruitment office.</small></p><time>{submittedApplication ? new Date(submittedApplication.submittedAt).toLocaleDateString() : 'Today'}</time></div><div className={submittedApplication?.status === 'Under review' ? 'current' : ''}><span>2</span><p><strong>Under review</strong><small>The recruitment team will review your qualifications.</small></p></div><div className={submittedApplication?.status === 'Shortlisted' || submittedApplication?.status === 'Hired' ? 'current' : ''}><span>3</span><p><strong>Decision</strong><small>You will be notified when a decision is available.</small></p></div></div>
              <button type="button" className="outline-button" onClick={() => setShowApplicationStatus(false)}>Back to application</button>
            </div>}
            </>}
          </div>
          <footer className="applicant-footer">
            <div className="applicant-footer-main"><div className="applicant-footer-brand"><span className="brand-mark">U</span><span><strong>E-RECRUITMENT SYSTEM</strong><small>University recruitment portal</small></span></div><p>Connecting talented people with meaningful opportunities to serve and grow.</p><span className="footer-status"><i /> Systems operational</span></div>
            <div className="applicant-footer-links"><div><strong>Applicant services</strong><button type="button" onClick={() => signedIn && applicationSubmitted ? setShowApplicationStatus(true) : setPortalMessage('Sign in and submit an application to track its status.')}>Track application</button><button type="button" onClick={() => signedIn && ninState === 'verified' ? setApplicationStarted(true) : setPortalMessage('Sign in and verify your NIN to apply for a position.')}>Apply for a position</button></div><div><strong>Help & information</strong><button type="button" onClick={() => setFooterPanel('privacy')}>Privacy policy</button><button type="button" onClick={() => setFooterPanel('terms')}>Terms of use</button><button type="button" onClick={() => setSupportOpen(true)}>Contact support</button></div><div><strong>Recruitment office</strong><span>Mon - Fri, 8:00 - 16:00</span><button type="button" onClick={() => setSupportOpen(true)}>recruitment@university.edu</button></div></div>
            <div className="applicant-footer-bottom"><span>© 2026 University Recruitment Office</span><span>Secure applicant workspace <i /></span><span>Version 1.0.0</span></div>
            {footerInfoModal}
            {supportModal}
          </footer>
        </main>
      </div>
    )
  }

  if (!adminSignedIn) return <div className="app-shell applicant-layout"><header className="applicant-header"><div className="applicant-brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div></header><main className="applicant-main"><div className="applicant-card"><div className="card-section"><p className="eyebrow">RECRUITMENT OFFICE</p><h1>Admin sign in.</h1><p className="subtitle">Access applications, vacancies, reports, and recruitment activity.</p></div>{adminMessage && <p className="error-message">{adminMessage}</p>}<form className="login-form" onSubmit={adminLogin}><label>Email address<input name="email" type="email" placeholder="admin@university.edu" required /></label><label>Password<input name="password" type="password" placeholder="••••••••" required /></label><button type="submit" className="primary-button">Sign in to office</button></form></div></main></div>

  if (activeNav === 'Vacancies') return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div><div className="workspace-label">RECRUITMENT OFFICE</div><nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => <button className={activeNav === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => item.label === 'Applicant portal' ? window.location.assign('/applicant') : setActiveNav(item.label)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="nav-divider" /><button className="nav-item muted" onClick={() => setActiveNav('Settings')}><span>⚙</span>Settings</button></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Recruitment office</span><i>/</i><strong>Vacancies</strong></div><div className="profile"><span className="avatar avatar-admin">AO</span><span><strong>Admin Office</strong><small>Super administrator</small></span></div></header><div className="content-wrap"><section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">OPEN POSITIONS</p><h1>Vacancies</h1><p className="subtitle">Create and manage the roles applicants can apply for.</p></div><button className="primary-button" onClick={() => setShowVacancyForm(true)}>＋ Post a vacancy</button></div>{adminMessage && <p className="error-message">{adminMessage}</p>}{showVacancyForm && <form className="vacancy-form" onSubmit={createVacancy}><label>Position title<input name="title" required placeholder="e.g. Senior Lecturer, Biology" /></label><label>Faculty<input name="faculty" required placeholder="e.g. Faculty of Science" /></label><label>Description<textarea name="description" rows={3} required placeholder="Describe the role and responsibilities." /></label><label>Closing date<input name="closingDate" type="date" required /></label><div><button className="primary-button" type="submit">Publish vacancy</button><button className="outline-button light-outline" type="button" onClick={() => setShowVacancyForm(false)}>Cancel</button></div></form>}<div className="vacancy-grid">{adminVacancies.map((vacancy) => <article key={vacancy.id}><span className="vacancy-status open">● {vacancy.status}</span><h2>{vacancy.title}</h2><p>{vacancy.faculty} · Open position</p><footer><strong>{records.filter((application) => application.role === vacancy.title).length} applications</strong><span>Closes {new Date(vacancy.closingDate).toLocaleDateString()}</span></footer></article>)}</div>{adminVacancies.length === 0 && <div className="empty-state">No vacancies published yet.</div>}</section><footer className="footer"><span>UniFlow recruitment office</span><span><i className="status-light" />Live data</span><span>{adminVacancies.length} vacancies</span></footer></div></main></div>

  if (activeNav === 'Recent activity') return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div><div className="workspace-label">RECRUITMENT OFFICE</div><nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => <button className={activeNav === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => item.label === 'Applicant portal' ? window.location.assign('/applicant') : setActiveNav(item.label)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="nav-divider" /><button className="nav-item muted" onClick={() => setActiveNav('Settings')}><span>⚙</span>Settings</button></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Recruitment office</span><i>/</i><strong>Recent activity</strong></div><div className="profile"><span className="avatar avatar-admin">AO</span><span><strong>Admin Office</strong><small>Super administrator</small></span></div></header><div className="content-wrap"><section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h1>Recent activity</h1><p className="subtitle">Live events from applications and review decisions.</p></div></div>{activityLoading ? <div className="empty-state">Loading activity...</div> : adminActivity.length === 0 ? <div className="empty-state">No activity recorded yet.</div> : <div className="full-activity">{adminActivity.map((activity) => <div key={activity.id}><span className={`activity-icon ${activity.status === 'Submitted' ? 'peach' : activity.status === 'Rejected' ? 'gold' : 'green'}`}>{activity.status === 'Submitted' ? '↗' : activity.status === 'Rejected' ? '!' : '✓'}</span><p><strong>{activity.type}</strong><small>{activity.applicant} · {activity.vacancy}</small></p><time>{new Date(activity.changedAt).toLocaleString()}</time></div>)}</div>}</section><footer className="footer"><span>UniFlow recruitment office</span><span><i className="status-light" />Live data</span><span>{adminActivity.length} events</span></footer></div></main></div>

  const pageContent = activeNav === 'Application queue' ? <section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">RECRUITMENT WORKFLOW</p><h1>Application queue</h1><p className="subtitle">Review, filter, and update every submitted application.</p></div><button className="primary-button">Export applications ↗</button></div><div className="queue-tools page-tools"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, role or ID" /></div><div className="filter-tabs">{(['All', 'Submitted', 'Under review', 'Shortlisted'] as const).map((item) => <button className={filter === item ? 'filter-tab selected' : 'filter-tab'} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="table-wrap"><table><thead><tr><th>APPLICANT</th><th>POSITION</th><th>SUBMITTED</th><th>STATUS</th><th /></tr></thead><tbody>{visibleApplications.map((application) => <tr key={application.id}><td><div className="applicant"><span className="avatar" style={{ background: application.color }}>{application.initials}</span><span><strong>{application.name}</strong><small>{application.id}</small></span></div></td><td><strong className="role">{application.role}</strong><small>{application.faculty}</small></td><td className="date-cell">{application.date}</td><td><select className={`status status-${application.status.replace(' ', '-').toLowerCase()}`} value={application.status} onChange={(event) => updateStatus(application.id, event.target.value as Status)}><option>Submitted</option><option>Under review</option><option>Shortlisted</option><option>Hired</option><option>Rejected</option></select></td><td><button className="more-button">•••</button></td></tr>)}</tbody></table></div></section> : activeNav === 'Vacancies' ? <section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">OPEN POSITIONS</p><h1>Vacancies</h1><p className="subtitle">Create and manage the roles applicants can apply for.</p></div><button className="primary-button">＋ Post a vacancy</button></div><div className="vacancy-grid"><article><span className="vacancy-status open">● Open</span><h2>Senior Lecturer, Computer Science</h2><p>Faculty of Computing · Academic staff</p><footer><strong>42 applications</strong><span>Closes 28 Jun 2024</span></footer></article><article><span className="vacancy-status open">● Open</span><h2>Lecturer II, Economics</h2><p>Faculty of Social Sciences · Academic staff</p><footer><strong>31 applications</strong><span>Closes 30 Jun 2024</span></footer></article><article><span className="vacancy-status closing">● Closing soon</span><h2>Laboratory Technologist</h2><p>Faculty of Health Sciences · Technical staff</p><footer><strong>18 applications</strong><span>Closes 27 Jun 2024</span></footer></article></div></section> : activeNav === 'Reports' ? <section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">INSIGHTS & EXPORTS</p><h1>Reports</h1><p className="subtitle">Understand application volume and recruitment progress.</p></div><button className="primary-button">Download report ↗</button></div><div className="report-grid"><article><span>APPLICATIONS THIS MONTH</span><strong>248</strong><p className="trend up">↗ 18.4% vs last month</p></article><article><span>AVERAGE REVIEW TIME</span><strong>3.2 days</strong><p className="trend neutral">↓ 0.8 days improvement</p></article><article><span>SHORTLIST RATE</span><strong>12.9%</strong><p className="trend up">↗ 2.4% vs last month</p></article></div><div className="report-chart"><div className="panel-header"><div><h2>Applications by faculty</h2><p>June 2024</p></div></div><div className="bar-chart"><i style={{ height: '72%' }}><b>Computing</b></i><i style={{ height: '54%' }}><b>Social Sciences</b></i><i style={{ height: '39%' }}><b>Health Sciences</b></i><i style={{ height: '29%' }}><b>Law</b></i><i style={{ height: '48%' }}><b>Environmental</b></i></div></div></section> : activeNav === 'Recent activity' ? <section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h1>Recent activity</h1><p className="subtitle">A timeline of the latest updates from your recruitment team.</p></div><button className="outline-button">Filter activity</button></div><div className="full-activity"><div><span className="activity-icon peach">↗</span><p><strong>New application received</strong><small>Amina Musa applied for Senior Lecturer, Computer Science</small></p><time>Today, 09:42</time></div><div><span className="activity-icon green">✓</span><p><strong>Application shortlisted</strong><small>Fatima Nuhu moved to shortlisted by Admin Office</small></p><time>Yesterday, 16:08</time></div><div><span className="activity-icon gold">⌁</span><p><strong>Vacancy closing soon</strong><small>Lecturer II, Economics has 3 days remaining</small></p><time>Yesterday, 14:31</time></div><div><span className="activity-icon peach">↗</span><p><strong>New vacancy published</strong><small>Laboratory Technologist is now open for applications</small></p><time>18 Jun, 11:22</time></div></div></section> : <section className="page-panel panel"><div className="page-panel-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>Settings</h1><p className="subtitle">Manage your recruitment office preferences and integrations.</p></div><button className="primary-button">Save changes</button></div><div className="settings-list"><label>Office display name<input defaultValue="University Recruitment Office" /></label><label>Notification email<input defaultValue="recruitment@university.edu" /></label><label>Application reference prefix<input defaultValue="UFR" /></label><div className="setting-toggle"><span><strong>Simulated email notifications</strong><small>Log notification events while email delivery is in development.</small></span><input type="checkbox" defaultChecked /></div><div className="setting-toggle"><span><strong>Require NIN verification</strong><small>Applicants must pass identity verification before submission.</small></span><input type="checkbox" defaultChecked /></div></div></section>

  if (activeNav !== 'Overview') {
    return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div><div className="workspace-label">RECRUITMENT OFFICE</div><nav className="main-nav" aria-label="Main navigation">{navItems.map((item) => <button className={activeNav === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => item.label === 'Applicant portal' ? window.location.assign('/applicant') : setActiveNav(item.label)}><span>{item.icon}</span>{item.label}{item.label === 'Application queue' && <b>12</b>}</button>)}</nav><div className="nav-divider" /><button className="nav-item muted" onClick={() => setActiveNav('Settings')}><span>⚙</span>Settings</button><div className="sidebar-bottom"><div className="support-orbit">?</div><p><strong>Need a hand?</strong><br />Read the admin guide</p><button className="arrow-button">↗</button></div></aside><main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Recruitment office</span><i>/</i><strong>{activeNav}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button><div className="profile"><span className="avatar avatar-admin">AO</span><span><strong>Admin Office</strong><small>Super administrator</small></span><span className="chevron">⌄</span></div></div></header><div className="content-wrap">{pageContent}{cvModal}{applicationDetailsModal}<footer className="footer"><span>© 2024 University Recruitment Office</span><span><i className="status-light" />All systems operational</span><span>Help centre ↗</span></footer></div></main></div>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">U</span><span>UNI<span className="brand-light">FLOW</span></span></div>
        <div className="workspace-label">RECRUITMENT OFFICE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => <button className={activeNav === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => item.label === 'Applicant portal' ? window.location.assign('/applicant') : setActiveNav(item.label)}><span>{item.icon}</span>{item.label}{item.label === 'Application queue' && <b>12</b>}</button>)}
        </nav>
        <div className="nav-divider" />
        <button className="nav-item muted" onClick={() => setActiveNav('Settings')}><span>⚙</span>Settings</button>
        <div className="sidebar-bottom"><div className="support-orbit">?</div><p><strong>Need a hand?</strong><br />Read the admin guide</p><button className="arrow-button" aria-label="Open admin guide">↗</button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>Recruitment office</span><i>/</i><strong>{activeNav}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button><div className="profile"><span className="avatar avatar-admin">AO</span><span><strong>Admin Office</strong><small>Super administrator</small></span><span className="chevron">⌄</span></div></div></header>

        <div className="content-wrap">
          <section className="page-intro"><div><p className="eyebrow">RECRUITMENT WORKSPACE</p><h1>Good morning, Admin.</h1><p className="subtitle">Live applications and vacancies from your recruitment office.</p></div><button className="primary-button" onClick={() => setActiveNav('Vacancies')}><span>＋</span> Post a vacancy</button></section>

          <section className="metrics-grid" aria-label="Recruitment summary"><article className="metric-card featured"><div className="metric-head"><span className="metric-icon">□</span><span className="metric-label">TOTAL APPLICATIONS</span><span className="metric-period">Live</span></div><strong>{records.length}</strong><div className="trend neutral">Persisted applications</div><div className="sparkline"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></article><article className="metric-card"><div className="metric-head"><span className="metric-icon green">◷</span><span className="metric-label">UNDER REVIEW</span></div><strong>{underReviewCount}</strong><div className="trend neutral">Current queue</div><div className="progress"><span style={{ width: `${records.length ? underReviewCount / records.length * 100 : 0}%` }} /></div></article><article className="metric-card"><div className="metric-head"><span className="metric-icon gold">✦</span><span className="metric-label">SHORTLISTED</span></div><strong>{shortlistedCount}</strong><div className="trend neutral">Current queue</div><div className="progress gold-progress"><span style={{ width: `${records.length ? shortlistedCount / records.length * 100 : 0}%` }} /></div></article><article className="metric-card"><div className="metric-head"><span className="metric-icon blue">♧</span><span className="metric-label">ACTIVE VACANCIES</span></div><strong>{adminVacancies.length}</strong><div className="trend neutral">Available to applicants</div><div className="vacancy-dots">{adminVacancies.map((vacancy) => <i key={vacancy.id} />)}</div></article></section>

          <section className="dashboard-grid"><div className="queue-panel panel"><div className="panel-header"><div><h2>Application queue</h2><p>Review and manage recent applications</p></div><button className="text-button" onClick={() => setActiveNav('Application queue')}>View all <span>→</span></button></div><div className="queue-tools"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, role or ID" /></div><div className="filter-tabs">{(['All', 'Submitted', 'Under review', 'Shortlisted'] as const).map((item) => <button className={filter === item ? 'filter-tab selected' : 'filter-tab'} key={item} onClick={() => setFilter(item)}>{item}{item === 'All' && <em>12</em>}</button>)}</div></div><div className="table-wrap"><table><thead><tr><th>APPLICANT</th><th>POSITION</th><th>SUBMITTED</th><th>STATUS</th><th aria-label="Actions" /></tr></thead><tbody>{visibleApplications.map((application) => <tr key={application.id}><td><div className="applicant"><span className="avatar" style={{ background: application.color }}>{application.initials}</span><span><strong>{application.name}</strong><small>{application.id}</small></span></div></td><td><strong className="role">{application.role}</strong><small>{application.faculty}</small></td><td className="date-cell">{application.date}</td><td><select className={`status status-${application.status.replace(' ', '-').toLowerCase()}`} value={application.status} onChange={(event) => updateStatus(application.id, event.target.value as Status)} aria-label={`Status for ${application.name}`}><option>Submitted</option><option>Under review</option><option>Shortlisted</option><option>Hired</option><option>Rejected</option></select></td><td><button className="more-button" aria-label={`More actions for ${application.name}`}>•••</button></td></tr>)}</tbody></table>{visibleApplications.length === 0 && <div className="empty-state">No applications match this search.</div>}</div></div>
          <aside className="side-column"><div className="nin-card panel"><div className="card-kicker"><span className="pulse" /> NIN VALIDATION</div><h2>Identity verification,<br /><em>ready when you are.</em></h2><p>Applicant identity checks are handled securely before applications reach your desk.</p><div className="card-decoration"><span>◎</span></div></div><div className="activity-card panel"><div className="panel-header"><div><h2>Recent activity</h2><p>Live events from the recruitment system</p></div></div>{records.length === 0 ? <div className="empty-state">No recruitment activity yet.</div> : <div className="activity-list">{records.slice(0, 3).map((application) => <div key={application.id}><span className="activity-icon peach">↗</span><p><strong>Application received</strong><small>{application.name} applied for {application.role}</small></p><time>{application.date}</time></div>)}</div>}<button className="activity-footer" onClick={() => setActiveNav('Recent activity')}>See all activity <span>→</span></button></div></aside></section>

          {cvModal}
          {applicationDetailsModal}
          <footer className="footer"><span>© 2024 University Recruitment Office</span><span><i className="status-light" />All systems operational</span><span>Help centre ↗</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
