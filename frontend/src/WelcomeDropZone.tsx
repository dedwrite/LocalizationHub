import './WelcomeDropZone.css'

function WelcomeDropZone() {
  return (
    <div
      className="welcome-drop-zone"
      aria-label="Drop a localization file or project"
    >
      <div
        className="welcome-drop-zone-icon"
        aria-hidden="true"
      >
        ↓
      </div>

      <div className="welcome-drop-zone-content">
        <strong>
          Drop a file here
        </strong>

        <span>
          JSON · CSV · PO · LH Project
        </span>
      </div>
    </div>
  )
}

export default WelcomeDropZone