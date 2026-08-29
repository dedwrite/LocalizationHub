import type {
  TokenProfileConfig,
  TokenProfileId,
} from '@localizationhub/core'
import { displayTokenProfile, TOKEN_PROFILE_LABELS } from '@localizationhub/core'

import './TokenProfileSelect.css'

type TokenProfileSelectProps = {
  value: TokenProfileId

  disabled?:
    boolean

  title?:
    string

  onChange: (
    profile: TokenProfileId,
  ) => void

  config?: TokenProfileConfig
}

function TokenProfileSelect({
  value,
  disabled =
    false,
  title,
  onChange,
  config,
}: TokenProfileSelectProps) {
  const detectedLabel = config && config.detection.engine !== 'unknown'
    ? TOKEN_PROFILE_LABELS[config.detection.engine]
    : null
  const mismatch = config?.mode === 'manual' && detectedLabel && config.selectedProfile !== config.detection.engine
  return (
    <label className="token-profile-control">
      <span>
        Token Profile
      </span>

      <select
        value={value}
        disabled={
          disabled
        }
        title={
          title
        }
        onChange={(event) =>
          onChange(
            event.target
              .value as TokenProfileId,
          )
        }
      >
        <option value="auto">{config ? displayTokenProfile(config) : 'Auto'}</option>
        <option value="generic">Generic</option>
        <option value="godot">Godot</option>
        <option value="unreal">Unreal Engine</option>
        <option value="unity">Unity</option>
      </select>
      {config?.mode === 'auto' && config.detection.engine === 'unknown' && <small className="token-profile-status warning">Engine not detected. Using Generic.</small>}
      {config?.mode === 'auto' && config.detection.engine !== 'unknown' && <small className="token-profile-status">Detected engine: {detectedLabel} · {config.detection.confidence} confidence</small>}
      {mismatch && <small className="token-profile-status warning">{detectedLabel} was detected, but {TOKEN_PROFILE_LABELS[config.selectedProfile!]} is selected. <button type="button" onClick={() => onChange(config.detection.engine as TokenProfileId)}>Use detected profile</button></small>}
    </label>
  )
}

export default TokenProfileSelect
