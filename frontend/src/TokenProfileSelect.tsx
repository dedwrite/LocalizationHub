import type {
  TokenProfileId,
} from './tokens'

import './TokenProfileSelect.css'

type TokenProfileSelectProps = {
  value: TokenProfileId
  onChange: (
    profile: TokenProfileId,
  ) => void
}

function TokenProfileSelect({
  value,
  onChange,
}: TokenProfileSelectProps) {
  return (
    <label className="token-profile-control">
      <span>
        Token Profile
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target
              .value as TokenProfileId,
          )
        }
      >
        <option value="generic">
          Generic
        </option>

        <option value="godot">
          Godot
        </option>
      </select>
    </label>
  )
}

export default TokenProfileSelect