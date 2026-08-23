import {
  writeTextFile,
} from '@tauri-apps/plugin-fs'

import type {
  LocalizationProjectV2,
} from '@localizationhub/core'

export async function writeLocalizationProject(
  path: string,
  project: LocalizationProjectV2,
): Promise<void> {
  const content =
    JSON.stringify(
      project,
      null,
      2,
    )

  await writeTextFile(
    path,
    content,
  )
}
