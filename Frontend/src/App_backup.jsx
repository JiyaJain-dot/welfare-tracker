import { useState } from 'react'
import './App.css'

const API_BASE = 'https://welfare-tracker-three.vercel.app/api/v1'

function App() {
  const [trackingId, setTrackingId] = useState('WLF-WJ7U7NCR')
  const [application, setApplication] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchApplication = async () => {
    const id = trackingId.trim()

    if (!id) {
      setError('Please enter a tracking ID.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const [trackerResponse, notificationResponse] =
        await Promise.all([
          fetch(`${API_BASE}/tracker/${id}`),
          fetch(`${API_BASE}/notifications/${id}`),
        ])

      if (!trackerResponse.ok) {
        throw new Error('Application not found.')
      }

      const trackerResult = await trackerResponse.json()
      const notificationResult =
        await notificationResponse.json()

      setApplication(trackerResult.data)
      setNotifications(notificationResult.data || [])
    } catch (err) {
      setApplication(null)
      setNotifications([])

      setError(
        err.message === 'Application not found.'
          ? 'Application not found. Please check your Tracking ID.'
          : 'Unable to fetch application details. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const getStageLabel = (stage) => {
    const labels = {
      submitted: 'Submitted',
      verification: 'Verification',
      review: 'Under Review',
      approved: 'Approved',
      rejected: 'Rejected',
      disbursement: 'Benefit Disbursement',
    }

    return labels[stage?.toLowerCase()] || stage
  }

  const workflowStages = [
    'submitted',
    'verification',
    'review',
    'approved',
    'disbursement',
  ]

  const getProgress = () => {
    if (!application) return 0

    const currentStage =
      application.currentStage?.toLowerCase()

    const currentIndex =
      workflowStages.indexOf(currentStage)

    if (currentIndex === -1) return 20

    return Math.min(
      Math.round(
        ((currentIndex + 1) / workflowStages.length) * 100
      ),
      100
    )
  }

  const formatDateTime = (date) => {
    if (!date) return ''

    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /* =========================
     NAVIGATION
  ========================= */

  const goToApplication = () => {
    document
      .querySelector('.tracking-search')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }

  const goToNotifications = () => {
    document
      .querySelector('.notifications-panel')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }

  const goToHelp = () => {
    const helpSection =
      document.getElementById('help-support')

    if (helpSection) {
      helpSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <div className="dashboard">

      {/* =========================
          HEADER
      ========================= */}

      <header className="top-header">

        <div className="brand">

          <div className="emblem">
            🇮🇳
          </div>

          <div>
            <h1>Welfare Tracker</h1>

            <p>
              Government Welfare Scheme Monitoring System
            </p>
          </div>

        </div>

        <div className="client-info">

          <span className="status-dot"></span>

          <div>
            <strong>CITIZEN PORTAL</strong>

            <small>
              Application Tracking
            </small>
          </div>

          <div className="profile">
            CT
          </div>

        </div>

      </header>

      {/* =========================
          NAVIGATION
      ========================= */}

      <nav className="navbar">

        <div
          className="nav-item active"
          onClick={goToApplication}
        >
          My Application
        </div>

        <div
          className="nav-item"
          onClick={goToNotifications}
        >
          Notifications
        </div>

        <div
          className="nav-item"
          onClick={goToHelp}
        >
          Help & Support
        </div>

      </nav>

      {/* =========================
          MAIN
      ========================= */}

      <main className="main-content">

        {/* =========================
            TRACKING SEARCH
        ========================= */}

        <section className="tracking-search">

          <div>

            <p className="breadcrumb">
              HOME / APPLICATION TRACKER
            </p>

            <h2>
              Track Your Application
            </h2>

            <p className="subtitle">
              Enter your Tracking ID to view the latest
              application status.
            </p>

          </div>

          <div className="search-area">

            <input
              type="text"
              value={trackingId}
              onChange={(e) =>
                setTrackingId(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchApplication()
                }
              }}
              placeholder="Enter Tracking ID"
            />

            <button
              className="track-btn"
              onClick={fetchApplication}
              disabled={loading}
            >
              {loading
                ? 'Checking...'
                : 'Track Application'}
            </button>

          </div>

        </section>

        {/* =========================
            ERROR
        ========================= */}

        {error && (
          <div className="error-message">

            <strong>
              Unable to find application
            </strong>

            <span>
              {error}
            </span>

          </div>
        )}

        {/* =========================
            APPLICATION DATA
        ========================= */}

        {application && (
          <>

            {/* PAGE HEADING */}

            <div className="page-heading">

              <div>

                <p className="breadcrumb">
                  APPLICATION DETAILS
                </p>

                <h2>
                  Application Status
                </h2>

                <p className="subtitle">
                  Track the progress of your welfare
                  scheme application
                </p>

              </div>

              <div className="tracking-box">

                <span>
                  TRACKING ID
                </span>

                <strong>
                  {application.trackingId}
                </strong>

              </div>

            </div>

            {/* APPLICANT */}

            <section className="applicant-card">

              <div className="applicant-details">

                <div className="large-avatar">

                  {application.applicantName
                    ?.split(' ')
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}

                </div>

                <div>

                  <span className="section-label">
                    APPLICANT
                  </span>

                  <h3>
                    {application.applicantName}
                  </h3>

                  <p>
                    {application.scheme}
                  </p>

                </div>

              </div>

              <div className="current-status">

                <span className="section-label">
                  CURRENT STATUS
                </span>

                <div className="status-badge">

                  <span className="status-dot"></span>

                  {getStageLabel(
                    application.currentStage
                  )}

                </div>

              </div>

            </section>

            {/* =========================
                PROGRESS
            ========================= */}

            <section className="panel progress-panel">

              <div className="panel-header">

                <div>

                  <h3>
                    Application Progress
                  </h3>

                  <p>
                    Track each stage of your application
                  </p>

                </div>

                <div className="progress-percent">
                  {getProgress()}%
                </div>

              </div>

              <div className="progress-bar">

                <div
                  className="progress-fill"
                  style={{
                    width: `${getProgress()}%`,
                  }}
                ></div>

              </div>

              {/* FIVE STAGE WORKFLOW */}

              <div className="timeline">

                {workflowStages.map(
                  (stage, index) => {

                    const currentIndex =
                      workflowStages.indexOf(
                        application.currentStage?.toLowerCase()
                      )

                    const isCompleted =
                      index < currentIndex

                    const isCurrent =
                      stage ===
                      application.currentStage?.toLowerCase()

                    const timelineData =
                      application.timeline?.find(
                        (item) =>
                          item.stage?.toLowerCase() ===
                          stage
                      )

                    return (
                      <div
                        className={`timeline-item ${
                          isCompleted
                            ? 'completed'
                            : ''
                        } ${
                          isCurrent
                            ? 'current'
                            : ''
                        }`}
                        key={stage}
                      >

                        <div className="timeline-marker">

                          {isCompleted
                            ? '✓'
                            : index + 1}

                        </div>

                        <div className="timeline-content">

                          <h4>
                            {getStageLabel(stage)}
                          </h4>

                          <p>
                            {timelineData?.note ||
                              (isCurrent
                                ? 'Current application stage'
                                : index < currentIndex
                                ? 'Stage completed'
                                : 'Awaiting completion')}
                          </p>

                          {timelineData?.changed_at && (
                            <span>
                              {formatDateTime(
                                timelineData.changed_at
                              )}
                            </span>
                          )}

                        </div>

                      </div>
                    )
                  }
                )}

              </div>

            </section>

            {/* =========================
                BOTTOM GRID
            ========================= */}

            <section className="dashboard-grid">

              {/* ACTION REQUIRED */}

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h3>
                      Action Required
                    </h3>

                    <p>
                      Important information regarding
                      your application
                    </p>

                  </div>

                </div>

                <div className="notice">

                  <div className="notice-icon">
                    !
                  </div>

                  <div>

                    <strong>
                      {application.documents?.some(
                        (doc) =>
                          doc.status === 'missing'
                      )
                        ? 'Document Required'
                        : 'No Action Required'}
                    </strong>

                    <p>
                      {application.actionRequired ||
                        'Your application is currently being processed.'}
                    </p>

                    {application.documents
                      ?.filter(
                        (doc) =>
                          doc.status === 'missing'
                      )
                      .map((doc) => (

                        <div
                          className="missing-document"
                          key={doc.doc_name}
                        >

                          <strong>
                            Missing Document
                          </strong>

                          <span>
                            {doc.doc_name}
                          </span>

                        </div>

                      ))}

                  </div>

                </div>

              </div>

              {/* =========================
                  NOTIFICATIONS
              ========================= */}

              <div
                className="panel notifications-panel"
              >

                <div className="panel-header">

                  <div>

                    <h3>
                      Recent Notifications
                    </h3>

                    <p>
                      Latest updates regarding
                      your application
                    </p>

                  </div>

                  {notifications.length > 0 && (
                    <span className="notification-count">
                      {notifications.length}
                    </span>
                  )}

                </div>

                <div className="notifications-list">

                  {notifications.length === 0 ? (

                    <div className="empty-notifications">
                      No notifications available.
                    </div>

                  ) : (

                    notifications
                      .slice(0, 5)
                      .map(
                        (notification, index) => (

                          <div
                            className="notification"
                            key={`${notification.created_at}-${index}`}
                          >

                            <div className="notification-icon">

                              {notification.type ===
                              'document_missing'
                                ? '!'
                                : '✓'}

                            </div>

                            <div>

                              <strong>
                                {notification.type ===
                                'document_missing'
                                  ? 'Document Alert'
                                  : 'Status Update'}
                              </strong>

                              <p>
                                {notification.message}
                              </p>

                              <span>
                                {formatDateTime(
                                  notification.created_at
                                )}
                              </span>

                            </div>

                          </div>

                        )
                      )

                  )}

                </div>

              </div>

            </section>

            {/* =========================
                HELP & SUPPORT
            ========================= */}

            <section
              id="help-support"
              className="panel help-panel"
            >

              <div className="panel-header">

                <div>

                  <h3>
                    Help & Support
                  </h3>

                  <p>
                    Need assistance with your welfare
                    application?
                  </p>

                </div>

              </div>

              <div className="help-content">

                <div className="help-item">

                  <div className="help-icon">
                    ?
                  </div>

                  <div>

                    <strong>
                      Need help tracking your application?
                    </strong>

                    <p>
                      Keep your Tracking ID ready when
                      contacting the welfare department
                      for assistance.
                    </p>

                  </div>

                </div>

                <div className="help-item">

                  <div className="help-icon">
                    ☎
                  </div>

                  <div>

                    <strong>
                      Citizen Support
                    </strong>

                    <p>
                      Contact your nearest District
                      Welfare Office for
                      application-related assistance.
                    </p>

                  </div>

                </div>

                <div className="help-item">

                  <div className="help-icon">
                    📄
                  </div>

                  <div>

                    <strong>
                      Document Assistance
                    </strong>

                    <p>
                      If a document is marked as missing,
                      submit the required document to
                      the concerned welfare office.
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* =========================
                LAST UPDATED
            ========================= */}

            <div className="last-updated">

              Last updated:{' '}

              {formatDateTime(
                application.lastUpdatedAt
              )}

            </div>

          </>
        )}

        {/* =========================
            INITIAL STATE
        ========================= */}

        {!application &&
          !error &&
          !loading && (

            <div className="welcome-panel">

              <div className="welcome-icon">
                🇮🇳
              </div>

              <h3>
                Welcome to Welfare Tracker
              </h3>

              <p>
                Enter your Tracking ID above to view
                your welfare application status.
              </p>

            </div>

          )}

      </main>

      {/* =========================
          FOOTER
      ========================= */}

      <footer>

        <span>
          © 2026 Welfare Tracker
        </span>

        <span>
          Government of India • Digital Governance
          Initiative
        </span>

      </footer>

    </div>
  )
}

export default App