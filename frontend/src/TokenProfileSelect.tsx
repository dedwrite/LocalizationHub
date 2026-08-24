import type {
  TokenProfileId,
} from '@localizationhub/core'

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
}

function TokenProfileSelect({
  value,
  disabled =
    false,
  title,
  onChange,
}: TokenProfileSelectProps) {
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